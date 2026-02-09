/**
 * Fluent batch builder for cap table updates.
 *
 * Provides a type-safe API for building batch UpdateCapTable commands that support atomic creates, edits, and deletes
 * of multiple OCF entities. Chain .create(), .edit(), and .delete() calls, then call .execute() to submit.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CommandWithDisclosedContracts } from '../../../types';
import {
  ENTITY_TAG_MAP,
  type CapTableBatchExecuteResult,
  type OcfCreateData,
  type OcfDataTypeFor,
  type OcfDeleteData,
  type OcfEditData,
  type OcfEntityType,
  type UpdateCapTableResult,
} from './batchTypes';
import { convertToDaml } from './ocfToDaml';

/** Parameters for initializing a batch update. */
export interface CapTableBatchParams {
  /** The contract ID of the CapTable to update */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
  /** Party IDs to act as (signatories) */
  actAs: string[];
  /** Optional additional party IDs for read access */
  readAs?: string[];
}

/** Metadata for a batch operation item, used for debugging and error reporting. */
export interface BatchItemMeta {
  /** The OCF entity type (e.g., 'stockIssuance', 'stakeholder') */
  entityType: string;
  /** The OCF object ID */
  ocfId: string;
  /** The security_id for issuance types (stockIssuance, convertibleIssuance, etc.) */
  securityId?: string;
}

/**
 * Fluent builder for batch cap table updates.
 *
 * Collects creates, edits, and deletes and builds them into a single UpdateCapTable command for atomic execution.
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
   * @throws OcpValidationError if type is 'issuer' (issuer is created with CapTable via IssuerAuthorization)
   */
  create<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): this {
    // Issuer is edit-only (created with CapTable via IssuerAuthorization.CreateCapTable)
    if (type === 'issuer') {
      throw new OcpValidationError(
        'type',
        'Cannot create issuer via batch - issuer is created with the CapTable via IssuerAuthorization.CreateCapTable',
        { code: OcpErrorCodes.INVALID_TYPE }
      );
    }

    const damlData = convertToDaml(type, data);
    const tag = ENTITY_TAG_MAP[type].create;
    if (!tag) {
      throw new OcpValidationError('type', `Create operation not supported for entity type: ${type}`, {
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    this.creates.push({ tag, value: damlData } as unknown as OcfCreateData);
    this.createMetas.push(extractBatchItemMeta(type, data));
    return this;
  }

  /**
   * Add an edit operation to the batch.
   *
   * @param type - The OCF entity type to edit
   * @param data - The updated native OCF data (must include the entity's id)
   * @returns This for chaining
   */
  edit<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): this {
    const damlData = convertToDaml(type, data);
    const tag = ENTITY_TAG_MAP[type].edit;
    if (!tag) {
      throw new OcpValidationError('type', `Edit operation not supported for entity type: ${type}`, {
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    this.edits.push({ tag, value: damlData } as unknown as OcfEditData);
    this.editMetas.push(extractBatchItemMeta(type, data));
    return this;
  }

  /**
   * Add a delete operation to the batch.
   *
   * @param type - The OCF entity type to delete
   * @param id - The OCF object ID to delete
   * @returns This for chaining
   * @throws OcpValidationError if type is 'issuer' (issuer cannot be deleted)
   */
  delete(type: OcfEntityType, id: string): this {
    // Issuer cannot be deleted - it must always exist for the CapTable
    if (type === 'issuer') {
      throw new OcpValidationError('type', 'Cannot delete issuer - issuer must always exist for the CapTable', {
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }

    const tag = ENTITY_TAG_MAP[type].delete;
    if (!tag) {
      throw new OcpValidationError('type', `Delete operation not supported for entity type: ${type}`, {
        code: OcpErrorCodes.INVALID_TYPE,
      });
    }
    this.deletes.push({ tag, value: id } as unknown as OcfDeleteData);
    this.deleteMetas.push({ entityType: type, ocfId: id });
    return this;
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

    // Use the templateId from capTableContractDetails when provided (from actual ledger),
    // otherwise fall back to the DAML-JS package's hardcoded templateId.
    const capTableTemplateId =
      this.params.capTableContractDetails?.templateId ?? Fairmint.OpenCapTable.CapTable.CapTable.templateId;

    const command: Command = {
      ExerciseCommand: {
        templateId: capTableTemplateId,
        contractId: this.params.capTableContractId,
        choice: 'UpdateCapTable',
        choiceArgument: {
          creates: this.creates,
          edits: this.edits,
          deletes: this.deletes,
        },
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
      response = await this.client.submitAndWaitForTransactionTree({
        commands: [command],
        commandId: `update-captable-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        actAs: this.params.actAs,
        readAs: this.params.readAs,
        disclosedContracts,
      });
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
   * Get detailed per-item metadata for all operations in the batch.
   *
   * Useful for error reporting and debugging - includes OCF IDs, entity types,
   * and key fields like security_id for issuance types.
   */
  getDetailedSummary(): BatchItemDetails {
    return {
      creates: [...this.createMetas],
      edits: [...this.editMetas],
      deletes: [...this.deleteMetas],
    };
  }

  /** Clear all operations from the batch. */
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

/** Entity types that have a security_id field. */
const ISSUANCE_ENTITY_TYPES = new Set([
  'stockIssuance',
  'convertibleIssuance',
  'equityCompensationIssuance',
  'warrantIssuance',
  'planSecurityIssuance',
]);

/**
 * Extract debugging metadata from native OCF data.
 * Pulls id, and security_id for issuance types.
 */
function extractBatchItemMeta(entityType: string, data: unknown): BatchItemMeta {
  const obj = data as Record<string, unknown> | undefined;
  const ocfId = typeof obj?.id === 'string' ? obj.id : 'unknown';
  const meta: BatchItemMeta = { entityType, ocfId };
  if (ISSUANCE_ENTITY_TYPES.has(entityType)) {
    const securityId = obj?.security_id;
    if (typeof securityId === 'string') {
      meta.securityId = securityId;
    }
  }
  return meta;
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
  operations: {
    creates?: Array<{ type: OcfEntityType; data: OcfDataTypeFor<OcfEntityType> }>;
    edits?: Array<{ type: OcfEntityType; data: OcfDataTypeFor<OcfEntityType> }>;
    deletes?: Array<{ type: OcfEntityType; id: string }>;
  }
): CommandWithDisclosedContracts {
  const batch = new CapTableBatch({ ...params, actAs: [] });

  for (const op of operations.creates ?? []) {
    batch.create(op.type, op.data);
  }
  for (const op of operations.edits ?? []) {
    batch.edit(op.type, op.data);
  }
  for (const op of operations.deletes ?? []) {
    batch.delete(op.type, op.id);
  }

  return batch.build();
}
