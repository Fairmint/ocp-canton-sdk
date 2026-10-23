/**
 * Fluent builder for `CapTable_Restate`: mirrors edits and deletes of OCF records, and the stock states they affect,
 * within the fixed limits of `Restate.daml` (at most 500 contracts touched, each record edited or deleted once).
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  mergeCommandContext,
  submitObservedTransaction,
  type CommandObservabilityOptions,
} from '../../../observability';
import { MAX_CONTRACTS_PER_RESTATEMENT } from '../../../register/caps';
import { resolveInputs } from '../../../register/inputs';
import type { RegisterIndex } from '../../../register/registerIndex';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type {
  BookInputs,
  BookWriteExecuteResult,
  BookWriteResult,
  CapTableCommand,
  CapTableOperationMeta,
  RestateOperation,
  StateRestatement,
} from '../../../types/register';
import { requireExerciseResult } from '../shared/exerciseResult';
import {
  anchorCommand,
  assertExactEnvelope,
  describeOperationAt,
  requireBoundedList,
  requireText,
  writeFailure,
  type CapTableAnchorRef,
  type EnvelopeFields,
} from './anchorCommand';
import { bookInputsToDaml, restateOperationToDaml } from './choiceArguments';
import type { OcfDataTypeFor, OcfEditableEntityType } from './entityTypes';
import { decodeRestateResult } from './results';

const RESTATE_CHOICE = 'CapTable_Restate';

/** Correlated entity-kind and native-data tuples `CapTableRestate.edit` takes. */
export type RestateEditArguments = {
  [EntityType in OcfEditableEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[OcfEditableEntityType];

/** Parameters of a `CapTable_Restate`. */
export interface CapTableRestateParams extends CapTableAnchorRef, CommandObservabilityOptions {
  /** The transfer agent: the only controller of the anchor's writes */
  transferAgent: string;
  /** The existing contracts the restatement reads or changes, the records it edits or deletes included; resolved from
   * `index` when omitted */
  inputs?: BookInputs;
  /**
   * The book's key index, current at the restatement's submission. When `inputs` are omitted, `build()` resolves them
   * from it (`register.resolveInputs`), refusing locally what the index shows the ledger would refuse.
   */
  index?: RegisterIndex;
  /** Deterministic command ID; takes precedence over `defaultContext.commandId` and `context.commandId` */
  commandId?: string;
  /** Additional parties for read access */
  readAs?: string[];
}

/** What `buildRestateCommand` needs: the anchor, the transfer agent, and the inputs or an index to resolve them from. */
export type BuildRestateCommandParams = Pick<
  CapTableRestateParams,
  'capTableContractId' | 'capTableTemplateId' | 'transferAgent' | 'inputs' | 'index'
>;

const RESTATE_ENVELOPES: Readonly<Record<RestateOperation['kind'], EnvelopeFields>> = {
  edit: { required: ['kind', 'type', 'data'], optional: [] },
  delete: { required: ['kind', 'objectId'], optional: [] },
  setState: { required: ['kind', 'state'], optional: [] },
  endState: { required: ['kind', 'securityId'], optional: [] },
};

function stringField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const fieldValue: unknown = (value as Record<string, unknown>)[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function metaOf(index: number, operation: RestateOperation): CapTableOperationMeta {
  switch (operation.kind) {
    case 'edit': {
      const id = stringField(operation.data, 'id');
      const securityId = stringField(operation.data, 'security_id');
      return {
        index,
        kind: operation.kind,
        entityType: operation.type,
        ...(id !== undefined ? { id } : {}),
        ...(securityId !== undefined ? { securityId } : {}),
      };
    }
    case 'delete':
      return { index, kind: operation.kind, id: operation.objectId };
    case 'setState':
      return { index, kind: operation.kind, securityId: operation.state.security_id };
    case 'endState':
      return { index, kind: operation.kind, securityId: operation.securityId };
  }
}

function createRestateCommandId(): string {
  return `cap-table-restate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fluent `CapTable_Restate` builder. Each operation is converted when it is added; a record edited or deleted twice is
 * refused at once, as the ledger refuses it, and `build()` refuses an empty restatement and one with more operations
 * than the 500 contracts a restatement may touch. It resolves the inputs from the key index when the parameters give
 * an index and no inputs.
 *
 * @example
 * ```typescript
 * const result = await new CapTableRestate({ capTableContractId, transferAgent, index }, ledger)
 *   .edit('stockIssuance', correctedIssuance)
 *   .setState(restatedState)
 *   .execute();
 * ```
 */
export class CapTableRestate {
  private readonly params: CapTableRestateParams;
  private readonly client: LedgerJsonApiClient | null;
  private encoded: Fairmint.OpenCapTable.Restate.RestateOperation[] = [];
  private operations: RestateOperation[] = [];
  private metas: CapTableOperationMeta[] = [];
  private touched = new Set<string>();

  constructor(params: CapTableRestateParams, client: LedgerJsonApiClient | null = null) {
    this.params = params;
    this.client = client;
  }

  /** Replace a record (among the inputs) with new data under the same type and OCF ID. */
  edit(...args: RestateEditArguments): this {
    const [type, data] = args;
    // The tuple is correlated by construction; the union of tuples cannot be re-correlated by type.
    return this.add({ kind: 'edit', type, data } as RestateOperation);
  }

  /** Delete a record (among the inputs) by object ID and release the ID. */
  delete(objectId: string): this {
    return this.add({ kind: 'delete', objectId });
  }

  /** Replace a security's state with its successor, or recreate one with `seq`. */
  setState(state: StateRestatement): this {
    return this.add({ kind: 'setState', state });
  }

  /** End a security's state, with the deletion of its origin issuance in this restatement. */
  endState(securityId: string): this {
    return this.add({ kind: 'endState', securityId });
  }

  /** Add a pre-built operation, checked exactly (its kind's fields, nothing else) for untyped callers. */
  operation(operation: RestateOperation): this {
    const path = `operations[${this.encoded.length}]`;
    const kind = stringField(operation, 'kind');
    const envelope =
      kind !== undefined && Object.prototype.hasOwnProperty.call(RESTATE_ENVELOPES, kind)
        ? RESTATE_ENVELOPES[kind as RestateOperation['kind']]
        : undefined;
    if (envelope === undefined) {
      throw new OcpValidationError(`${path}.kind`, 'Unknown CapTable_Restate operation kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: Object.keys(RESTATE_ENVELOPES).join(' | '),
        receivedValue: kind,
      });
    }
    assertExactEnvelope(operation, kind ?? 'restate', envelope, path);
    return this.add(operation);
  }

  /** The number of queued operations. */
  get size(): number {
    return this.encoded.length;
  }

  /** Whether no operation is queued. */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Build the `CapTable_Restate` command without submitting it: submit it as `actAs` (the transfer agent).
   *
   * @throws OcpValidationError for an empty restatement, or one with more operations than the 500 contracts a
   * restatement may touch (each operation touches at least one), for a payload that is not JSON-safe, when neither
   * inputs nor an index are given, and as `register.resolveInputs` refuses a restatement the index shows the ledger
   * would refuse
   */
  build(): CapTableCommand {
    requireBoundedList(
      this.encoded,
      'operations',
      {
        empty: 'CapTable_Restate needs at least one operation',
        tooMany: `CapTable_Restate touches at most ${MAX_CONTRACTS_PER_RESTATEMENT} contracts`,
      },
      MAX_CONTRACTS_PER_RESTATEMENT
    );
    const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_Restate = {
      inputs: bookInputsToDaml(this.inputs()),
      operations: [...this.encoded],
    };
    return anchorCommand(
      this.params,
      RESTATE_CHOICE,
      choiceArgument,
      requireText(this.params.transferAgent, 'transferAgent'),
      describeOperationAt(this.metas)
    );
  }

  /**
   * Build and submit the restatement through the client, then read what it created.
   *
   * @throws OcpValidationError when the builder has no client, or `build()` refuses the restatement
   * @throws CapTableWriteError (an `OcpContractError`) when the submission fails: `OUTCOME_UNKNOWN` when the ledger may
   * have committed it, `CHOICE_FAILED` when it did not
   */
  async execute(): Promise<BookWriteExecuteResult> {
    if (!this.client) {
      throw new OcpValidationError('client', 'Cannot execute without a client - use build() and submit it manually', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    const built = this.build();
    const merged = mergeCommandContext(this.params.defaultContext, this.params.context);
    const context = mergeCommandContext(merged, {
      commandId: this.params.commandId ?? merged?.commandId ?? createRestateCommandId(),
    });
    const templateId = this.params.capTableTemplateId ?? OCP_TEMPLATES.capTable;
    let response: SubmitAndWaitForTransactionResponse;
    try {
      response = await submitObservedTransaction(
        this.client,
        {
          commands: [built.command],
          actAs: built.actAs,
          ...(this.params.readAs !== undefined ? { readAs: this.params.readAs } : {}),
          disclosedContracts: built.disclosedContracts,
        },
        { ...this.params, context },
        { operation: 'capTable.restate', templateId, choice: RESTATE_CHOICE }
      );
    } catch (error) {
      throw writeFailure(error, RESTATE_CHOICE, this.params.capTableContractId, this.metas);
    }
    return {
      ...readRestateResult(response, { capTableContractId: this.params.capTableContractId }),
      updateId: response.transaction.updateId,
      response,
    };
  }

  /** Per-operation metadata (kind, entity kind, IDs), for debugging and error reports. */
  getDetailedSummary(): CapTableOperationMeta[] {
    return this.metas.map((meta) => ({ ...meta }));
  }

  /** Remove every queued operation so the builder can be reused. */
  clear(): this {
    this.encoded = [];
    this.operations = [];
    this.metas = [];
    this.touched = new Set();
    return this;
  }

  private add(operation: RestateOperation): this {
    const index = this.encoded.length;
    const path = `operations[${index}]`;
    const encoded = restateOperationToDaml(operation, path);
    const objectId =
      encoded.tag === 'RestateDelete' ? encoded.value : encoded.tag === 'RestateEdit' ? encoded.value.value.id : null;
    if (objectId !== null && this.touched.has(objectId)) {
      throw new OcpValidationError(path, `record ${objectId} is edited or deleted more than once in one restatement`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: objectId,
      });
    }
    if (objectId !== null) this.touched.add(objectId);
    this.encoded.push(encoded);
    this.operations.push(operation);
    this.metas.push(metaOf(index, operation));
    return this;
  }

  private inputs(): BookInputs {
    const { inputs, index } = this.params;
    if (inputs !== undefined) return inputs;
    if (index === undefined) {
      throw new OcpValidationError('inputs', 'Give the restatement its inputs, or a key index to resolve them from', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    return resolveInputs(index, { kind: 'restate', operations: this.operations }).inputs;
  }
}

/**
 * Build a `CapTable_Restate` command from a list of operations, without the fluent builder.
 *
 * @throws OcpValidationError as `CapTableRestate` does
 */
export function buildRestateCommand(
  params: BuildRestateCommandParams,
  operations: readonly RestateOperation[]
): CapTableCommand {
  const restatement = new CapTableRestate(params);
  for (const operation of operations) restatement.operation(operation);
  return restatement.build();
}

/**
 * Read what `CapTable_Restate` created from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no `CapTable_Restate` result
 * @throws OcpParseError when the result does not decode
 */
export function readRestateResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): BookWriteResult {
  return decodeRestateResult(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice: RESTATE_CHOICE,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${RESTATE_CHOICE}.exerciseResult`
  );
}
