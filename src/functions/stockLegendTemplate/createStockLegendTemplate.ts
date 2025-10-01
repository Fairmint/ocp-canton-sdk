import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockLegendTemplateData, CommandWithDisclosedContracts } from '../../types';

function stockLegendTemplateDataToDaml(data: OcfStockLegendTemplateData): Fairmint.OpenCapTable.StockLegendTemplate.OcfStockLegendTemplateData {
  if (!data.id) throw new Error('stockLegendTemplate.id is required');
  return {
    id: data.id,
    name: data.name,
    text: data.text,
    comments: data.comments || []
  };
}

export interface CreateStockLegendTemplateParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  templateData: OcfStockLegendTemplateData;
}

export function buildCreateStockLegendTemplateCommand(params: CreateStockLegendTemplateParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockLegendTemplate = {
    template_data: stockLegendTemplateDataToDaml(params.templateData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockLegendTemplate',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}
