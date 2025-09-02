import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AdjustIssuerAuthorizedSharesParams {
  issuerContractId: ContractId<Fairmint.OpenCapTable.Issuer.Issuer>;
  issuerParty: string;
  newAuthorized: string | number;
  date: string; // YYYY-MM-DD
}

export interface AdjustIssuerAuthorizedSharesResult {
  updateId: string;
}

/**
 * Adjust issuer-level authorized shares.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json
 * - new_authorized: New authorized shares amount (numeric only)
 * - date: Effective date (YYYY-MM-DD)
 */
export async function adjustIssuerAuthorizedShares(
  client: LedgerJsonApiClient,
  params: AdjustIssuerAuthorizedSharesParams
): Promise<AdjustIssuerAuthorizedSharesResult> {
  const choiceArgs: Fairmint.OpenCapTable.Issuer.AdjustAuthorizedShares = {
    new_authorized:
      typeof params.newAuthorized === 'number'
        ? params.newAuthorized.toString()
        : params.newAuthorized,
    date: `${params.date}T00:00:00.000Z`,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'AdjustAuthorizedShares',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}
