import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

/** @deprecated Use DeleteEquityCompensationExerciseParams and buildDeleteEquityCompensationExerciseCommand instead */
export interface ArchiveEquityCompensationExerciseByIssuerParams {
  contractId: string;
  issuerParty: string;
}

/**
 * @deprecated This function is no longer functional. Use buildDeleteEquityCompensationExerciseCommand instead.
 *
 * With the new CapTable pattern, deletion requires:
 * - capTableContractId: The CapTable contract ID
 * - featuredAppRightContractDetails: Disclosed contract details
 * - equityCompensationExerciseId: The OCF ID of the equity compensation exercise to delete
 *
 * @throws Error Always throws - use buildDeleteEquityCompensationExerciseCommand instead
 */
export function buildArchiveEquityCompensationExerciseByIssuerCommand(_params: { contractId: string }): Command {
  throw new Error(
    'buildArchiveEquityCompensationExerciseByIssuerCommand is deprecated and no longer functional. ' +
      'Use buildDeleteEquityCompensationExerciseCommand instead, which uses the CapTable.DeleteEquityCompensationExercise choice.'
  );
}
