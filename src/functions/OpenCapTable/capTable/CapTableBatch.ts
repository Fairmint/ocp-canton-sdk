/**
 * Fluent batch builder for cap table updates.
 *
 * Provides a type-safe API for building batch UpdateCapTable commands that support atomic creates, edits, and deletes
 * of multiple OCF entities.
 *
 * @example
 *   ```typescript
 *
 *   const result = await ocp.capTable
 *     .update({
 *       capTableContractId,
 *       featuredAppRightContractDetails,
 *     })
 *     .create('stakeholder', stakeholderData)
 *     .create('stockClass', stockClassData)
 *     .edit('stakeholder', updatedStakeholderData)
 *     .delete('document', documentId)
 *     .execute();
 *   ```;
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';
import {
  ENTITY_TAG_MAP,
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
  /** Disclosed contract details for the FeaturedAppRight */
  featuredAppRightContractDetails: DisclosedContract;
  /** Optional disclosed contract details for the CapTable (for correct templateId) */
  capTableContractDetails?: DisclosedContract;
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
   * @example
   *   ```typescript
   *
   *   batch.create('stakeholder', {
   *     id: 'sh-123',
   *     name: { legal_name: 'John Doe' },
   *     stakeholder_type: 'INDIVIDUAL',
   *   });
   *   ```;
   *
   * @param type - The OCF entity type to create
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
   * @example
   *   ```typescript
   *
   *   batch.edit('stakeholder', {
   *     id: 'sh-123',
   *     name: { legal_name: 'Jane Doe' },
   *     stakeholder_type: 'INDIVIDUAL',
   *   });
   *   ```;
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
   * @example
   *   ```typescript
   *
   *   batch.delete('document', 'doc-123');
   *   ```;
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
      throw new Error('Cannot build empty batch - add at least one create, edit, or delete operation');
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

    const disclosedContracts: DisclosedContract[] = [
      {
        templateId: this.params.featuredAppRightContractDetails.templateId,
        contractId: this.params.featuredAppRightContractDetails.contractId,
        createdEventBlob: this.params.featuredAppRightContractDetails.createdEventBlob,
        synchronizerId: this.params.featuredAppRightContractDetails.synchronizerId,
      },
    ];

    return { command, disclosedContracts };
  }

  /**
   * Build and execute the batch update.
   *
   * @returns The result containing the updated cap table contract ID and affected entity IDs
   * @throws Error if no client was provided or if the batch is empty
   */
  async execute(): Promise<UpdateCapTableResult> {
    if (!this.client) {
      throw new Error('Cannot execute batch without a client - use build() instead and submit manually');
    }

    const { command, disclosedContracts } = this.build();

    const response = await this.client.submitAndWaitForTransactionTree({
      commands: [command],
      actAs: this.params.actAs,
      readAs: this.params.readAs,
      disclosedContracts,
    });

    // Extract the result from the transaction tree
    const tree = response.transactionTree;
    const { eventsById } = tree;

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
          return exercised.exerciseResult;
        }
      }
    }

    throw new Error('UpdateCapTable result not found in transaction tree');
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
