import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { cleanComments } from '../../utils/typeConversions';
import type { OcfStockLegendTemplateData, CommandWithDisclosedContracts } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

function stockLegendTemplateDataToDaml(
  data: OcfStockLegendTemplateData
): Fairmint.OpenCapTable.StockLegendTemplate.OcfStockLegendTemplateData {
  cleanComments(data);
  if (!data.id) throw new Error('stockLegendTemplate.id is required');
  return {
    id: data.id,
    name: data.name,
    text: data.text,
    comments: data.comments || [],
  };
}

export interface CreateStockLegendTemplateParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  templateData: OcfStockLegendTemplateData;
}

export function buildCreateStockLegendTemplateCommand(
  params: CreateStockLegendTemplateParams
): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockLegendTemplate = {
    template_data: stockLegendTemplateDataToDaml(params.templateData),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockLegendTemplate',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
