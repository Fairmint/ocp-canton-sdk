import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface CancelConvertibleParams {
  convertibleContractId: ContractId<Fairmint.OpenCapTable.Issuer.Convertible>;
  issuerParty: string;
  amount: { amount: string | number; currency: string };
  date: string; // YYYY-MM-DD
  reasonText?: string;
}

export interface CancelConvertibleResult {
  updateId: string;
  cancellationEventContractId: string;
}

/**
 * Cancel part or all of a convertible's monetary amount.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/cancellation/ConvertibleCancellation.schema.json
 */
export async function cancelConvertible(
  client: LedgerJsonApiClient,
  params: CancelConvertibleParams
): Promise<CancelConvertibleResult> {
  const monetary: Fairmint.OpenCapTable.Types.OcfMonetary = {
    amount: typeof params.amount.amount === 'number' ? params.amount.amount.toString() : params.amount.amount,
    currency: params.amount.currency,
  } as any;

  const choiceArgs: Fairmint.OpenCapTable.Issuer.Cancel = {
    amount: monetary as any,
    date: `${params.date}T00:00:00.000Z`,
    reason_text: params.reasonText ? { tag: 'Some', value: params.reasonText } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Convertible.templateId,
          contractId: params.convertibleContractId,
          choice: 'Cancel',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.ConvertibleCancellation.templateId
  ) as any;

  if (!created) throw new Error('ConvertibleCancellation not found');

  return { updateId: response.transactionTree.updateId, cancellationEventContractId: created.CreatedTreeEvent.value.contractId };
}
