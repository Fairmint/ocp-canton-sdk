import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface ArchiveEquityCompensationIssuanceByIssuerParams {
  contractId: string;
  issuerParty: string;
}

export function buildArchiveEquityCompensationIssuanceByIssuerCommand(params: { contractId: string }): Command {
  return {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
      contractId: params.contractId,
      choice: 'ArchiveByIssuer',
      choiceArgument: {},
    },
  };
}
