/**
 * High-level CapTable archive operation.
 *
 * Two-step process:
 * 1. Delete all non-issuer OCF entities via UpdateCapTable (issuer party, typically 5n provider)
 * 2. Archive the now-empty CapTable via ArchiveCapTable (system_operator party, typically intellect)
 *
 * This function is consumed by:
 * - canton-explorer archive API route
 * - canton CLI archiveCapTable script
 * - canton replicateCapTable issuer-swap flow
 *
 * @module archiveFullCapTable
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../../errors/codes';
import { OcpContractError } from '../../../errors/OcpContractError';
import { archiveCapTable } from './archiveCapTable';
import type { OcfEntityType } from './batchTypes';
import { CapTableBatch } from './CapTableBatch';

/** Minimal contract state needed for the archive operation. */
export interface ArchiveCapTableEntities {
  capTableContractId: string;
  entities: Map<OcfEntityType, Set<string>>;
}

/** Result of archiving a CapTable. */
export interface ArchiveFullCapTableResult {
  archiveUpdateId: string;
  deletedEntityCount: number;
}

/** Options for the archive operation. */
export interface ArchiveFullCapTableOptions {
  /**
   * Pre-resolved system_operator party ID. When provided, skips the Canton API call
   * to read it from the live contract (useful when the caller already has it from a DB query).
   */
  systemOperatorPartyId?: string;
}

/**
 * Read the system_operator party ID from the live CapTable contract on Canton.
 *
 * Only needed when the caller doesn't already have the party ID from another source
 * (e.g., a database query). The explorer route resolves parties from the DB, while the
 * CLI script and replication loop use this function.
 */
export async function getSystemOperatorPartyId(client: LedgerJsonApiClient, issuerPartyId: string): Promise<string> {
  const contracts = await client.getActiveContracts({
    parties: [issuerPartyId],
    templateIds: [Fairmint.OpenCapTable.CapTable.CapTable.templateId],
  });

  if (contracts.length === 0) {
    throw new OcpContractError('No CapTable contract found when reading system_operator party', {
      code: OcpErrorCodes.CONTRACT_NOT_FOUND,
      contractId: 'unknown',
    });
  }

  const contract = contracts[0];
  const contractEntry = contract.contractEntry as Record<string, unknown>;
  const jsActiveContract = (contractEntry as { JsActiveContract?: Record<string, unknown> }).JsActiveContract;
  if (!jsActiveContract) {
    throw new OcpContractError('Invalid CapTable contract response: missing JsActiveContract', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }

  const createdEvent = jsActiveContract.createdEvent as Record<string, unknown> | undefined;
  const createArgument = createdEvent?.createArgument as Record<string, unknown> | undefined;
  const context = createArgument?.context as Record<string, unknown> | undefined;
  const systemOperator = context?.system_operator;

  if (typeof systemOperator !== 'string') {
    throw new OcpContractError(`CapTable contract missing context.system_operator (got ${typeof systemOperator})`, {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: 'unknown',
    });
  }

  return systemOperator;
}

/**
 * Delete all non-issuer entities and archive the CapTable contract.
 *
 * @param deleteClient - LedgerJsonApiClient for entity deletes (must have issuer party credentials, typically 5n)
 * @param archiveClient - LedgerJsonApiClient for archive + system_operator read (must have system_operator credentials, typically intellect)
 * @param issuerPartyId - The issuer party ID that controls UpdateCapTable
 * @param cantonState - Current cap table state with entity maps
 * @param options - Optional overrides (e.g., pre-resolved systemOperatorPartyId)
 */
export async function archiveFullCapTable(
  deleteClient: LedgerJsonApiClient,
  archiveClient: LedgerJsonApiClient,
  issuerPartyId: string,
  cantonState: ArchiveCapTableEntities,
  options: ArchiveFullCapTableOptions = {}
): Promise<ArchiveFullCapTableResult> {
  let deletableEntityCount = 0;
  for (const [entityType, ids] of cantonState.entities.entries()) {
    if (entityType === 'issuer') continue;
    deletableEntityCount += ids.size;
  }

  let currentCapTableCid = cantonState.capTableContractId;

  // Step 1: Delete all non-issuer entities
  if (deletableEntityCount > 0) {
    const batch = new CapTableBatch(
      {
        capTableContractId: currentCapTableCid,
        actAs: [issuerPartyId],
      },
      deleteClient
    );

    for (const [entityType, ids] of cantonState.entities.entries()) {
      if (entityType === 'issuer') continue;
      for (const ocfId of ids) {
        batch.delete(entityType, ocfId);
      }
    }

    const result = await batch.execute();
    if (!result.updatedCapTableCid) {
      throw new Error('Batch delete succeeded but updatedCapTableCid is missing');
    }
    currentCapTableCid = result.updatedCapTableCid;
  }

  // Step 2: Archive the empty CapTable
  const systemOperatorPartyId =
    options.systemOperatorPartyId ?? (await getSystemOperatorPartyId(archiveClient, issuerPartyId));

  const { updateId } = await archiveCapTable(archiveClient, {
    capTableContractId: currentCapTableCid,
    actAs: [systemOperatorPartyId],
  });

  return { archiveUpdateId: updateId, deletedEntityCount: deletableEntityCount };
}
