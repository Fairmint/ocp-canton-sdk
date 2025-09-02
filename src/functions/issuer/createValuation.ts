import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';
import type { ContractId } from '@daml/types';
import { ContractDetails } from '../../types/contractDetails';
import { OcfValuationData } from '../../types/native';
import { valuationDataToDaml } from '../../utils/typeConversions';

export interface CreateValuationParams {
  issuerContractId: string;
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  valuationData: OcfValuationData;
}

export interface CreateValuationResult {
  contractId: string;
  updateId: string;
}

/**
 * Create a valuation by exercising the CreateValuation choice on an Issuer contract
 *
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/Valuation.schema.json
 * - price_per_share: Monetary amount (amount, currency)
 * - effective_date: Valuation effective date (YYYY-MM-DD)
 * - valuation_type: e.g., '409A'
 * - provider (optional): Provider name
 * - board_approval_date (optional): Date board approved valuation
 * - stockholder_approval_date (optional): Date stockholders approved valuation
 * - comments (optional)
 */
export async function createValuation(
  client: LedgerJsonApiClient,
  params: CreateValuationParams
): Promise<CreateValuationResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateValuation = {
    stock_class: params.stockClassContractId,
    valuation_data: valuationDataToDaml(params.valuationData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateValuation',
          choiceArgument: choiceArguments
        }
      }
    ],
    disclosedContracts: [
      {
        templateId: params.featuredAppRightContractDetails.templateId,
        contractId: params.featuredAppRightContractDetails.contractId,
        createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
        synchronizerId: params.featuredAppRightContractDetails.synchronizerId
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.Valuation.Valuation.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}
