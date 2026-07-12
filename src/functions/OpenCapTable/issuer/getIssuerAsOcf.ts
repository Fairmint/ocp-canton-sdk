import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { ContractResult, GetByContractIdParams } from '../../../types/common';
import type { Address, Email, OcfIssuer as OcfIssuerInput, Phone, TaxId } from '../../../types/native';
import type { OcfIssuerOutput } from '../../../types/output';
import { damlEmailTypeToNative, damlPhoneTypeToNative } from '../../../utils/enumConversions';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import {
  damlAddressToNative,
  damlTimeToDateString,
  initialSharesAuthorizedFromDaml,
  isRecord,
} from '../../../utils/typeConversions';
import { decodeLosslessGeneratedDamlValue } from '../capTable/damlCodecLosslessness';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function invalidFormat(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  const stringValue = requireString(value, field);
  if (stringValue.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return stringValue;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'string', value);
  if (typeof value !== 'string') throw invalidType(field, 'string', value);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwnField(value, index)) throw requiredMissing(`${field}.${index}`, 'array item', undefined);
  }
  return value;
}

function readOptionalText(
  record: Record<string, unknown>,
  field: string,
  options: { nonEmpty?: boolean } = {}
): string | undefined {
  if (!hasOwnField(record, field)) return undefined;
  const value = record[field];
  if (value === null) return undefined;
  if (value === undefined) throw invalidType(`issuer.${field}`, 'string or null', value);
  return options.nonEmpty ? requireNonEmptyString(value, `issuer.${field}`) : requireString(value, `issuer.${field}`);
}

function readOptionalSubdivision(
  record: Record<string, unknown>,
  field: 'country_subdivision_of_formation' | 'country_subdivision_name_of_formation',
  kind: 'code' | 'name'
): string | undefined {
  const value = readOptionalText(record, field, { nonEmpty: true });
  if (value === undefined) return undefined;
  const valid = kind === 'code' ? /^[A-Z0-9]{1,3}$/.test(value) : value.trim().length > 0;
  if (!valid) {
    throw invalidFormat(
      `issuer.${field}`,
      kind === 'code' ? '1-3 uppercase alphanumeric characters' : 'non-blank string',
      value
    );
  }
  return value;
}

function damlEmailToNative(value: unknown): Email {
  const field = 'issuer.email';
  const damlEmail = requireRecord(value, field);
  const emailType = requireNonEmptyString(damlEmail.email_type, `${field}.email_type`);
  return {
    email_type: damlEmailTypeToNative(emailType as Parameters<typeof damlEmailTypeToNative>[0]),
    email_address: requireString(damlEmail.email_address, `${field}.email_address`),
  };
}

function damlPhoneToNative(value: unknown): Phone {
  const field = 'issuer.phone';
  const phone = requireRecord(value, field);
  const phoneType = requireNonEmptyString(phone.phone_type, `${field}.phone_type`);
  return {
    phone_type: damlPhoneTypeToNative(phoneType as Parameters<typeof damlPhoneTypeToNative>[0]),
    phone_number: requireString(phone.phone_number, `${field}.phone_number`),
  };
}

function readOptionalEmail(record: Record<string, unknown>): Email | undefined {
  if (!hasOwnField(record, 'email')) return undefined;
  const value = record.email;
  if (value === null) return undefined;
  if (value === undefined) throw invalidType('issuer.email', 'OcfEmail object or null', value);
  return damlEmailToNative(value);
}

function readOptionalPhone(record: Record<string, unknown>): Phone | undefined {
  if (!hasOwnField(record, 'phone')) return undefined;
  const value = record.phone;
  if (value === null) return undefined;
  if (value === undefined) throw invalidType('issuer.phone', 'OcfPhone object or null', value);
  return damlPhoneToNative(value);
}

function readOptionalAddress(record: Record<string, unknown>): Address | undefined {
  if (!hasOwnField(record, 'address')) return undefined;
  const value = record.address;
  if (value === null) return undefined;
  if (value === undefined) throw invalidType('issuer.address', 'OcfAddress object or null', value);

  const address = requireRecord(value, 'issuer.address');
  requireNonEmptyString(address.address_type, 'issuer.address.address_type');
  requireString(address.country, 'issuer.address.country');
  for (const field of ['street_suite', 'city', 'country_subdivision', 'postal_code'] as const) {
    if (!hasOwnField(address, field) || address[field] === null) continue;
    if (address[field] === undefined) {
      throw invalidType(`issuer.address.${field}`, 'non-empty string or null', address[field]);
    }
    requireString(address[field], `issuer.address.${field}`);
  }

  return damlAddressToNative(address as unknown as Parameters<typeof damlAddressToNative>[0]);
}

