import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockIssuanceData, CommandWithDisclosedContracts } from '../../types';
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
  response: SubmitAndWaitForTransactionTreeResponse;
}

export async function createStockIssuance(
  client: LedgerJsonApiClient,
  params: CreateStockIssuanceParams
): Promise<CreateStockIssuanceResult> {
  const { command, disclosedContracts } = buildCreateStockIssuanceCommand(params);

  const response = (await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  })) as SubmitAndWaitForTransactionTreeResponse;

  const createdEvents = (response.transactionTree as any)?.eventsById ?? (response.transactionTree as any)?.transaction?.eventsById;
  const created = Object.values(createdEvents).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.StockIssuance:StockIssuance');
  }) as any;
  if (!created) throw new Error('Expected StockIssuance CreatedTreeEvent not found');
  const contractId = created.CreatedTreeEvent.value.contractId as string;

  return { contractId, updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildCreateStockIssuanceCommand(params: CreateStockIssuanceParams): CommandWithDisclosedContracts {
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


