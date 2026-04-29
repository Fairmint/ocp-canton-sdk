/**
 * Archive a CapTable contract.
 *
 * Exercises the ArchiveCapTable choice which is controlled by system_operator.
 * Requires all entity maps to be empty (caller must delete entities first via UpdateCapTable).
 * The choice archives the issuer contract and then the CapTable self-archives (consuming choice).
 *
 * @module archiveCapTable
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from './buildCapTableCommand';

/** Parameters for archiving a CapTable contract. */
export interface ArchiveCapTableParams {
  /** The contract ID of the CapTable to archive */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
  /** Party IDs to act as — must include the system_operator party */
  actAs: string[];
  /** Optional additional party IDs for read access */
  readAs?: string[];
}

/** Result of archiving a CapTable contract. */
export interface ArchiveCapTableResult {
  /** The transaction ID from the Canton ledger */
  updateId: string;
}

/**
 * Build an ExerciseCommand for the ArchiveCapTable choice.
 *
 * Use this when you need to include the archive command in a manual transaction batch.
 * For direct execution, use {@link archiveCapTable} instead.
 */
export function buildArchiveCapTableCommand(params: ArchiveCapTableParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'ArchiveCapTable',
    choiceArgument: {},
  });
}

/**
 * Archive a CapTable contract by exercising the ArchiveCapTable choice.
 *
 * This is a consuming choice controlled by `context.system_operator`. It:
 * 1. Asserts all entity maps are empty (fails if any entities remain)
 * 2. Archives the issuer contract
 * 3. Self-archives the CapTable contract
 *
 * @param client - LedgerJsonApiClient instance (must have system_operator credentials)
 * @param params - Archive parameters including contract ID and actAs parties
 * @returns The transaction ID
 * @throws OcpValidationError if `capTableContractId` is missing
 * @throws OcpContractError when the ledger rejects the archive choice (non-empty maps, wrong actor, etc.)
 *
 * @example
 * ```typescript
 * // Archive after deleting all entities
 * const result = await archiveCapTable(client, {
 *   capTableContractId: '00...',
 *   actAs: [systemOperatorPartyId],
 * });
 * ```
 */
export async function archiveCapTable(
  client: LedgerJsonApiClient,
  params: ArchiveCapTableParams
): Promise<ArchiveCapTableResult> {
  if (!params.capTableContractId) {
    throw new OcpValidationError(
      'archiveCapTable.capTableContractId',
      'capTableContractId is required to archive a cap table.',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: params.capTableContractId }
    );
  }
  if (!Array.isArray(params.actAs) || params.actAs.length === 0) {
    throw new OcpValidationError('archiveCapTable.actAs', 'actAs must include at least the system_operator party.', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: params.actAs,
    });
  }

  const { command, disclosedContracts } = buildArchiveCapTableCommand(params);

  const result = await client.submitAndWaitForTransactionTree({
    actAs: params.actAs,
    readAs: params.readAs,
    commands: [command],
    disclosedContracts,
  });

  return { updateId: result.transactionTree.updateId };
}
