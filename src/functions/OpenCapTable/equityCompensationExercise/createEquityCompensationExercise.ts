import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfEquityCompensationExerciseTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function equityCompensationExerciseDataToDaml(d: OcfEquityCompensationExerciseTxData): Record<string, unknown> {
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    consideration_text: optionalString(d.consideration_text),
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}

/** @deprecated Use AddEquityCompensationExerciseParams and buildAddEquityCompensationExerciseCommand instead. */
export interface CreateEquityCompensationExerciseParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  exerciseData: OcfEquityCompensationExerciseTxData;
}

/** @deprecated Use buildAddEquityCompensationExerciseCommand instead. */
export function buildCreateEquityCompensationExerciseCommand(
  params: CreateEquityCompensationExerciseParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateEquityCompensationExercise',
    choiceArgument: {
      exercise_data: equityCompensationExerciseDataToDaml(params.exerciseData),
    },
  });
}
