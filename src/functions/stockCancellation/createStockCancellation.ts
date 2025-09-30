import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CommandWithDisclosedContracts } from '../../types';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockCancellationParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  cancellationData: {
    id: string;
    date: string;
    security_id: string;
    quantity: string | number;
    balance_security_id?: string;
    reason_text: string;
    comments?: string[];
  };
}

export interface CreateStockCancellationResult { contractId: string; updateId: string; response: SubmitAndWaitForTransactionTreeResponse }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createStockCancellation(
  client: LedgerJsonApiClient,
  params: CreateStockCancellationParams
): Promise<CreateStockCancellationResult> {
  const { command, disclosedContracts } = buildCreateStockCancellationCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values((response.transactionTree as any)?.eventsById ?? (response.transactionTree as any)?.transaction?.eventsById).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.StockCancellation:StockCancellation');
  }) as any;
  if (!created) throw new Error('Expected StockCancellation CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId, response };
}

export function buildCreateStockCancellationCommand(params: CreateStockCancellationParams): CommandWithDisclosedContracts {
  const d = params.cancellationData;
  const cancellation_data: any = {
    id: d.id,
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


