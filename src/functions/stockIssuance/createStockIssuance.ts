import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockIssuanceData } from '../../types/native';
import { stockIssuanceDataToDaml } from '../../utils/typeConversions';

export interface CreateStockIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  issuanceData: OcfStockIssuanceData;
}

export interface CreateStockIssuanceResult {
  contractId: string;
  updateId: string;
}

export async function createStockIssuance(
  client: LedgerJsonApiClient,
  params: CreateStockIssuanceParams
): Promise<CreateStockIssuanceResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockIssuance = {
    issuance_data: stockIssuanceDataToDaml(params.issuanceData)
  };

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateStockIssuance',
          choiceArgument: choiceArguments as any
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
  })) as SubmitAndWaitForTransactionTreeResponse;

  const createdEvents = response.transactionTree.eventsById;
  const created = Object.values(createdEvents).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.StockIssuance.StockIssuance')
  ) as any;
  if (!created) throw new Error('Expected StockIssuance CreatedTreeEvent not found');
  const contractId = created.CreatedTreeEvent.value.contractId as string;

  return { contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateStockIssuanceCommand(params: CreateStockIssuanceParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockIssuance = {
    issuance_data: stockIssuanceDataToDaml(params.issuanceData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockIssuance',
      choiceArgument: choiceArguments as any
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


