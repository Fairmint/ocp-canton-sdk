import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface TransferConvertibleParams {
  convertibleContractId: ContractId<Fairmint.OpenCapTable.Issuer.Convertible>;
  issuerParty: string;
  toOwner: string;
  amount: { amount: string | number; currency: string };
  date: string; // YYYY-MM-DD
  considerationText?: string;
}

export interface TransferConvertibleResult {
  updateId: string;
  newConvertibleContractId: string;
  transferEventContractId: string;
}

/**
 * Transfer a convertible to a new stakeholder (records transfer event and creates a new convertible contract).
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/transfer/ConvertibleTransfer.schema.json
 */
export async function transferConvertible(
  client: LedgerJsonApiClient,
  params: TransferConvertibleParams
): Promise<TransferConvertibleResult> {
  const monetary: Fairmint.OpenCapTable.Types.OcfMonetary = {
    amount: typeof params.amount.amount === 'number' ? params.amount.amount.toString() : params.amount.amount,
    currency: params.amount.currency,
  } as any;

  const choiceArgs: Fairmint.OpenCapTable.Issuer.Transfer = {
    to_owner: params.toOwner,
    amount: monetary as any,
    date: `${params.date}T00:00:00.000Z`,
    consideration_text: params.considerationText ? { tag: 'Some', value: params.considerationText } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Convertible.templateId,
          contractId: params.convertibleContractId,
          choice: 'Transfer',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const createdConvertible = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.Convertible.templateId
  ) as any;

  const createdEvent = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.ConvertibleTransferEvent.templateId
  ) as any;

  if (!createdConvertible) throw new Error('New Convertible not found');
  if (!createdEvent) throw new Error('ConvertibleTransferEvent not found');

  return {
    updateId: response.transactionTree.updateId,
    newConvertibleContractId: createdConvertible.CreatedTreeEvent.value.contractId,
    transferEventContractId: createdEvent.CreatedTreeEvent.value.contractId,
  };
}
