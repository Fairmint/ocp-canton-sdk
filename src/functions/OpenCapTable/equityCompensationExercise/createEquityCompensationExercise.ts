import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfEquityCompensationExerciseTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

export interface CreateEquityCompensationExerciseParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  exerciseData: OcfEquityCompensationExerciseTxData;
}

export function buildCreateEquityCompensationExerciseCommand(
  params: CreateEquityCompensationExerciseParams
): CommandWithDisclosedContracts {
  const { exerciseData: d } = params;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateEquityCompensationExercise = {
    exercise_data: {
      id: d.id,
      security_id: d.security_id,
      date: dateStringToDAMLTime(d.date),
      quantity: numberToString(d.quantity),
      consideration_text: optionalString(d.consideration_text),
      resulting_security_ids: d.resulting_security_ids,
      comments: cleanComments(d.comments),
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateEquityCompensationExercise',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
