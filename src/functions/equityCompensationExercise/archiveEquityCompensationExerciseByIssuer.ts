import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveEquityCompensationExerciseByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveEquityCompensationExerciseByIssuerCommand(params: {
  contractId: string;
}): Command {
  return {
    ExerciseCommand: {
      templateId:
        Fairmint.OpenCapTable.EquityCompensationExercise.EquityCompensationExercise.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {},
    },
  };
}
