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
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

function damlEmailToNative(
  damlEmail: Fairmint.OpenCapTable.Types.Contact.OcfEmail
): NonNullable<OcfIssuerInput['email']> {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address,
  };
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.Contact.OcfPhone): NonNullable<OcfIssuerInput['phone']> {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function readOptionalSubdivision(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcpParseError(`Issuer contract field ${field} must be a non-empty string when provided`, {
      source: `getIssuerAsOcf.${field}`,
      code: typeof value === 'string' ? OcpErrorCodes.INVALID_FORMAT : OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  return value;
}

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData): OcfIssuerInput {
  const normalizeInitialSharesValue = (v: unknown): OcfIssuerInput['initial_shares_authorized'] | undefined => {
    if (typeof v === 'string' || typeof v === 'number') return normalizeNumericString(String(v));
    if (isRecord(v)) {
      if (v.tag === 'OcfInitialSharesNumeric' && typeof v.value === 'string') return normalizeNumericString(v.value);
      if (v.tag === 'OcfInitialSharesEnum' && typeof v.value === 'string') {
        return v.value === 'OcfAuthorizedSharesUnlimited' ? 'UNLIMITED' : 'NOT APPLICABLE';
      }
    }
    return undefined;
  };

  const { id: generatedId, comments: generatedComments } = damlData;
  const id: unknown = generatedId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpParseError('Issuer contract is missing required field: id', {
      source: 'getIssuerAsOcf',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  const subdivisionCode = readOptionalSubdivision(
    damlData.country_subdivision_of_formation,
    'country_subdivision_of_formation'
  );
  const subdivisionName = readOptionalSubdivision(
    damlData.country_subdivision_name_of_formation,
    'country_subdivision_name_of_formation'
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
    id,
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
  const comments: unknown = generatedComments;
  if (Array.isArray(comments) && comments.every((comment) => typeof comment === 'string')) {
    out.comments = comments;
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
  const issuerData = extractAndDecodeDamlEntityData('issuer', createArgument);
  const native = damlIssuerDataToNative(issuerData);

  const data: OcfIssuerOutput = native;

  return { data, contractId: params.contractId };
}
