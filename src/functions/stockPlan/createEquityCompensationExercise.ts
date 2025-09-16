import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { ContractDetails } from '../../types/contractDetails';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateEquityCompensationExerciseParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  exerciseData: {
    ocf_id: string;
    date: string;
    security_id: string;
    quantity: string | number;
    consideration_text?: string;
    resulting_security_ids: string[];
    comments?: string[];
  };
}

export interface CreateEquityCompensationExerciseResult { contractId: string; updateId: string }

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export async function createEquityCompensationExercise(
  client: LedgerJsonApiClient,
  params: CreateEquityCompensationExerciseParams
): Promise<CreateEquityCompensationExerciseResult> {
  const issuerEvents = await client.getEventsByContractId({ contractId: params.issuerContractId });
  const systemOperator = (issuerEvents.created?.createdEvent?.createArgument as IssuerCreateArgShape | undefined)?.context?.system_operator;
  if (!systemOperator) throw new Error('System operator not found on Issuer create argument');

  const d = params.exerciseData;
  const exercise_data: Fairmint.OpenCapTable.EquityCompensationExercise.OcfEquityCompensationExerciseData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    consideration_text: d.consideration_text ?? null,
    resulting_security_ids: d.resulting_security_ids,
    comments: d.comments || []
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, exercise_data };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty, systemOperator],
    commands: [ { CreateCommand: { templateId: Fairmint.OpenCapTable.EquityCompensationExercise.EquityCompensationExercise.templateId, createArguments: createArguments as any } } ],
    disclosedContracts: [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) =>
    (e as any).CreatedTreeEvent?.value?.templateId?.endsWith(':Fairmint.OpenCapTable.EquityCompensationExercise.EquityCompensationExercise')
  ) as any;
  if (!created) throw new Error('Expected EquityCompensationExercise CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateEquityCompensationExerciseCommand(params: CreateEquityCompensationExerciseParams & { systemOperator: string }): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.exerciseData;
  const exercise_data: Fairmint.OpenCapTable.EquityCompensationExercise.OcfEquityCompensationExerciseData = {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    consideration_text: d.consideration_text ?? null,
    resulting_security_ids: d.resulting_security_ids,
    comments: d.comments || []
  } as any;

  const createArguments = { context: { issuer: params.issuerParty, system_operator: params.systemOperator, featured_app_right: params.featuredAppRightContractDetails.contractId }, exercise_data };
  const command: Command = { CreateCommand: { templateId: Fairmint.OpenCapTable.EquityCompensationExercise.EquityCompensationExercise.templateId, createArguments: createArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


