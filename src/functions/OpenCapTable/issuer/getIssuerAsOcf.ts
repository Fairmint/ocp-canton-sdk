import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { ContractResult, GetByContractIdParams } from '../../../types/common';
import type { OcfIssuer as OcfIssuerInput } from '../../../types/native';
import type { OcfIssuerOutput } from '../../../types/output';
import { damlEmailTypeToNative, damlPhoneTypeToNative } from '../../../utils/enumConversions';
import {
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  rejectUnknownGeneratedFields,
  requireGeneratedArray,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { damlAddressToNative, damlTimeToDateString, isRecord } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function damlEmailToNative(damlEmail: Fairmint.OpenCapTable.Types.Contact.OcfEmail): OcfIssuerInput['email'] {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address,
  };
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.Contact.OcfPhone): OcfIssuerInput['phone'] {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function readOptionalSubdivision(value: unknown, field: string, kind: 'code' | 'name'): string | undefined {
  if (value === null || value === undefined) return undefined;
  const valid =
    typeof value === 'string' && (kind === 'code' ? /^[A-Z0-9]{1,3}$/.test(value) : value.trim().length > 0);
  if (!valid) {
    const expected = kind === 'code' ? 'a 1-3 character uppercase alphanumeric code' : 'a non-blank string';
    throw new OcpParseError(`Issuer contract field ${field} must be ${expected} when provided`, {
      source: `getIssuerAsOcf.${field}`,
      code: typeof value === 'string' ? OcpErrorCodes.INVALID_FORMAT : OcpErrorCodes.SCHEMA_MISMATCH,
      context: { receivedValue: value },
    });
  }
  return value;
}

function validateOptionalIssuerRecord(
  value: unknown,
  source: string,
  allowedFields: readonly string[],
  stringFields: readonly string[]
): void {
  if (value === null || value === undefined) return;
  const record = requireGeneratedRecord(value, source);
  rejectUnknownGeneratedFields(record, source, allowedFields);
  stringFields.forEach((field) => requireGeneratedString(record[field], `${source}.${field}`));
}

function validateGeneratedIssuerData(input: unknown): void {
  const rootPath = 'getIssuerAsOcf';
  assertSafeGeneratedDamlJson(input, rootPath);
  const data = requireGeneratedRecord(input, rootPath);
  rejectUnknownGeneratedFields(data, rootPath, [
    'id',
    'country_of_formation',
    'formation_date',
    'legal_name',
    'comments',
    'tax_ids',
    'address',
    'country_subdivision_of_formation',
    'country_subdivision_name_of_formation',
    'dba',
    'email',
    'initial_shares_authorized',
    'phone',
  ]);
  for (const field of ['id', 'country_of_formation', 'formation_date', 'legal_name'] as const) {
    requireGeneratedString(data[field], `${rootPath}.${field}`);
  }
  requireGeneratedStringArray(data.comments, `${rootPath}.comments`);
  const taxIds = requireGeneratedArray(data.tax_ids, `${rootPath}.tax_ids`);
  taxIds.forEach((taxId, index) => {
    const path = `${rootPath}.tax_ids[${index}]`;
    const record = requireGeneratedRecord(taxId, path);
    rejectUnknownGeneratedFields(record, path, ['country', 'tax_id']);
    requireGeneratedString(record.country, `${path}.country`);
    requireGeneratedString(record.tax_id, `${path}.tax_id`);
  });
  for (const field of ['country_subdivision_of_formation', 'country_subdivision_name_of_formation', 'dba'] as const) {
    if (data[field] !== null && data[field] !== undefined) {
      requireGeneratedString(data[field], `${rootPath}.${field}`);
    }
  }
  validateOptionalIssuerRecord(
    data.address,
    `${rootPath}.address`,
    ['address_type', 'country', 'city', 'country_subdivision', 'postal_code', 'street_suite'],
    ['address_type', 'country']
  );
  if (data.address !== null && data.address !== undefined) {
    const address = requireGeneratedRecord(data.address, `${rootPath}.address`);
    for (const field of ['city', 'country_subdivision', 'postal_code', 'street_suite'] as const) {
      if (address[field] !== null && address[field] !== undefined) {
        requireGeneratedString(address[field], `${rootPath}.address.${field}`);
      }
    }
  }
  validateOptionalIssuerRecord(
    data.email,
    `${rootPath}.email`,
    ['email_address', 'email_type'],
    ['email_address', 'email_type']
  );
  validateOptionalIssuerRecord(
    data.phone,
    `${rootPath}.phone`,
    ['phone_number', 'phone_type'],
    ['phone_number', 'phone_type']
  );
  if (data.initial_shares_authorized !== null && data.initial_shares_authorized !== undefined) {
    const initialSharesPath = `${rootPath}.initial_shares_authorized`;
    const initialShares = requireGeneratedRecord(data.initial_shares_authorized, initialSharesPath);
    rejectUnknownGeneratedFields(initialShares, initialSharesPath, ['tag', 'value']);
  }
}

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData): OcfIssuerInput {
  const normalizeInitialSharesValue = (v: unknown): OcfIssuerInput['initial_shares_authorized'] | undefined => {
    const fieldPath = 'getIssuerAsOcf.initial_shares_authorized';
    if (v === null || v === undefined) return undefined;
    if (!isRecord(v)) {
      throw new OcpParseError('Issuer initial_shares_authorized must be a generated DAML variant', {
        source: fieldPath,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: { receivedValue: v },
      });
    }
    const unknownField = Object.keys(v).find((field) => field !== 'tag' && field !== 'value');
    if (unknownField !== undefined) {
      throw new OcpParseError(`Unexpected issuer initial_shares_authorized field: ${unknownField}`, {
        source: `${fieldPath}.${unknownField}`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: { receivedValue: v[unknownField] },
      });
    }
    if (typeof v.tag !== 'string') {
      throw new OcpParseError('Issuer initial_shares_authorized is missing its generated DAML tag', {
        source: `${fieldPath}.tag`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: { receivedValue: v.tag },
      });
    }

    switch (v.tag) {
      case 'OcfInitialSharesNumeric':
        if (typeof v.value !== 'string') {
          throw new OcpParseError('Numeric issuer initial_shares_authorized must contain a DAML Numeric string', {
            source: `${fieldPath}.value`,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            context: { receivedValue: v.value },
          });
        }
        {
          const result = canonicalizeNumeric10(v.value, { allowExponent: true });
          if (!result.ok) {
            throw new OcpParseError(result.message, {
              source: `${fieldPath}.value`,
              code: OcpErrorCodes.INVALID_FORMAT,
              context: { receivedValue: v.value },
            });
          }
          return result.value;
        }
      case 'OcfInitialSharesEnum':
        if (typeof v.value !== 'string') {
          throw new OcpParseError('Enum issuer initial_shares_authorized must contain a generated DAML enum string', {
            source: `${fieldPath}.value`,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            context: { receivedValue: v.value },
          });
        }
        if (v.value === 'OcfAuthorizedSharesUnlimited') return 'UNLIMITED';
        if (v.value === 'OcfAuthorizedSharesNotApplicable') return 'NOT APPLICABLE';
        throw new OcpParseError(`Unknown issuer initial_shares_authorized enum value: ${String(v.value)}`, {
          source: `${fieldPath}.value`,
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          context: { receivedValue: v.value },
        });
      default:
        throw new OcpParseError(`Unknown issuer initial_shares_authorized tag: ${v.tag}`, {
          source: `${fieldPath}.tag`,
          code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          context: { receivedValue: v.tag },
        });
    }
  };

  validateGeneratedIssuerData(damlData);
  const sourceInitialShares = (damlData as unknown as Record<string, unknown>).initial_shares_authorized;
  const normalizedIsa = normalizeInitialSharesValue(sourceInitialShares);
  const decoded = decodeGeneratedDaml(
    damlData,
    {
      decode: (value) => Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData.decoder.runWithException(value),
      encode: (value) => Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData.encode(value),
    },
    'getIssuerAsOcf'
  );
  const dataWithId = decoded as unknown as { id?: string };
  if (!dataWithId.id) {
    throw new OcpParseError('Issuer contract is missing required field: id', {
      source: 'getIssuerAsOcf',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const subdivisionCode = readOptionalSubdivision(
    decoded.country_subdivision_of_formation,
    'country_subdivision_of_formation',
    'code'
  );
  const subdivisionName = readOptionalSubdivision(
    decoded.country_subdivision_name_of_formation,
    'country_subdivision_name_of_formation',
    'name'
  );
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
  const out: OcfIssuerInput = {
    object_type: 'ISSUER',
    id: dataWithId.id,
    legal_name: decoded.legal_name,
    country_of_formation: decoded.country_of_formation,
    formation_date: damlTimeToDateString(decoded.formation_date, 'issuer.formation_date'),
    ...subdivision,
    tax_ids: [],
    comments: [],
  };

  if (decoded.dba) out.dba = decoded.dba;
  if (decoded.tax_ids.length) out.tax_ids = decoded.tax_ids;
  if (decoded.email) out.email = damlEmailToNative(decoded.email);
  if (decoded.phone) out.phone = damlPhoneToNative(decoded.phone);
  if (decoded.address) out.address = damlAddressToNative(decoded.address);
  out.comments = decoded.comments;

  if (normalizedIsa !== undefined) out.initial_shares_authorized = normalizedIsa;

  return out;
}

/**
 * Retrieve an issuer contract by ID and return it as an OCF JSON object.
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters containing the contract ID
 * @returns The issuer data with `object_type: 'ISSUER'` discriminant and the contract ID
 * @throws OcpParseError if the contract payload is missing required issuer fields
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
  const argumentPath = 'Issuer.createArgument';
  assertSafeGeneratedDamlJson(createArgument, argumentPath);
  const argument = requireGeneratedRecord(createArgument, argumentPath);
  if (!Object.prototype.hasOwnProperty.call(argument, 'issuer_data')) {
    throw new OcpParseError('Issuer data not found in contract create argument', {
      source: `${argumentPath}.issuer_data`,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const issuerData = argument.issuer_data as Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData;
  const native = damlIssuerDataToNative(issuerData);

  const data: OcfIssuerOutput = native;

  return { data, contractId: params.contractId };
}
