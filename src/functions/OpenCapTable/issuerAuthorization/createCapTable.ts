import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { INITIAL_SHARD_PREFIXES, isDerivedForm } from '../../../register/ids';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type { CreateCapTableCommand, CreateCapTableResult, IssuerAuthorizationRef } from '../../../types/setup';
import { decodeGeneratedDaml, generatedCodec } from '../../../utils/generatedDamlValidation';
import { requireSetupParty } from '../factory/factoryIdentity';
import { issuerDataToDaml } from '../issuer/createIssuer';
import type { IssuerDataInput } from '../issuer/types';
import { requireExerciseResult } from '../shared/exerciseResult';

export type { CreateCapTableCommand, CreateCapTableResult, IssuerAuthorizationRef } from '../../../types/setup';

const CREATE_CAP_TABLE_CHOICE = 'IssuerAuthorization_CreateCapTable';

export interface BuildCreateCapTableParams {
  /** The transfer-agent-accepted authorization, as `acceptIssuerAuthorization` returns it. */
  authorization: IssuerAuthorizationRef;
  /** The transfer agent the authorization pins; the choice must name it. */
  transferAgent: string;
  /** The issuer record the cap table starts with. Its ID must not have the cap table's derived form. */
  issuerData: IssuerDataInput;
}

function requireAuthorizationField(authorization: IssuerAuthorizationRef, field: keyof IssuerAuthorizationRef): void {
  const value: unknown = authorization[field];
  if (typeof value !== 'string' || value === '') {
    throw new OcpValidationError(`authorization.${field}`, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: value,
    });
  }
}

/**
 * Step 3 of the cap table setup: the issuer's `IssuerAuthorization_CreateCapTable`, which creates the `Issuer` record
 * (its ID claimed), the `CapTable` anchor in Active status and the first 256 ID shards, each signed by the issuer,
 * `system_operator` and the transfer agent.
 *
 * The command is built, not submitted: the issuer signs it, often outside the SDK. Submit it as `actAs`, with
 * `disclosedContracts` (the authorization, which the issuer only observes), and read the outcome with
 * `readCreateCapTableResult`.
 *
 * @throws OcpValidationError when the transfer agent is not the one the authorization pins, or the issuer's ID has the
 * cap table's derived form (`<cap table ID>:…`), which no claim accepts
 */
export function buildCreateCapTableCommand(params: BuildCreateCapTableParams): CreateCapTableCommand {
  const { authorization } = params;
  for (const field of [
    'contractId',
    'templateId',
    'createdEventBlob',
    'synchronizerId',
    'capTableId',
    'issuer',
    'systemOperator',
    'transferAgent',
  ] as const) {
    requireAuthorizationField(authorization, field);
  }
  requireSetupParty(params.transferAgent, 'transferAgent');
  if (params.transferAgent !== authorization.transferAgent) {
    throw new OcpValidationError(
      'transferAgent',
      'The cap table must name the transfer agent this authorization pins',
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: params.transferAgent,
        expectedType: authorization.transferAgent,
      }
    );
  }

  const issuerData = issuerDataToDaml(params.issuerData);
  if (isDerivedForm(authorization.capTableId, issuerData.id)) {
    throw new OcpValidationError(
      'issuerData.id',
      `The issuer's ID cannot have the cap table's derived form (${authorization.capTableId}:...)`,
      { code: OcpErrorCodes.INVALID_FORMAT, receivedValue: issuerData.id }
    );
  }

  const choiceArgument: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_CreateCapTable = {
    transfer_agent: params.transferAgent,
    issuer_data: issuerData,
  };
  return {
    command: {
      ExerciseCommand: {
        templateId: authorization.templateId,
        contractId: authorization.contractId,
        choice: CREATE_CAP_TABLE_CHOICE,
        choiceArgument,
      },
    },
    disclosedContracts: [
      {
        templateId: authorization.templateId,
        contractId: authorization.contractId,
        createdEventBlob: authorization.createdEventBlob,
        synchronizerId: authorization.synchronizerId,
      },
    ],
    actAs: [authorization.issuer],
  };
}

/**
 * Read what `IssuerAuthorization_CreateCapTable` created from the issuer's submission, which must carry exercised
 * events (the Ledger API's ledger-effects shape).
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction holds no such exercise result
 * @throws OcpParseError when the result does not decode, or its shards are not the 256 initial prefixes
 */
export function readCreateCapTableResult(response: SubmitAndWaitForTransactionResponse): CreateCapTableResult {
  const source = `${CREATE_CAP_TABLE_CHOICE}.exerciseResult`;
  const result = decodeGeneratedDaml(
    requireExerciseResult(response, { templateId: OCP_TEMPLATES.issuerAuthorization, choice: CREATE_CAP_TABLE_CHOICE }),
    generatedCodec(Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_CreateCapTableResult),
    source
  );
  const byPrefix = new Map<string, string>(result.shards.entriesArray());
  const shards = new Map<string, string>();
  for (const prefix of INITIAL_SHARD_PREFIXES) {
    const contractId = byPrefix.get(prefix);
    if (contractId !== undefined) shards.set(prefix, contractId);
  }
  if (shards.size !== INITIAL_SHARD_PREFIXES.length || byPrefix.size !== shards.size) {
    throw new OcpParseError('The created cap table must hold exactly the 256 initial ID shards', {
      source: `${source}.shards`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'initial_shards_mismatch',
      context: { shardCount: byPrefix.size },
    });
  }
  return { capTableContractId: result.cap_table, issuerContractId: result.issuer, shards };
}
