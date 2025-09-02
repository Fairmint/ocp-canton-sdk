import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface ConvertConvertibleParams {
  convertibleContractId: string;
  issuerParty: string;
  stockClassContractId: string;
  quantity: string | number;
  date: string; // YYYY-MM-DD
}

export interface ConvertConvertibleResult {
  updateId: string;
  stockPositionContractId: string;
}

/**
 * Convert a convertible into stock by exercising the Convert choice on a Convertible
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/conversion/ConvertibleConversion.schema.json
 */
export async function convertConvertible(
  client: LedgerJsonApiClient,
  params: ConvertConvertibleParams
): Promise<ConvertConvertibleResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.Convert = {
    stock_class: params.stockClassContractId,
    quantity: typeof params.quantity === 'number' ? params.quantity.toString() : params.quantity,
    date: `${params.date}T00:00:00.000Z`
  } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Convertible.templateId,
          contractId: params.convertibleContractId,
          choice: 'Convert',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find(
    (e: any) => 'CreatedTreeEvent' in e && e.CreatedTreeEvent.value.templateId === Fairmint.OpenCapTable.StockClass.StockPosition.templateId
  ) as any;

  if (!created) throw new Error('StockPosition not found');

  return { updateId: response.transactionTree.updateId, stockPositionContractId: created.CreatedTreeEvent.value.contractId };
}
