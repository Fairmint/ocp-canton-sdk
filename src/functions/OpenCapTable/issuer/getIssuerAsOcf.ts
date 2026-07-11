import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { ContractResult, GetByContractIdParams } from '../../../types/common';
import type { OcfIssuer as OcfIssuerInput } from '../../../types/native';
import type { OcfIssuerOutput } from '../../../types/output';
import { damlEmailTypeToNative, damlPhoneTypeToNative } from '../../../utils/enumConversions';
import {
  damlAddressToNative,
  damlTimeToDateString,
  isRecord,
  normalizeNumericString,
} from '../../../utils/typeConversions';
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
        return normalizeNumericString(v.value, `${fieldPath}.value`);
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

  const dataWithId = damlData as unknown as { id?: string };
  if (!dataWithId.id) {
    throw new OcpParseError('Issuer contract is missing required field: id', {
      source: 'getIssuerAsOcf',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const subdivisionCode = readOptionalSubdivision(
    damlData.country_subdivision_of_formation,
    'country_subdivision_of_formation',
    'code'
  );
  const subdivisionName = readOptionalSubdivision(
    damlData.country_subdivision_name_of_formation,
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
    legal_name: damlData.legal_name,
    country_of_formation: damlData.country_of_formation,
    formation_date: damlTimeToDateString(damlData.formation_date, 'issuer.formation_date'),
    ...subdivision,
    tax_ids: [],
    comments: [],
  };

  if (damlData.dba) out.dba = damlData.dba;
  if (damlData.tax_ids.length) out.tax_ids = damlData.tax_ids;
  if (damlData.email) out.email = damlEmailToNative(damlData.email);
  if (damlData.phone) out.phone = damlPhoneToNative(damlData.phone);
  if (damlData.address) out.address = damlAddressToNative(damlData.address);
  if ((damlData as unknown as { comments?: string[] }).comments) {
    out.comments = (damlData as unknown as { comments: string[] }).comments;
  }

  const isa: unknown = damlData.initial_shares_authorized;
  const normalizedIsa = normalizeInitialSharesValue(isa);
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
  if (!('issuer_data' in createArgument)) {
    throw new OcpParseError('Issuer data not found in contract create argument', {
      source: 'Issuer.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const issuerData = createArgument.issuer_data as Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData;
  const native = damlIssuerDataToNative(issuerData);

  const data: OcfIssuerOutput = native;

  return { data, contractId: params.contractId };
}
