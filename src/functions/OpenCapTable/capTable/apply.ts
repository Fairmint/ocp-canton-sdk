/**
 * Fluent builder for `CapTable_Apply`: one atomic batch of new OCF records, stock security events with their output
 * issuances, vesting snapshots and shard pre-splits, submitted by the transfer agent.
 *
 * Edits and deletes go through `CapTable_Restate` (`CapTableRestate`); holds and settlements through their own choices.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  mergeCommandContext,
  submitObservedTransaction,
  type CommandObservabilityOptions,
} from '../../../observability';
import { MAX_OPERATIONS_PER_APPLY } from '../../../register/caps';
import { resolveInputs } from '../../../register/inputs';
import type { RegisterIndex } from '../../../register/registerIndex';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type {
  ApplyOperation,
  ApplyRecordEntityType,
  ApplyStockCancellationOperation,
  ApplyStockConsolidationOperation,
  ApplyStockConversionOperation,
  ApplyStockReissuanceOperation,
  ApplyStockRepurchaseOperation,
  ApplyStockTransferOperation,
  BookInputs,
  BookWriteExecuteResult,
  BookWriteResult,
  CapTableCommand,
  CapTableOperationMeta,
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
import { applyOperationToDaml, bookInputsToDaml } from './choiceArguments';
import type { OcfDataTypeFor, OcfEntityType } from './entityTypes';
import { decodeApplyResult } from './results';

const APPLY_CHOICE = 'CapTable_Apply';

/** Correlated entity-kind and native-data tuples `CapTableApply.create` takes. */
export type ApplyRecordArguments = {
  [EntityType in ApplyRecordEntityType]: readonly [type: EntityType, data: OcfDataTypeFor<EntityType>];
}[ApplyRecordEntityType];

/** Parameters of a `CapTable_Apply` batch. */
export interface CapTableApplyParams extends CapTableAnchorRef, CommandObservabilityOptions {
  /** The transfer agent: the only controller of the anchor's writes */
  transferAgent: string;
  /** The existing contracts the batch reads or changes; resolved from `index` when omitted */
  inputs?: BookInputs;
  /**
   * The book's key index, current at the batch's submission. When `inputs` are omitted, `build()` resolves them from it
   * (`register.resolveInputs`), refusing locally what the index shows the ledger would refuse.
   */
  index?: RegisterIndex;
  /**
   * Deterministic command ID, for a caller that reconciles the command's outcome. Takes precedence over
   * `defaultContext.commandId` and `context.commandId`.
   */
  commandId?: string;
  /** Additional parties for read access */
  readAs?: string[];
}

/** What `buildApplyCommand` needs: the anchor, the transfer agent, and the inputs or an index to resolve them from. */
export type BuildApplyCommandParams = Pick<
  CapTableApplyParams,
  'capTableContractId' | 'capTableTemplateId' | 'transferAgent' | 'inputs' | 'index'
>;

const APPLY_ENVELOPES: Readonly<Record<ApplyOperation['kind'], EnvelopeFields>> = {
  record: { required: ['kind', 'type', 'data'], optional: [] },
  stockTransfer: { required: ['kind', 'transfer', 'resulting'], optional: ['balance'] },
  stockCancellation: { required: ['kind', 'cancellation'], optional: ['balance'] },
  stockRepurchase: { required: ['kind', 'repurchase'], optional: ['balance'] },
  stockConversion: { required: ['kind', 'conversion', 'resulting'], optional: ['balance'] },
  stockReissuance: { required: ['kind', 'reissuance', 'resulting'], optional: [] },
  stockConsolidation: { required: ['kind', 'consolidation', 'resultingIssuance'], optional: [] },
  vestingSnapshot: { required: ['kind', 'securityId', 'asOf', 'vested'], optional: [] },
  preSplitShard: { required: ['kind', 'prefix'], optional: [] },
};

