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
  capTableContractDetails?: DisclosedContract;
  choice: string;
  choiceArgument: Record<string, unknown>;
}): CommandWithDisclosedContracts {
  // Use explicit any for choiceArgument since the SDK Command type requires a specific shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choiceArg = params.choiceArgument as any;

  // Use the templateId from capTableContractDetails when provided (from actual ledger),
  // otherwise fall back to the DAML-JS package's hardcoded templateId.
  // This prevents WRONGLY_TYPED_CONTRACT errors when the deployed packages have
  // different package IDs than the DAML-JS package.
  const capTableTemplateId =
    params.capTableContractDetails?.templateId ?? Fairmint.OpenCapTable.CapTable.CapTable.templateId;

  const command: Command = {
    ExerciseCommand: {
      templateId: capTableTemplateId,
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

  // Include CapTable contract in disclosed contracts if provided
  // This is necessary for Canton to validate the contract being exercised
  if (params.capTableContractDetails) {
    disclosedContracts.push({
      templateId: params.capTableContractDetails.templateId,
      contractId: params.capTableContractDetails.contractId,
      createdEventBlob: params.capTableContractDetails.createdEventBlob,
      synchronizerId: params.capTableContractDetails.synchronizerId,
    });
  }

  return { command, disclosedContracts };
}
