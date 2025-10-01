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

export interface CreateStockLegendTemplateResult {
  contractId: string;
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function createStockLegendTemplate(
  client: LedgerJsonApiClient,
  params: CreateStockLegendTemplateParams
): Promise<CreateStockLegendTemplateResult> {
  const { command, disclosedContracts } = buildCreateStockLegendTemplateCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.StockLegendTemplate.StockLegendTemplate.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId,
    response
  };
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