function stringField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const fieldValue: unknown = (value as Record<string, unknown>)[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function metaOf(index: number, operation: ApplyOperation): CapTableOperationMeta {
  const meta = (entityType: OcfEntityType | undefined, data: unknown, securityId?: string): CapTableOperationMeta => {
    const id = stringField(data, 'id');
    const security = securityId ?? stringField(data, 'security_id');
    return {
      index,
      kind: operation.kind,
      ...(entityType !== undefined ? { entityType } : {}),
      ...(id !== undefined ? { id } : {}),
      ...(security !== undefined ? { securityId: security } : {}),
    };
  };
  switch (operation.kind) {
    case 'record':
      return meta(operation.type, operation.data);
    case 'stockTransfer':
      return meta('stockTransfer', operation.transfer);
    case 'stockCancellation':
      return meta('stockCancellation', operation.cancellation);
    case 'stockRepurchase':
      return meta('stockRepurchase', operation.repurchase);
    case 'stockConversion':
      return meta('stockConversion', operation.conversion);
    case 'stockReissuance':
      return meta('stockReissuance', operation.reissuance);
    case 'stockConsolidation':
      return meta(
        'stockConsolidation',
        operation.consolidation,
        stringField(operation.resultingIssuance, 'security_id')
      );
    case 'vestingSnapshot':
      return { index, kind: operation.kind, securityId: operation.securityId };
    case 'preSplitShard':
      return { index, kind: operation.kind, id: operation.prefix };
  }
}

function createApplyCommandId(): string {
  return `cap-table-apply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fluent `CapTable_Apply` builder. Each operation is converted when it is added, so a malformed record fails at its
 * call; `build()` checks the batch as the ledger does before it reads anything (at least one operation, at most 500),
 * and resolves the inputs from the key index when the parameters give an index and no inputs.
 *
 * @example
 * ```typescript
 * const result = await new CapTableApply({ capTableContractId, transferAgent, index }, ledger)
 *   .create('stakeholder', stakeholder)
 *   .create('stockIssuance', issuance)
 *   .stockTransfer({ transfer, resulting: [toBuyer], balance })
 *   .execute();
 * ```
 */
export class CapTableApply {
  private readonly params: CapTableApplyParams;
  private readonly client: LedgerJsonApiClient | null;
  private encoded: Fairmint.OpenCapTable.Apply.ApplyOperation[] = [];
  private operations: ApplyOperation[] = [];
  private metas: CapTableOperationMeta[] = [];

  constructor(params: CapTableApplyParams, client: LedgerJsonApiClient | null = null) {
    this.params = params;
    this.client = client;
  }

  /** Add an OCF record (`ApplyRecord`): any kind but the issuer, the hold pair and the bundled stock events. */
  create(...args: ApplyRecordArguments): this {
    const [type, data] = args;
    // The tuple is correlated by construction; the union of tuples cannot be re-correlated by type.
    return this.add({ kind: 'record', type, data } as ApplyOperation);
  }

  /** Add a stock transfer with its resulting issuances and, when shares remain, its balance. */
  stockTransfer(operation: Omit<ApplyStockTransferOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockTransfer' });
  }

  /** Add a stock cancellation with, when shares remain, its balance. */
  stockCancellation(operation: Omit<ApplyStockCancellationOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockCancellation' });
  }

  /** Add a stock repurchase with, when shares remain, its balance. */
  stockRepurchase(operation: Omit<ApplyStockRepurchaseOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockRepurchase' });
  }

  /** Add a stock conversion with its resulting issuances and, when shares remain, its balance. */
  stockConversion(operation: Omit<ApplyStockConversionOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockConversion' });
  }

  /** Add a stock reissuance with its resulting issuances. */
  stockReissuance(operation: Omit<ApplyStockReissuanceOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockReissuance' });
  }

  /** Add a stock consolidation with its resulting issuance. */
  stockConsolidation(operation: Omit<ApplyStockConsolidationOperation, 'kind'>): this {
    return this.add({ ...operation, kind: 'stockConsolidation' });
  }

  /** Record the TA's vested quantity of a security on vesting terms as of a date. */
  vestingSnapshot(snapshot: { securityId: string; asOf: string; vested: string }): this {
    return this.add({ kind: 'vestingSnapshot', ...snapshot });
  }

  /** Split an ID shard by its next bit. */
  preSplitShard(prefix: string): this {
    return this.add({ kind: 'preSplitShard', prefix });
  }

  /** Add a pre-built operation, checked exactly (its kind's fields, nothing else) for untyped callers. */
  operation(operation: ApplyOperation): this {
    const path = `operations[${this.encoded.length}]`;
    const kind = stringField(operation, 'kind');
    const envelope =
      kind !== undefined && Object.prototype.hasOwnProperty.call(APPLY_ENVELOPES, kind)
        ? APPLY_ENVELOPES[kind as ApplyOperation['kind']]
        : undefined;
    if (envelope === undefined) {
      throw new OcpValidationError(`${path}.kind`, 'Unknown CapTable_Apply operation kind', {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: Object.keys(APPLY_ENVELOPES).join(' | '),
        receivedValue: kind,
      });
    }
    assertExactEnvelope(operation, kind ?? 'apply', envelope, path);
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
   * Build the `CapTable_Apply` command without submitting it: submit it as `actAs` (the transfer agent).
   *
   * @throws OcpValidationError for an empty batch or one over 500 operations, as the ledger refuses them, for a
   * payload that is not JSON-safe, when neither inputs nor an index are given, and as `register.resolveInputs` refuses
   * a batch the index shows the ledger would refuse
   */
  build(): CapTableCommand {
    requireBoundedList(
      this.encoded,
      'operations',
      {
        empty: 'CapTable_Apply needs at least one operation',
        tooMany: `CapTable_Apply takes at most ${MAX_OPERATIONS_PER_APPLY} operations`,
      },
      MAX_OPERATIONS_PER_APPLY
    );
    const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_Apply = {
      inputs: bookInputsToDaml(this.inputs()),
      operations: [...this.encoded],
    };
    return anchorCommand(
      this.params,
      APPLY_CHOICE,
      choiceArgument,
      requireText(this.params.transferAgent, 'transferAgent'),
      describeOperationAt(this.metas)
    );
  }

  /**
   * Build and submit the batch through the client, then read what it created.
   *
   * @throws OcpValidationError when the builder has no client, or `build()` refuses the batch
   * @throws CapTableWriteError (an `OcpContractError`) when the submission fails: `OUTCOME_UNKNOWN` when the ledger may
   * have committed it (the cause carries the HTTP status and the Canton error), `CHOICE_FAILED` when it did not
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
      commandId: this.params.commandId ?? merged?.commandId ?? createApplyCommandId(),
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
        { operation: 'capTable.apply', templateId, choice: APPLY_CHOICE }
      );
    } catch (error) {
      throw writeFailure(error, APPLY_CHOICE, this.params.capTableContractId, this.metas);
    }
    return {
      ...readApplyResult(response, { capTableContractId: this.params.capTableContractId }),
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
    return this;
  }

  private add(operation: ApplyOperation): this {
    const index = this.encoded.length;
    this.encoded.push(applyOperationToDaml(operation, `operations[${index}]`));
    this.operations.push(operation);
    this.metas.push(metaOf(index, operation));
    return this;
  }

  private inputs(): BookInputs {
    const { inputs, index } = this.params;
    if (inputs !== undefined) return inputs;
    if (index === undefined) {
      throw new OcpValidationError('inputs', 'Give the batch its inputs, or a key index to resolve them from', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    return resolveInputs(index, { kind: 'apply', operations: this.operations }).inputs;
  }
}

/**
 * Build a `CapTable_Apply` command from a list of operations, without the fluent builder.
 *
 * @throws OcpValidationError as `CapTableApply` does
 */
export function buildApplyCommand(
  params: BuildApplyCommandParams,
  operations: readonly ApplyOperation[]
): CapTableCommand {
  const batch = new CapTableApply(params);
  for (const operation of operations) batch.operation(operation);
  return batch.build();
}

/**
 * Read what `CapTable_Apply` created from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no `CapTable_Apply` result
 * @throws OcpParseError when the result does not decode
 */
export function readApplyResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): BookWriteResult {
  return decodeApplyResult(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice: APPLY_CHOICE,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${APPLY_CHOICE}.exerciseResult`
  );
}
