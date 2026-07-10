import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts } from '../../../types/common';
import type { OcfIssuer } from '../../../types/native';
import { validateIssuerData } from '../../../utils/entityValidators';
import { emailTypeToDaml, phoneTypeToDaml } from '../../../utils/enumConversions';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import {
  addressToDaml,
  cleanComments,
  dateStringToDAMLTime,
  ensureArray,
  initialSharesAuthorizedToDaml,
  optionalString,
} from '../../../utils/typeConversions';
import type { CreateIssuerParams, IssuerDataInput } from './types';

function emailToDaml(email: OcfIssuer['email']): Fairmint.OpenCapTable.Types.Contact.OcfEmail | null {
  if (!email) return null;
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address,
  };
}

function phoneToDaml(phone: OcfIssuer['phone']): Fairmint.OpenCapTable.Types.Contact.OcfPhone | null {
  if (!phone) return null;
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

export type { CreateIssuerParams, IssuerDataInput } from './types';

/**
 * Normalize issuer data by ensuring optional array fields are arrays.
 *
 * @param data - Canonical issuer data
 * @returns Normalized issuer data with all array fields as arrays
 */
export function normalizeIssuerData(data: IssuerDataInput): OcfIssuer {
  return {
    ...data,
    tax_ids: ensureArray(data.tax_ids),
  };
}

/**
 * Convert native OCF Issuer data to DAML format.
 *
 * Used by both createIssuer (via IssuerAuthorization) and batch issuer edits (via UpdateCapTable).
 *
 * @param issuerData - Native OCF issuer data
 * @returns DAML-formatted issuer data
 */
export function issuerDataToDaml(
  issuerData: IssuerDataInput,
  options?: { skipSchemaParse?: boolean }
): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData {
  return issuerDataToDamlInternal(issuerData, options?.skipSchemaParse ?? false);
}

function issuerDataToDamlInternal(
  issuerData: IssuerDataInput,
  skipSchemaParse: boolean
): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData {
  let parsedData: IssuerDataInput;
  if (skipSchemaParse) {
    parsedData = issuerData;
  } else {
    parsedData = parseOcfEntityInput('issuer', issuerData);
  }

  // Normalize once at boundary to enforce OcfIssuer runtime invariant: tax_ids is always an array.
  const normalizedData: OcfIssuer = normalizeIssuerData(parsedData);

  // Validate input data using the entity validator
  validateIssuerData(normalizedData, 'issuer');

  return {
    id: normalizedData.id,
    legal_name: normalizedData.legal_name,
    country_of_formation: normalizedData.country_of_formation,
    dba: optionalString(normalizedData.dba),
    formation_date: dateStringToDAMLTime(normalizedData.formation_date),
    country_subdivision_of_formation: optionalString(normalizedData.country_subdivision_of_formation),
    country_subdivision_name_of_formation: optionalString(normalizedData.country_subdivision_name_of_formation),
    tax_ids: normalizedData.tax_ids ?? [],
    email: normalizedData.email ? emailToDaml(normalizedData.email) : null,
    phone: normalizedData.phone ? phoneToDaml(normalizedData.phone) : null,
    address: normalizedData.address ? addressToDaml(normalizedData.address) : null,
    initial_shares_authorized:
      normalizedData.initial_shares_authorized !== undefined
        ? initialSharesAuthorizedToDaml(normalizedData.initial_shares_authorized)
        : null,
    comments: cleanComments(normalizedData.comments),
  };
}

/**
 * Build the ledger command to exercise **CreateCapTable** on an IssuerAuthorization contract.
 *
 * Does not submit—pair with {@link OcpClient.createBatch} or submit the returned `command` yourself.
 * The issuer is created together with the CapTable; further entities use {@link CapTableBatch}.
 *
 * @param params - IssuerAuthorization disclosed contract, signing party, and OCF issuer payload
 * @returns Exercise command plus disclosed contracts for the authorization template
 * @throws OcpValidationError if issuer data fails schema or entity validation
 *
 * @example
 * ```typescript
 * const { command, disclosedContracts } = ocp.OpenCapTable.issuer.buildCreate({
 *   issuerAuthorizationContractDetails,
 *   issuerParty,
 *   issuerData: { id: 'i1', legal_name: 'Acme', country_of_formation: 'US', formation_date: '2024-01-01' },
 * });
 * await ocp.createBatch({ actAs: [issuerParty] }).addBuiltCommand({ command, disclosedContracts }).submitAndWaitForTransactionTree();
 * ```
 */
export function buildCreateIssuerCommand(params: CreateIssuerParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.IssuerAuthorization.CreateCapTable = {
    issuer_data: issuerDataToDaml(params.issuerData),
  };

  // Use the templateId from the ledger (issuerAuthorizationContractDetails) to avoid
  // INTERPRETATION_UPGRADE_ERROR_VALIDATION_FAILED when SDK package hash differs from deployed.
  const command: Command = {
    ExerciseCommand: {
      templateId: params.issuerAuthorizationContractDetails.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      choice: 'CreateCapTable',
      choiceArgument: choiceArguments,
    },
  };

  // Include only the IssuerAuthorization as a disclosed contract.
  // CreateCapTable choice doesn't reference any other contracts.
  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.issuerAuthorizationContractDetails.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      createdEventBlob: params.issuerAuthorizationContractDetails.createdEventBlob,
      synchronizerId: params.issuerAuthorizationContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
