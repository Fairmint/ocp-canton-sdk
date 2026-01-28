import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types';

/**
 * Interface for JSON API choice arguments - matches what the SDK's Zod schema accepts.
 * Values can be primitives, nested records, or arrays containing any of these types.
 */
interface JsonRecord {
  [key: string]: string | number | boolean | null | JsonRecord | JsonValue[];
}
type JsonValue = string | number | boolean | null | JsonRecord | JsonValue[];

/**
 * Build a command to exercise a choice on the CapTable contract. This is a generic helper used by all add/edit/delete
 * operations.
 */

export function buildCapTableCommand(params: {
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
  choice: string;
  choiceArgument: Record<string, unknown>;
}): CommandWithDisclosedContracts {
  // Cast to JsonRecord which represents valid JSON API choice argument structure
  // This is safe because all our DAML choice arguments are serializable JSON structures
  const choiceArg = params.choiceArgument as JsonRecord;

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

  // No disclosed contracts needed - CapTable choices don't reference external contracts.
  // Canton automatically has visibility into contracts being exercised via ExerciseCommand.

  return { command, disclosedContracts: [] };
}
