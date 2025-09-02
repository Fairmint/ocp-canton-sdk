import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface TransferWarrantParams {
  warrantContractId: ContractId<Fairmint.OpenCapTable.Issuer.Warrant>;
  issuerParty: string;
  toOwner: string;
  quantity: string | number;
  date: string; // YYYY-MM-DD
  considerationText?: string;
}

export interface TransferWarrantResult {
  updateId: string;
  transferEventContractId: string;
}

export async function transferWarrant(
  client: LedgerJsonApiClient,
  params: TransferWarrantParams
): Promise<TransferWarrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.Issuer.TransferWarrant = {
    to_owner: params.toOwner,
    quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity,
    date: `${params.date}T00:00:00.000Z`,
    consideration_text: params.considerationText ? { tag: 'Some', value: params.considerationText } : null,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Warrant.templateId,
          contractId: params.warrantContractId,
          choice: 'TransferWarrant',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const createdEvent = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.Issuer.WarrantTransferEvent.templateId
  ) as any;

  if (!createdEvent) throw new Error('WarrantTransferEvent not found');

  return { updateId: response.transactionTree.updateId, transferEventContractId: createdEvent.CreatedTreeEvent.value.contractId };
}