function readTaxIds(record: Record<string, unknown>): TaxId[] {
  return requireArray(record.tax_ids, 'issuer.tax_ids').map((value, index) => {
    const field = `issuer.tax_ids.${index}`;
    const taxId = requireRecord(value, field);
    return {
      country: requireString(taxId.country, `${field}.country`),
      tax_id: requireString(taxId.tax_id, `${field}.tax_id`),
    };
  });
}

function readComments(record: Record<string, unknown>): string[] {
  return requireArray(record.comments, 'issuer.comments').map((value, index) =>
    requireString(value, `issuer.comments.${index}`)
  );
}

/** @internal Project already-validated Issuer DAML data without invoking the generated codec again. */
export function projectDamlIssuerDataToNative(damlData: unknown): OcfIssuerInput {
  assertCanonicalJsonGraph(damlData, 'issuer');
  const data = requireRecord(damlData, 'issuer');
  const id = requireNonEmptyString(data.id, 'issuer.id');
  const subdivisionCode = readOptionalSubdivision(data, 'country_subdivision_of_formation', 'code');
  const subdivisionName = readOptionalSubdivision(data, 'country_subdivision_name_of_formation', 'name');
  if (subdivisionCode !== undefined && subdivisionName !== undefined) {
    throw new OcpParseError('Issuer contract contains both subdivision code and subdivision name', {
      source: 'getIssuerAsOcf',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const subdivision =
    subdivisionCode !== undefined
      ? { country_subdivision_of_formation: subdivisionCode }
      : subdivisionName !== undefined
        ? { country_subdivision_name_of_formation: subdivisionName }
        : {};
  const dba = readOptionalText(data, 'dba');
  const email = readOptionalEmail(data);
  const phone = readOptionalPhone(data);
  const address = readOptionalAddress(data);
  const taxIds = readTaxIds(data);
  const comments = readComments(data);
  const out: OcfIssuerInput = {
    object_type: 'ISSUER',
    id,
    legal_name: requireString(data.legal_name, 'issuer.legal_name'),
    country_of_formation: requireString(data.country_of_formation, 'issuer.country_of_formation'),
    formation_date: damlTimeToDateString(data.formation_date, 'issuer.formation_date'),
    ...subdivision,
    tax_ids: taxIds,
    comments,
    ...(dba !== undefined ? { dba } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(address !== undefined ? { address } : {}),
  };

  const isa = data.initial_shares_authorized;
  if (hasOwnField(data, 'initial_shares_authorized') && isa !== null) {
    out.initial_shares_authorized = initialSharesAuthorizedFromDaml(isa, 'issuer.initial_shares_authorized');
  }

  return out;
}

export function damlIssuerDataToNative(damlData: unknown): OcfIssuerInput {
  const native = projectDamlIssuerDataToNative(damlData);
  decodeLosslessGeneratedDamlValue(Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData, damlData, {
    rootPath: 'issuer',
    description: 'issuer',
    decodeSource: 'getIssuerAsOcf',
    allowUndefinedOptional: true,
    context: { entityType: 'issuer', expectedTemplateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId },
  });
  return native;
}

/**
 * Retrieve an issuer contract by ID and return it as an OCF JSON object.
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters containing the contract ID
 * @returns The issuer data with `object_type: 'ISSUER'` discriminant and the contract ID
 * @throws OcpValidationError if issuer fields do not match the generated DAML wire shape
 * @throws OcpParseError if the contract payload does not contain issuer data
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 */
export async function getIssuerAsOcf(
  client: LedgerJsonApiClient,
  params: GetByContractIdParams
): Promise<ContractResult<OcfIssuerOutput>> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getIssuerAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId,
  });
  const issuerData = extractGeneratedCreateArgumentData(createArgument, 'Issuer.createArgument', {
    dataField: 'issuer_data',
  });
  const native = damlIssuerDataToNative(issuerData);

  const data: OcfIssuerOutput = native;

  return { data, contractId: params.contractId };
}
