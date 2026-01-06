import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

/**
 * Build a command to exercise a choice on the CapTable contract. This is a generic helper used by all add/edit/delete
 * operations.
 */

export function buildCapTableCommand(params: {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  choice: string;
  choiceArgument: Record<string, unknown>;
}): CommandWithDisclosedContracts {
  // Use explicit any for choiceArgument since the SDK Command type requires a specific shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choiceArg = params.choiceArgument as any;
  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.CapTable.CapTable.templateId,
      contractId: params.capTableContractId,
      choice: params.choice,
      choiceArgument: choiceArg,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
