import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfIssuer } from '../../../types/native';
import { emailTypeToDaml, phoneTypeToDaml } from '../../../utils/enumConversions';
import { assertSafeOcfJson } from '../../../utils/ocfJsonValidation';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import {
  addressToDaml,
  cleanComments,
  dateStringToDAMLDate,
  ensureArray,
  initialSharesAuthorizedToDaml,
  optionalString,
} from '../../../utils/typeConversions';
import type { IssuerDataInput } from './types';

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
 * Normalize issuer data by ensuring optional array fields are arrays.
 *
 * @param data - Canonical issuer data
 * @returns Normalized issuer data with all array fields as arrays
 */
export function normalizeIssuerData(data: IssuerDataInput): OcfIssuer {
  assertSafeOcfJson(data, 'issuer');
  return {
    ...data,
    tax_ids: ensureArray(data.tax_ids),
  };
}

/**
 * Convert native OCF Issuer data to DAML format.
 *
 * Used when the issuer is created with its cap table and when the issuer record is edited.
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
  assertSafeOcfJson(issuerData, 'issuer');
  let parsedData: IssuerDataInput;
  if (skipSchemaParse) {
    parsedData = issuerData;
  } else {
    parsedData = parseOcfEntityInput('issuer', issuerData);
  }

  // Normalize once at boundary to enforce OcfIssuer runtime invariant: tax_ids is always an array.
  const normalizedData: OcfIssuer = normalizeIssuerData(parsedData);

  if (!normalizedData.id) {
    throw new OcpValidationError('issuer.id', 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }

  return {
    id: normalizedData.id,
    legal_name: normalizedData.legal_name,
    country_of_formation: normalizedData.country_of_formation,
    dba: optionalString(normalizedData.dba),
    formation_date: dateStringToDAMLDate(normalizedData.formation_date, 'issuer.formation_date'),
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
