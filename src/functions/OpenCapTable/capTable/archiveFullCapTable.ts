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
import { OcpErrorCodes } from '../../../errors/codes';
import { OcpContractError } from '../../../errors/OcpContractError';
import { archiveCapTable } from './archiveCapTable';
import type { OcfEntityType } from './batchTypes';
import { CapTableBatch } from './CapTableBatch';
import { discoverCapTables, type DiscoveredCapTableState } from './getCapTableState';

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

interface ResolvedArchiveCapTableContext {
  readonly templateId: string;
  readonly systemOperatorPartyId: string;
}

function getArchiveMatchByContractId(
  matches: readonly DiscoveredCapTableState[],
  expectedCapTableContractId?: string
): DiscoveredCapTableState | null {
  if (!expectedCapTableContractId) {
    return null;
  }

  const matchedContracts = matches.filter((match) => match.capTableContractId === expectedCapTableContractId);
  return matchedContracts.length === 1 ? matchedContracts[0] : null;
}

function getSingletonArchiveMatch(discovery: {
  status: 'target' | 'legacy-only' | 'none' | 'multiple';
  targetMatch: DiscoveredCapTableState | null;
  legacyMatch: DiscoveredCapTableState | null;
}): DiscoveredCapTableState | null {
  if (discovery.status === 'target') {
    return discovery.targetMatch;
  }

  if (discovery.status === 'legacy-only') {
    return discovery.legacyMatch;
  }

  return null;
}

async function resolveArchiveCapTableContext(
  client: LedgerJsonApiClient,
  issuerPartyId: string,
  expectedCapTableContractId?: string
): Promise<ResolvedArchiveCapTableContext> {
  const discovery = await discoverCapTables(client, { issuerPartyId });
  const matchedContract =
    getArchiveMatchByContractId(discovery.matches, expectedCapTableContractId) ?? getSingletonArchiveMatch(discovery);

  if (!matchedContract) {
    if (discovery.status === 'none') {
      throw new OcpContractError('No CapTable contract found when reading archive context', {
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        contractId: expectedCapTableContractId ?? 'unknown',
      });
    }

    throw new OcpContractError('Expected exactly one CapTable contract when reading archive context', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: expectedCapTableContractId ?? 'unknown',
    });
  }

  if (matchedContract.templateId.length === 0) {
    throw new OcpContractError('CapTable contract missing templateId when reading archive context', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: matchedContract.capTableContractId,
    });
  }

  if (typeof matchedContract.systemOperatorPartyId !== 'string' || matchedContract.systemOperatorPartyId.length === 0) {
    throw new OcpContractError('CapTable contract missing context.system_operator', {
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      contractId: matchedContract.capTableContractId,
      templateId: matchedContract.templateId,
    });
  }

  return {
    templateId: matchedContract.templateId,
    systemOperatorPartyId: matchedContract.systemOperatorPartyId,
  };
}

/**
 * Read the system_operator party ID from the live CapTable contract on Canton.
 *
 * Only needed when the caller doesn't already have the party ID from another source
 * (e.g., a database query). The explorer route resolves parties from the DB, while the
 * CLI script and replication loop use this function.
 */
export async function getSystemOperatorPartyId(client: LedgerJsonApiClient, issuerPartyId: string): Promise<string> {
  const archiveContext = await resolveArchiveCapTableContext(client, issuerPartyId);
  return archiveContext.systemOperatorPartyId;
}

/**
 * Delete all non-issuer entities and archive the CapTable contract.
 *
 * @param deleteClient - LedgerJsonApiClient for entity deletes (must have issuer party credentials, typically 5n)
 * @param archiveClient - LedgerJsonApiClient for archive (must have system_operator credentials, typically intellect)
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
  const archiveContext = await resolveArchiveCapTableContext(
    deleteClient,
    issuerPartyId,
    cantonState.capTableContractId
  );
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
        capTableContractDetails: { templateId: archiveContext.templateId },
        actAs: [issuerPartyId],
      },
      deleteClient
    );

    for (const [entityType, ids] of cantonState.entities.entries()) {
      if (entityType === 'issuer') continue;
      for (const id of ids) {
        batch.delete(entityType, id);
      }
    }

    const result = await batch.execute();
    if (!result.updatedCapTableCid) {
      throw new Error('Batch delete succeeded but updatedCapTableCid is missing');
    }
    currentCapTableCid = result.updatedCapTableCid;
  }

  // Step 2: Archive the empty CapTable
  const systemOperatorPartyId = options.systemOperatorPartyId ?? archiveContext.systemOperatorPartyId;

  const { updateId } = await archiveCapTable(archiveClient, {
    capTableContractId: currentCapTableCid,
    capTableContractDetails: { templateId: archiveContext.templateId },
    actAs: [systemOperatorPartyId],
  });

  return { archiveUpdateId: updateId, deletedEntityCount: deletableEntityCount };
}
