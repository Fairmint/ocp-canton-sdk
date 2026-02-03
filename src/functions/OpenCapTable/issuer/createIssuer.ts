import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfIssuer } from '../../../types';
import { validateIssuerData } from '../../../utils/entityValidators';
import { emailTypeToDaml, phoneTypeToDaml } from '../../../utils/enumConversions';
import {
  addressToDaml,
  cleanComments,
  dateStringToDAMLTime,
  ensureArray,
  optionalString,
} from '../../../utils/typeConversions';

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

/**
 * Input type for issuer data that may have missing array fields.
 * The SDK normalizes these to empty arrays automatically.
 */
export type IssuerDataInput = Omit<OcfIssuer, 'tax_ids'> & {
  /** Tax IDs - normalized to empty array if null/undefined */
  tax_ids?: OcfIssuer['tax_ids'] | null;
};

/**
 * Normalize issuer data by ensuring array fields are arrays (not null/undefined).
 * This allows the SDK to accept raw OCF data where optional array fields may be missing.
 *
 * @param data - Raw issuer data that may have null/undefined array fields
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
export function issuerDataToDaml(issuerData: IssuerDataInput): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData {
  // Normalize input data to ensure array fields are arrays
  const normalizedData = normalizeIssuerData(issuerData);

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
    tax_ids: normalizedData.tax_ids,
    email: normalizedData.email ? emailToDaml(normalizedData.email) : null,
    phone: normalizedData.phone ? phoneToDaml(normalizedData.phone) : null,
    address: normalizedData.address ? addressToDaml(normalizedData.address) : null,
    initial_shares_authorized:
      normalizedData.initial_shares_authorized !== undefined
        ? ((): Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData['initial_shares_authorized'] => {
            const v = normalizedData.initial_shares_authorized;
            if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))) {
              return {
                tag: 'OcfInitialSharesNumeric',
                value: typeof v === 'number' ? v.toString() : v,
              };
            }
            if (v === 'UNLIMITED') {
              return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesUnlimited' };
            }
            return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesNotApplicable' };
          })()
        : null,
    comments: cleanComments(normalizedData.comments),
  };
}

export interface CreateIssuerParams {
  /** Details of the IssuerAuthorization contract for disclosed contracts */
  issuerAuthorizationContractDetails: DisclosedContract;
  issuerParty: string;
  /**
   * Issuer data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
   *
   * - Legal_name: Legal name of the issuer
   * - Formation_date: Date of formation (YYYY-MM-DD)
   * - Country_of_formation: Country of formation (ISO 3166-1 alpha-2)
   * - Dba (optional): Doing Business As name
   * - Country_subdivision_of_formation (optional): Subdivision code of formation (ISO 3166-2)
   * - Country_subdivision_name_of_formation (optional): Text name of subdivision of formation
   * - Tax_ids (optional): Issuer tax IDs (normalized to empty array if null/undefined)
   * - Email (optional): Work email
   * - Phone (optional): Phone number in ITU E.123 format
   * - Address (optional): Headquarters address
   * - Initial_shares_authorized (optional): Initial authorized shares (enum or numeric)
   * - Comments (optional): Additional comments
   */
  issuerData: IssuerDataInput;
}

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
