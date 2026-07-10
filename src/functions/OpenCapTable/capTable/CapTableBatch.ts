/**
 * Fluent batch builder for cap table updates.
 *
 * Provides a type-safe API for building batch UpdateCapTable commands that support atomic creates, edits, and deletes
 * of multiple OCF entities. Chain .create(), .edit(), and .delete() calls, then call .execute() to submit.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import {
  mergeCommandContext,
  submitObservedTransactionTree,
  type CommandObservabilityOptions,
} from '../../../observability';
import type { CommandWithDisclosedContracts } from '../../../types';
import {
  ENTITY_TAG_MAP,
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  type CapTableBatchExecuteResult,
  type CapTableBatchOperations,
  type OcfCreateArguments,
  type OcfCreateData,
  type OcfCreateDataFor,
  type OcfCreateOperation,
  type OcfDataTypeFor,
  type OcfDeletableEntityType,
  type OcfDeleteData,
  type OcfDeleteDataFor,
  type OcfDeleteOperation,
  type OcfEditArguments,
  type OcfEditData,
  type OcfEditDataFor,
  type OcfEditOperation,
  type OcfEntityType,
  type UpdateCapTableResult,
} from './batchTypes';
import { convertOperationToDaml, convertToDaml } from './ocfToDaml';

/** Parameters for initializing a batch update. */
export interface CapTableBatchParams extends CommandObservabilityOptions {
  /** The contract ID of the CapTable to update */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
  /**
   * Optional deterministic command ID for callers that need idempotent retry semantics.
   * Takes precedence over `defaultContext.commandId` and `context.commandId`.
   */
  commandId?: string;
  /** Party IDs to act as (signatories) */
  actAs: string[];
  /** Optional additional party IDs for read access */
  readAs?: string[];
}

function createUpdateCapTableCommandId(): string {
  return `update-captable-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Metadata for a batch operation item, used for debugging and error reporting. */
export interface BatchItemMeta {
  /** The OCF entity type (e.g., 'stockIssuance', 'stakeholder') */
  entityType: OcfEntityType;
  /** The canonical OCF object ID */
  id: string;
  /** The security_id for issuance types (stockIssuance, convertibleIssuance, etc.) */
  securityId?: string;
}

function decodeGeneratedOperation<T>(
  decoder: { runWithException: (input: unknown) => T },
  input: unknown,
  operation: 'create' | 'edit' | 'delete',
  entityType: OcfEntityType
): T {
  try {
    return decoder.runWithException(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OcpValidationError(
      `batch.${operation}.${entityType}`,
      `Converter output does not match the generated DAML ${operation} variant: ${message}`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: input,
      }
    );
  }
}

/** Build and validate one generated DAML create variant from a correlated entity-kind/data pair. */
export function buildOcfCreateData<const Arguments extends OcfCreateArguments>(
  ...args: Arguments
): OcfCreateDataFor<Arguments[0]>;
export function buildOcfCreateData(...args: OcfCreateArguments): OcfCreateData {
  const [type] = args;
  if (!isOcfCreatableEntityType(type)) {
    throw new OcpValidationError('type', `Create operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const tag = ENTITY_TAG_MAP[type].create;
  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfCreateData.decoder,
    { tag, value: convertToDaml(...args) },
    'create',
    type
  );
}

