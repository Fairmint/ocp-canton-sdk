import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AcceptConvertibleParams {
  convertibleContractId: ContractId<Fairmint.OpenCapTable.Issuer.Convertible>;
  stakeholderParty: string; // acts as controller
  date: string; // YYYY-MM-DD
}

export interface AcceptConvertibleResult {
  updateId: string;
  acceptanceEventContractId: string;
}

/**
 * Record acceptance of a convertible security.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/acceptance/ConvertibleAcceptance.schema.json
 */
export async function acceptConvertible(
  client: LedgerJsonApiClient,
  params: AcceptConvertibleParams
): Promise<AcceptConvertibleResult> {
  const choiceArgs: Fairmint.OpenCapTable.Issuer.Accept = {
    date: `${params.date}T00:00:00.000Z`,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.stakeholderParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Convertible.templateId,
          contractId: params.convertibleContractId,
          choice: 'Accept',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.ConvertibleAcceptance.templateId
  ) as any;

  if (!created) throw new Error('ConvertibleAcceptance not found');

  return { updateId: response.transactionTree.updateId, acceptanceEventContractId: created.CreatedTreeEvent.value.contractId };
}
