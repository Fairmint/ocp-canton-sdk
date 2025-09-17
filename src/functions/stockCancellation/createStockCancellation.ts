import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockCancellationParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  cancellationData: {
    ocf_id: string;
    date: string;
    security_id: string;
    quantity: string | number;
    balance_security_id?: string;
    reason_text: string;
    comments?: string[];
  };
}

export interface CreateStockCancellationResult { contractId: string; updateId: string }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockCancellation(
  client: LedgerJsonApiClient,
  params: CreateStockCancellationParams
): Promise<CreateStockCancellationResult> {
  const d = params.cancellationData;
  const cancellation_data: Fairmint.OpenCapTable.StockCancellation.OcfStockCancellationData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    balance_security_id: d.balance_security_id ?? null,
    reason_text: d.reason_text,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockCancellation = { cancellation_data } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [ { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockCancellation', choiceArgument: choiceArguments as any } } ],
    disclosedContracts: [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.StockCancellation.StockCancellation')
  ) as any;
  if (!created) throw new Error('Expected StockCancellation CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateStockCancellationCommand(params: CreateStockCancellationParams): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.cancellationData;
  const cancellation_data: Fairmint.OpenCapTable.StockCancellation.OcfStockCancellationData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    balance_security_id: d.balance_security_id ?? null,
    reason_text: d.reason_text,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockCancellation = { cancellation_data } as any;
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockCancellation', choiceArgument: choiceArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