function buildOcfCreateDataFromOperation(operation: OcfCreateOperation): OcfCreateData {
  const { type } = operation;
  if (!isOcfCreatableEntityType(type)) {
    throw new OcpValidationError('type', `Create operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const tag = ENTITY_TAG_MAP[type].create;
  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfCreateData.decoder,
    { tag, value: convertOperationToDaml(operation) },
    'create',
    type
  );
}

/** Build and validate one generated DAML edit variant from a correlated entity-kind/data pair. */
export function buildOcfEditData<const Arguments extends OcfEditArguments>(
  ...args: Arguments
): OcfEditDataFor<Arguments[0]>;
export function buildOcfEditData(...args: OcfEditArguments): OcfEditData {
  const [type] = args;
  if (!isOcfEditableEntityType(type)) {
    throw new OcpValidationError('type', `Edit operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const tag = ENTITY_TAG_MAP[type].edit;
  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfEditData.decoder,
    { tag, value: convertToDaml(...args) },
    'edit',
    type
  );
}

function buildOcfEditDataFromOperation(operation: OcfEditOperation): OcfEditData {
  const { type } = operation;
  if (!isOcfEditableEntityType(type)) {
    throw new OcpValidationError('type', `Edit operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const tag = ENTITY_TAG_MAP[type].edit;
  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfEditData.decoder,
    { tag, value: convertOperationToDaml(operation) },
    'edit',
    type
  );
}

/** Build and validate one generated DAML delete variant. */
export function buildOcfDeleteData<const EntityType extends OcfDeletableEntityType>(
  type: EntityType,
  id: string
): OcfDeleteDataFor<EntityType>;
export function buildOcfDeleteData(type: OcfDeletableEntityType, id: string): OcfDeleteData {
  if (!isOcfDeletableEntityType(type)) {
    throw new OcpValidationError('type', `Delete operation not supported for entity type: ${String(type)}`, {
      code: OcpErrorCodes.INVALID_TYPE,
    });
  }

  const tag = ENTITY_TAG_MAP[type].delete;
  return decodeGeneratedOperation(
    Fairmint.OpenCapTable.CapTable.OcfDeleteData.decoder,
    { tag, value: id },
    'delete',
    type
  );
}

/**
 * Fluent batch builder for cap table updates.
 *
 * Collects creates, edits, and deletes and builds them into a single `UpdateCapTable` choice for atomic execution.
 *
 * @example
 * ```typescript
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId,
 *   actAs: [issuerPartyId],
 * });
 * batch
 *   .create('stakeholder', stakeholderOcf)
 *   .create('stockClass', stockClassOcf);
 * const { updatedCapTableCid, updateId } = await batch.execute();
 * ```
 */
export class CapTableBatch {
  private readonly params: CapTableBatchParams;
  private readonly client: LedgerJsonApiClient | null;
  private creates: OcfCreateData[] = [];
  private edits: OcfEditData[] = [];
  private deletes: OcfDeleteData[] = [];

  // Metadata arrays track per-item details for debugging/error reporting
  private createMetas: BatchItemMeta[] = [];
  private editMetas: BatchItemMeta[] = [];
  private deleteMetas: BatchItemMeta[] = [];

  constructor(params: CapTableBatchParams, client: LedgerJsonApiClient | null = null) {
    this.params = params;
    this.client = client;
  }

  /**
   * Add a create operation to the batch.
   *
   * @param type - The OCF entity type to create (e.g., 'stakeholder', 'stockClass')
   * @param data - The native OCF data for the entity
   * @returns This for chaining
   * Unsupported entity kinds are rejected by TypeScript and guarded at runtime for untyped callers.
   */
  create(...args: OcfCreateArguments): this {
    const [type, data] = args;
    this.creates.push(buildOcfCreateData(...args));
    this.createMetas.push(extractBatchItemMeta(type, data));
    return this;
  }

  /** Add a pre-correlated create operation object to the batch. */
  createOperation(operation: OcfCreateOperation): this {
    this.creates.push(buildOcfCreateDataFromOperation(operation));
    this.createMetas.push(extractBatchItemMeta(operation.type, operation.data));
    return this;
  }

  /**
   * Add an edit operation to the batch.
   *
   * @param type - The OCF entity type to edit
   * @param data - The updated native OCF data (must include the entity's id)
   * @returns This for chaining
   */
  edit(...args: OcfEditArguments): this {
    const [type, data] = args;
    this.edits.push(buildOcfEditData(...args));
    this.editMetas.push(extractBatchItemMeta(type, data));
    return this;
  }

  /** Add a pre-correlated edit operation object to the batch. */
  editOperation(operation: OcfEditOperation): this {
    this.edits.push(buildOcfEditDataFromOperation(operation));
    this.editMetas.push(extractBatchItemMeta(operation.type, operation.data));
    return this;
  }

  /**
   * Add a delete operation to the batch.
   *
   * @param type - The OCF entity type to delete
   * @param id - The OCF object ID to delete
   * @returns This for chaining
   * Unsupported entity kinds are rejected by TypeScript and guarded at runtime for untyped callers.
   */
  delete(type: OcfDeletableEntityType, id: string): this {
    if (!isOcfDeletableEntityType(type)) {
      throw new OcpValidationError('type', `Delete operation not supported for entity type: ${String(type)}`, {
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }

    this.deletes.push(buildOcfDeleteData(type, id));
    this.deleteMetas.push({ entityType: type, id });
    return this;
  }

  /** Add a pre-correlated delete operation object to the batch. */
  deleteOperation(operation: OcfDeleteOperation): this {
    return this.delete(operation.type, operation.id);
  }

  /** Get the number of operations in the batch. */
  get size(): number {
    return this.creates.length + this.edits.length + this.deletes.length;
  }

  /** Check if the batch is empty. */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Build the UpdateCapTable command without executing it.
   *
   * Validates that the payload is JSON-safe (no `undefined` values) before returning.
   * This catches converter bugs that would otherwise produce cryptic `commands.0: Invalid input`
   * errors from the Canton JSON API parameter validation.
   *
   * @returns The command and disclosed contracts for manual submission
   */
  build(): CommandWithDisclosedContracts {
    if (this.isEmpty) {
      throw new OcpValidationError(
        'batch',
        'Cannot build empty batch - add at least one create, edit, or delete operation',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        }
      );
    }

    const choiceArgument = {
      creates: this.creates,
      edits: this.edits,
      deletes: this.deletes,
    };

    // Pre-submit JSON-safety guard: detect undefined values that would poison the payload.
    // Converters should never emit undefined, but if one does, catch it here with full context
    // instead of letting it bubble up as an opaque "commands.0: Invalid input" from Zod.
    this.assertJsonSafe(choiceArgument);

    // Use the templateId from capTableContractDetails when provided (from actual ledger),
    // otherwise fall back to the DAML-JS package's hardcoded templateId.
    const capTableTemplateId = this.params.capTableContractDetails?.templateId ?? OCP_TEMPLATES.capTable;

    const command: Command = {
      ExerciseCommand: {
        templateId: capTableTemplateId,
        contractId: this.params.capTableContractId,
        choice: 'UpdateCapTable',
        choiceArgument,
      },
    };

    // No disclosed contracts needed - UpdateCapTable doesn't reference external contracts
    return { command, disclosedContracts: [] };
  }

  /**
   * Build and execute the batch update.
   *
   * @returns The result containing the update ID (transaction ID), updated cap table contract ID, and affected entity IDs
   * @throws OcpValidationError if no client was provided or if the batch is empty
   * @throws OcpContractError if the UpdateCapTable result is not found in the transaction tree or if execution fails
   */
  async execute(): Promise<CapTableBatchExecuteResult> {
    if (!this.client) {
      throw new OcpValidationError(
        'client',
        'Cannot execute batch without a client - use build() instead and submit manually',
        {
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        }
      );
    }

    const { command, disclosedContracts } = this.build();

    // Get batch summary for error context
    const batchSummary = this.getBatchSummary();

    let response: Awaited<ReturnType<LedgerJsonApiClient['submitAndWaitForTransactionTree']>>;
    try {
      const templateId = 'ExerciseCommand' in command ? command.ExerciseCommand.templateId : undefined;
      const mergedContext = mergeCommandContext(this.params.defaultContext, this.params.context);
      const context = mergeCommandContext(mergedContext, {
        commandId: this.params.commandId ?? mergedContext?.commandId ?? createUpdateCapTableCommandId(),
      });
      response = await submitObservedTransactionTree(
        this.client,
        {
          commands: [command],
          actAs: this.params.actAs,
          readAs: this.params.readAs,
          disclosedContracts,
        },
        { ...this.params, context },
        {
          operation: 'capTable.update',
          templateId,
          choice: 'UpdateCapTable',
        }
      );
    } catch (error) {
      // Wrap the error with batch context for better debugging
      const originalMessage = error instanceof Error ? error.message : String(error);
      const detailedItems = this.getDetailedSummary();
      const contextMessage = `Batch execution failed: ${originalMessage} ${batchSummary.formatted}`;

      const wrappedError = new OcpContractError(contextMessage, {
        contractId: this.params.capTableContractId,
        choice: 'UpdateCapTable',
        cause: error instanceof Error ? error : new Error(String(error)),
        code: OcpErrorCodes.CHOICE_FAILED,
      });

      // Attach detailed item metadata for callers to use in error reporting
      (wrappedError as OcpContractError & { batchItems?: BatchItemDetails }).batchItems = detailedItems;

      throw wrappedError;
    }

    // Extract the result from the transaction tree
    const { transactionTree } = response;
    const { eventsById, updateId } = transactionTree;

    // Find the exercised event for UpdateCapTable
    // Canton returns ExercisedTreeEvent (not ExercisedEvent) in transaction tree responses
    for (const eventId of Object.keys(eventsById)) {
      const event = eventsById[eventId] as Record<string, unknown> | undefined;
      if (event && 'ExercisedTreeEvent' in event) {
        const treeEvent = event.ExercisedTreeEvent as { value?: Record<string, unknown> };
        if (!treeEvent.value) continue;
        const exercised = treeEvent.value as {
          choice?: string;
          exerciseResult?: UpdateCapTableResult;
        };
        if (exercised.choice === 'UpdateCapTable' && exercised.exerciseResult) {
          return {
            ...exercised.exerciseResult,
            updateId,
          };
        }
      }
    }

    throw new OcpContractError(`UpdateCapTable result not found in transaction tree ${batchSummary.formatted}`, {
      contractId: this.params.capTableContractId,
      choice: 'UpdateCapTable',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  /**
   * Assert that the choice argument payload is JSON-safe (no `undefined` values).
   *
   * Walks the entire payload tree. If any `undefined` is found, throws an
   * OcpValidationError with the full JSON-path and correlated batch item metadata
   * so the caller can pinpoint exactly which converter produced bad output.
   */
  private assertJsonSafe(payload: Record<string, unknown>): void {
    const undefinedPath = findUndefinedPath(payload, 'choiceArgument');
    if (undefinedPath) {
      // Try to correlate with batch item metadata for richer diagnostics
      const meta = this.correlatePathToMeta(undefinedPath);
      const metaSuffix = meta ? ` (entity: ${meta.entityType}, id: ${meta.id})` : '';
      throw new OcpValidationError(
        'batch.payload',
        `Converter produced non-JSON-safe payload: undefined value at "${undefinedPath}"${metaSuffix}. ` +
          'This is a converter bug — all optional fields must use null, not undefined.',
        {
          code: OcpErrorCodes.INVALID_TYPE,
        }
      );
    }
  }

  /**
   * Attempt to correlate a JSON-path like "choiceArgument.creates[3].value.stock_class_ids"
   * back to the batch item metadata for that index.
   */
  private correlatePathToMeta(path: string): BatchItemMeta | undefined {
    const createMatch = path.match(/^choiceArgument\.creates\[(\d+)]/);
    if (createMatch) {
      const idx = Number(createMatch[1]);
      return this.createMetas[idx];
    }
    const editMatch = path.match(/^choiceArgument\.edits\[(\d+)]/);
    if (editMatch) {
      const idx = Number(editMatch[1]);
      return this.editMetas[idx];
    }
    const deleteMatch = path.match(/^choiceArgument\.deletes\[(\d+)]/);
    if (deleteMatch) {
      const idx = Number(deleteMatch[1]);
      return this.deleteMetas[idx];
    }
    return undefined;
  }

  /** Get a summary of the batch operations for logging and error messages. */
  private getBatchSummary(): {
    creates: number;
    edits: number;
    deletes: number;
    entityTypes: string[];
    formatted: string;
  } {
    // Extract unique entity types from the tags (e.g., "OcfCreateStakeholder" -> "Stakeholder")
    const extractEntityType = (tag: string): string => {
      // Tags are like "OcfCreateStakeholder", "OcfEditStockClass", "OcfStakeholderId"
      const match = tag.match(/Ocf(?:Create|Edit|Delete)?(.+?)(?:Id)?$/);
      return match?.[1] ?? tag;
    };

    const entityTypes = new Set<string>();
    for (const op of this.creates) {
      entityTypes.add(extractEntityType(op.tag));
    }
    for (const op of this.edits) {
      entityTypes.add(extractEntityType(op.tag));
    }
    for (const op of this.deletes) {
      entityTypes.add(extractEntityType(op.tag));
    }

    const createsCount = this.creates.length;
    const editsCount = this.edits.length;
    const deletesCount = this.deletes.length;
    const entityTypesArray = Array.from(entityTypes);

    return {
      creates: createsCount,
      edits: editsCount,
      deletes: deletesCount,
      entityTypes: entityTypesArray,
      formatted: `[batch: ${createsCount} creates, ${editsCount} edits, ${deletesCount} deletes; types: ${entityTypesArray.join(', ')}]`,
    };
  }

  /**
   * Per-item metadata for debugging (object ids, entity types)—does not include operation counts.
   * @returns Copies of metadata gathered for each queued create, edit, and delete.
   */
  getDetailedSummary(): BatchItemDetails {
    return {
      creates: [...this.createMetas],
      edits: [...this.editMetas],
      deletes: [...this.deleteMetas],
    };
  }

  /**
   * Remove all queued operations and metadata so the builder can be reused.
   * @returns This instance for chaining.
   */
  clear(): this {
    this.creates = [];
    this.edits = [];
    this.deletes = [];
    this.createMetas = [];
    this.editMetas = [];
    this.deleteMetas = [];
    return this;
  }
}

/** Detailed metadata for all items in a batch, grouped by operation type. */
export interface BatchItemDetails {
  creates: BatchItemMeta[];
  edits: BatchItemMeta[];
  deletes: BatchItemMeta[];
}

/**
 * Extract debugging metadata from native OCF data.
 * Pulls id, and security_id for issuance types.
 */
function extractBatchItemMeta<T extends OcfEntityType>(entityType: T, data: OcfDataTypeFor<T>): BatchItemMeta {
  const meta: BatchItemMeta = { entityType, id: data.id };
  if ('security_id' in data) {
    const securityId = data.security_id;
    if (typeof securityId === 'string') {
      meta.securityId = securityId;
    }
  }
  return meta;
}

/**
 * Recursively walk an object/array tree and return the JSON-path of the first `undefined` value found.
 * Returns `undefined` (the JS value) if the tree is JSON-safe.
 *
 * This catches converter bugs where an optional TypeScript field is passed through without
 * normalization to `null`, producing a payload that fails Zod's strict JSON schema validation.
 */
function findUndefinedPath(value: unknown, currentPath: string): string | undefined {
  if (value === undefined) {
    return currentPath;
  }
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = findUndefinedPath(value[i], `${currentPath}[${i}]`);
      if (result) return result;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const result = findUndefinedPath(record[key], `${currentPath}.${key}`);
    if (result) return result;
  }
  return undefined;
}

/**
 * Build an UpdateCapTable command for batch operations.
 *
 * This is a standalone function for cases where you don't need the fluent builder.
 *
 * @param params - The batch parameters
 * @param operations - The operations to include in the batch
 * @returns The command and disclosed contracts
 */
export function buildUpdateCapTableCommand(
  params: Omit<CapTableBatchParams, 'actAs' | 'readAs'>,
  operations: CapTableBatchOperations
): CommandWithDisclosedContracts {
  const batch = new CapTableBatch({ ...params, actAs: [] });

  for (const op of operations.creates ?? []) {
    batch.createOperation(op);
  }
  for (const op of operations.edits ?? []) {
    batch.editOperation(op);
  }
  for (const op of operations.deletes ?? []) {
    batch.deleteOperation(op);
  }

  return batch.build();
}
