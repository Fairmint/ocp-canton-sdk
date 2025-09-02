import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { OcfStockLegendTemplateData } from '../../types/native';
import { stockLegendTemplateDataToDaml } from '../../utils/typeConversions';

export interface UpdateStockLegendTemplateParams {
  stockLegendTemplateContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  newTemplateData: OcfStockLegendTemplateData;
}

export interface UpdateStockLegendTemplateResult {
  contractId: string;
  updateId: string;
}

interface CreateArgShape { issuer?: string }
function hasIssuer(arg: unknown): arg is Required<CreateArgShape> {
  return !!arg && typeof arg === 'object' && typeof (arg as CreateArgShape).issuer === 'string';
}

export async function updateStockLegendTemplate(
  client: LedgerJsonApiClient,
  params: UpdateStockLegendTemplateParams
): Promise<UpdateStockLegendTemplateResult> {
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.stockLegendTemplateContractId
  });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  if (!hasIssuer(createArgument)) {
    throw new Error('Issuer party not found in contract create argument');
  }
  const issuerParty = createArgument.issuer;

  const choiceArguments: Fairmint.OpenCapTable.StockLegendTemplate.UpdateStockLegendTemplate = {
    new_template_data: stockLegendTemplateDataToDaml(params.newTemplateData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.StockLegendTemplate.StockLegendTemplate.templateId,
          contractId: params.stockLegendTemplateContractId,
          choice: 'UpdateStockLegendTemplate',
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

  const event = response.transactionTree.eventsById[1];
  if ('CreatedTreeEvent' in event) {
    return {
      contractId: event.CreatedTreeEvent.value.contractId,
      updateId: response.transactionTree.updateId
    };
  } else {
    throw new Error('Expected CreatedTreeEvent not found');
  }
}
