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
import { submitObservedTransactionTree, type CommandObservabilityOptions } from '../../../observability';
import type { CapTableContractDetails, CommandWithDisclosedContracts } from '../../../types/common';
import {
  optionalCommandParameter,
  requiredCommandParameter,
  requiredContractId,
  snapshotCapTableContractDetails,
  snapshotPartyIdArray,
} from '../../../utils/commandParameters';
import { commandCarrierKeys, snapshotExactCommandCarrier } from '../../../utils/observabilityConfig';
import { buildCapTableCommand } from './buildCapTableCommand';

const ARCHIVE_CAP_TABLE_KEYS = commandCarrierKeys(['capTableContractId', 'capTableContractDetails', 'actAs', 'readAs']);

/** Parameters for archiving a CapTable contract. */
export interface ArchiveCapTableParams extends CommandObservabilityOptions {
  /** The contract ID of the CapTable to archive */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: CapTableContractDetails;
  /** Party IDs to act as — must include the system_operator party */
  actAs: readonly string[];
  /** Optional additional party IDs for read access */
  readAs?: readonly string[];
}

/** Result of archiving a CapTable contract. */
export interface ArchiveCapTableResult {
  /** The transaction ID from the Canton ledger */
  updateId: string;
}

function snapshotArchiveCapTableParams(
  value: unknown,
  root: string
): {
  readonly params: ArchiveCapTableParams;
  readonly observability: Readonly<CommandObservabilityOptions> | undefined;
} {
  const carrier = snapshotExactCommandCarrier(value, ARCHIVE_CAP_TABLE_KEYS, root);
  const capTableContractId = requiredContractId(
    requiredCommandParameter(carrier.snapshot, 'capTableContractId', root),
    `${root}.capTableContractId`
  );
  const contractDetailsValue = optionalCommandParameter(carrier.snapshot, 'capTableContractDetails', root);
  const capTableContractDetails =
    contractDetailsValue === undefined
      ? undefined
      : snapshotCapTableContractDetails(contractDetailsValue, `${root}.capTableContractDetails`, capTableContractId);
  const actAs = snapshotPartyIdArray(requiredCommandParameter(carrier.snapshot, 'actAs', root), `${root}.actAs`, {
    nonEmpty: true,
  });
  const readAsValue = optionalCommandParameter(carrier.snapshot, 'readAs', root);
  const readAs = readAsValue === undefined ? undefined : snapshotPartyIdArray(readAsValue, `${root}.readAs`);
  const params: ArchiveCapTableParams = {
    capTableContractId,
    ...(capTableContractDetails === undefined ? {} : { capTableContractDetails }),
    actAs,
    ...(readAs === undefined ? {} : { readAs }),
    ...carrier.observability,
  };
  Object.freeze(params);
  return Object.freeze({ params, observability: carrier.observability });
}

function buildArchiveCapTableCommandFromSnapshot(params: ArchiveCapTableParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    ...(params.capTableContractDetails === undefined
      ? {}
      : { capTableContractDetails: params.capTableContractDetails }),
    choice: 'ArchiveCapTable',
    choiceArgument: {},
  });
}

/**
 * Build an ExerciseCommand for the ArchiveCapTable choice.
 *
 * Use this when you need to include the archive command in a manual transaction batch.
 * For direct execution, use {@link archiveCapTable} instead.
 */
export function buildArchiveCapTableCommand(params: ArchiveCapTableParams): CommandWithDisclosedContracts {
  return buildArchiveCapTableCommandFromSnapshot(
    snapshotArchiveCapTableParams(params, 'buildArchiveCapTableCommand').params
  );
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
  const { params: safeParams, observability } = snapshotArchiveCapTableParams(params, 'archiveCapTable');
  const { actAs, readAs } = safeParams;

  const { command, disclosedContracts } = buildArchiveCapTableCommandFromSnapshot(safeParams);

  const templateId = 'ExerciseCommand' in command ? command.ExerciseCommand.templateId : undefined;
  const result = await submitObservedTransactionTree(
    client,
    {
      actAs: [...actAs],
      ...(readAs === undefined ? {} : { readAs: [...readAs] }),
      commands: [command],
      disclosedContracts,
    },
    observability,
    {
      operation: 'archiveCapTable',
      ...(templateId === undefined ? {} : { templateId }),
      choice: 'ArchiveCapTable',
    }
  );

  return { updateId: result.transactionTree.updateId };
}
