import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface TransferGrantParams {
  planSecurityContractId: ContractId<Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant>;
  issuerParty: string;
  toOwner: string;
  quantity: string | number;
  date: string; // YYYY-MM-DD
  considerationText?: string;
}

export interface TransferGrantResult {
  updateId: string;
  transferEventContractId: string;
}

/**
 * Record transfer of an equity compensation grant.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/transfer/EquityCompensationTransfer.schema.json
 */
export async function transferGrant(
  client: LedgerJsonApiClient,
  params: TransferGrantParams
): Promise<TransferGrantResult> {
  const choiceArgs: Fairmint.OpenCapTable.StockPlan.TransferGrant = {
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
          templateId: Fairmint.OpenCapTable.StockPlan.PlanSecurityGrant.templateId,
          contractId: params.planSecurityContractId,
          choice: 'TransferGrant',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  const createdEvent = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockPlan.PlanSecurityTransferEvent.templateId
  ) as any;

  if (!createdEvent) throw new Error('PlanSecurityTransferEvent not found');

  return { updateId: response.transactionTree.updateId, transferEventContractId: createdEvent.CreatedTreeEvent.value.contractId };
}
