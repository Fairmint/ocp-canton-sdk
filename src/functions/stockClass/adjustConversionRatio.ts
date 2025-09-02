import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { ContractId } from '@daml/types';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface AdjustConversionRatioParams {
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  issuerParty: string;
  newRatio: { numerator: string | number; denominator: string | number };
  date: string; // YYYY-MM-DD
}

export interface AdjustConversionRatioResult {
  updateId: string;
}

/**
 * Adjust the ratio for a stock class ratio-based conversion mechanism.
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/adjustment/StockClassConversionRatioAdjustment.schema.json
 * - new_ratio_conversion_mechanism.ratio: New ratio to apply (numerator/denominator both > 0)
 * - date: Effective date (YYYY-MM-DD)
 */
export async function adjustConversionRatio(
  client: LedgerJsonApiClient,
  params: AdjustConversionRatioParams
): Promise<AdjustConversionRatioResult> {
  const ratio: Fairmint.OpenCapTable.Types.OcfRatio = {
    numerator:
      typeof params.newRatio.numerator === 'number'
        ? params.newRatio.numerator.toString()
        : params.newRatio.numerator,
    denominator:
      typeof params.newRatio.denominator === 'number'
        ? params.newRatio.denominator.toString()
        : params.newRatio.denominator,
  } as any;

  const choiceArgs: Fairmint.OpenCapTable.StockClass.AdjustConversionRatio = {
    new_ratio: ratio as any,
    date: `${params.date}T00:00:00.000Z`,
  } as any;

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockClass.StockClass.templateId,
          contractId: params.stockClassContractId,
          choice: 'AdjustConversionRatio',
          choiceArgument: choiceArgs,
        },
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  return { updateId: response.transactionTree.updateId };
}
