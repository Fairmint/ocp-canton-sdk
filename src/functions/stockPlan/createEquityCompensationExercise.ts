import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateEquityCompensationExerciseParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  exerciseData: {
    id: string;
    date: string;
    security_id: string;
    quantity: string | number;
    consideration_text?: string;
    resulting_security_ids: string[];
    comments?: string[];
  };
}

export interface CreateEquityCompensationExerciseResult { contractId: string; updateId: string }

export async function createEquityCompensationExercise(
  client: LedgerJsonApiClient,
  params: CreateEquityCompensationExerciseParams
): Promise<CreateEquityCompensationExerciseResult> {
  const d = params.exerciseData;
  const exercise_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    consideration_text: d.consideration_text ?? null,
    resulting_security_ids: d.resulting_security_ids,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateEquityCompensationExercise = { exercise_data } as any;

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [ { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateEquityCompensationExercise', choiceArgument: choiceArguments as any } } ],
    disclosedContracts: [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = Object.values(response.transactionTree.eventsById).find((e: any) => {
    const templateId = (e as any).CreatedTreeEvent?.value?.templateId;
    if (!templateId) return false;
    return templateId.endsWith(':Fairmint.OpenCapTable.EquityCompensationExercise:EquityCompensationExercise');
  }) as any;
  if (!created) throw new Error('Expected EquityCompensationExercise CreatedTreeEvent not found');

  return { contractId: created.CreatedTreeEvent.value.contractId, updateId: response.transactionTree.updateId };
}

export function buildCreateEquityCompensationExerciseCommand(params: CreateEquityCompensationExerciseParams): { command: Command; disclosedContracts: DisclosedContract[] } {
  const d = params.exerciseData;
  const exercise_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    consideration_text: d.consideration_text ?? null,
    resulting_security_ids: d.resulting_security_ids,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateEquityCompensationExercise = { exercise_data } as any;
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateEquityCompensationExercise', choiceArgument: choiceArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


