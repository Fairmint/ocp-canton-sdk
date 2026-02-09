import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { ContractResult, GetByContractIdParams } from '../../../types/common';
import type { OcfIssuer as OcfIssuerInput } from '../../../types/native';
import type { OcfIssuerOutput } from '../../../types/output';
import { damlEmailTypeToNative, damlPhoneTypeToNative } from '../../../utils/enumConversions';
import { damlAddressToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

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

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData): OcfIssuerInput {
  const normalizeInitialSharesValue = (v: unknown): OcfIssuerInput['initial_shares_authorized'] | undefined => {
    if (typeof v === 'string' || typeof v === 'number') return normalizeNumericString(String(v));
    if (v && typeof v === 'object' && 'tag' in (v as { tag: string })) {
      const i = v as { tag: 'OcfInitialSharesNumeric' | 'OcfInitialSharesEnum'; value?: unknown };
      if (i.tag === 'OcfInitialSharesNumeric' && typeof i.value === 'string') return normalizeNumericString(i.value);
      if (i.tag === 'OcfInitialSharesEnum' && typeof i.value === 'string') {
        return i.value === 'OcfAuthorizedSharesUnlimited' ? 'UNLIMITED' : 'NOT_APPLICABLE';
      }
    }
    return undefined;
  };

  const dataWithId = damlData as unknown as { id?: string };
  const out: OcfIssuerInput = {
    id: dataWithId.id ?? '',
    legal_name: damlData.legal_name,
    country_of_formation: damlData.country_of_formation,
    formation_date: damlTimeToDateString(damlData.formation_date),
    tax_ids: [],
    comments: [],
  };

  if (damlData.dba) out.dba = damlData.dba;
  if (damlData.country_subdivision_of_formation) {
    out.country_subdivision_of_formation = damlData.country_subdivision_of_formation;
  }
  if (damlData.country_subdivision_name_of_formation) {
    out.country_subdivision_name_of_formation = damlData.country_subdivision_name_of_formation;
  }
  if (damlData.tax_ids.length) out.tax_ids = damlData.tax_ids;
  if (damlData.email) out.email = damlEmailToNative(damlData.email);
  if (damlData.phone) out.phone = damlPhoneToNative(damlData.phone);
  if (damlData.address) out.address = damlAddressToNative(damlData.address);
  if ((damlData as unknown as { comments?: string[] }).comments) {
    out.comments = (damlData as unknown as { comments: string[] }).comments;
  }

  const isa = (damlData as unknown as { initial_shares_authorized?: unknown }).initial_shares_authorized;
  const normalizedIsa = normalizeInitialSharesValue(isa);
  if (normalizedIsa !== undefined) out.initial_shares_authorized = normalizedIsa;

  return out;
}

/** @deprecated Use `GetByContractIdParams` instead */
export interface GetIssuerAsOcfParams extends GetByContractIdParams {}

/** @deprecated Use `ContractResult<OcfIssuerOutput>` instead */
export interface GetIssuerAsOcfResult extends ContractResult<OcfIssuerOutput> {}

/**
 * Retrieve an issuer contract by ID and return it as an OCF JSON object.
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters containing the contract ID
 * @returns The issuer data with `object_type: 'ISSUER'` discriminant and the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 */
export async function getIssuerAsOcf(
  client: LedgerJsonApiClient,
  params: GetByContractIdParams
): Promise<ContractResult<OcfIssuerOutput>> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument as Record<string, unknown>;
  if (!('issuer_data' in createArgument)) {
    throw new OcpParseError('Issuer data not found in contract create argument', {
      source: 'Issuer.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const issuerData = createArgument.issuer_data as Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData;
  const native = damlIssuerDataToNative(issuerData);

  const data: OcfIssuerOutput = {
    object_type: 'ISSUER',
    ...native,
  };

  return { data, contractId: params.contractId };
}
