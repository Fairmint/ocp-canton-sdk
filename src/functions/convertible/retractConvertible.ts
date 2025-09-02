import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface RetractConvertibleParams {
  convertibleContractId: ContractId<Fairmint.OpenCapTable.Issuer.Convertible>;
  stakeholderParty: string;
  date: string; // YYYY-MM-DD
  reasonText?: string;
}

export interface RetractConvertibleResult {
  updateId: string;
  retractionEventContractId: string;
}

/**
 * Retract a convertible (holder-driven).
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/retraction/ConvertibleRetraction.schema.json
 */
export async function retractConvertible(
  client: LedgerJsonApiClient,
  params: RetractConvertibleParams
): Promise<RetractConvertibleResult> {
  const choiceArgs: Fairmint.OpenCapTable.Issuer.Retract = {
    date: `${params.date}T00:00:00.000Z`,
    reason_text: params.reasonText ? { tag: 'Some', value: params.reasonText } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.stakeholderParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Convertible.templateId,
          contractId: params.convertibleContractId,
          choice: 'Retract',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.ConvertibleRetraction.templateId
  ) as any;

  if (!created) throw new Error('ConvertibleRetraction not found');

  return { updateId: response.transactionTree.updateId, retractionEventContractId: created.CreatedTreeEvent.value.contractId };
}
