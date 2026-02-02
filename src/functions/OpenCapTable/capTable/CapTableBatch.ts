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
import { extractUpdateId } from '../../../utils/typeConversions';
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
   */
  create<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): this {
    const damlData = convertToDaml(type, data);
    const tag = ENTITY_TAG_MAP[type].create;
    this.creates.push({ tag, value: damlData } as unknown as OcfCreateData);
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
    this.edits.push({ tag, value: damlData } as unknown as OcfEditData);
    return this;
  }

  /**
   * Add a delete operation to the batch.
   *
   * @param type - The OCF entity type to delete
   * @param id - The OCF object ID to delete
   * @returns This for chaining
   */
  delete(type: OcfEntityType, id: string): this {
    const tag = ENTITY_TAG_MAP[type].delete;
    this.deletes.push({ tag, value: id } as unknown as OcfDeleteData);
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

    let response;
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
      const contextMessage = `Batch execution failed: ${originalMessage} ${batchSummary.formatted}`;

      throw new OcpContractError(contextMessage, {
        contractId: this.params.capTableContractId,
        choice: 'UpdateCapTable',
        cause: error instanceof Error ? error : new Error(String(error)),
        code: OcpErrorCodes.CHOICE_FAILED,
      });
    }

    // Extract the result from the transaction tree
    const tree = response.transactionTree;
    const { eventsById } = tree;
    const updateId = extractUpdateId(response);

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

  /** Clear all operations from the batch. */
  clear(): this {
    this.creates = [];
    this.edits = [];
    this.deletes = [];
    return this;
  }
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
