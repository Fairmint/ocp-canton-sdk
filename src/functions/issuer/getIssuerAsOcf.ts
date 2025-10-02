import { damlTimeToDateString, damlAddressToNative } from '../../utils/typeConversions';
import type { OcfIssuerData, EmailType, PhoneType } from '../../types/native';
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

function damlEmailTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfEmailType): EmailType {
  switch (damlType) {
    case 'OcfEmailTypePersonal':
      return 'PERSONAL';
    case 'OcfEmailTypeBusiness':
      return 'BUSINESS';
    case 'OcfEmailTypeOther':
      return 'OTHER';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new Error(`Unknown DAML email type: ${exhaustiveCheck as string}`);
    }
  }
}

function damlEmailToNative(
  damlEmail: Fairmint.OpenCapTable.Types.OcfEmail
): OcfIssuerData['email'] {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address,
  };
}

function damlPhoneTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfPhoneType): PhoneType {
  switch (damlType) {
    case 'OcfPhoneHome':
      return 'HOME';
    case 'OcfPhoneMobile':
      return 'MOBILE';
    case 'OcfPhoneBusiness':
      return 'BUSINESS';
    case 'OcfPhoneOther':
      return 'OTHER';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new Error(`Unknown DAML phone type: ${exhaustiveCheck as string}`);
    }
  }
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.OcfPhone): OcfIssuerData['phone'] {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function damlIssuerDataToNative(
  damlData: Fairmint.OpenCapTable.Issuer.OcfIssuerData
): OcfIssuerData {
  const normalizeInitialShares = (
    v: unknown
  ): OcfIssuerData['initial_shares_authorized'] | undefined => {
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (v && typeof v === 'object' && 'tag' in (v as { tag: string })) {
      const i = v as { tag: 'OcfInitialSharesNumeric' | 'OcfInitialSharesEnum'; value?: unknown };
      if (i.tag === 'OcfInitialSharesNumeric' && typeof i.value === 'string') return i.value;
      if (i.tag === 'OcfInitialSharesEnum' && typeof i.value === 'string') {
        return i.value === 'OcfAuthorizedSharesUnlimited' ? 'UNLIMITED' : 'NOT_APPLICABLE';
      }
    }
    return undefined;
  };

  const out: OcfIssuerData = {
    id: (damlData as any).id,
    legal_name: damlData.legal_name,
    country_of_formation: damlData.country_of_formation,
    formation_date: damlTimeToDateString(damlData.formation_date),
    tax_ids: [],
    comments: [],
  };

  if (damlData.dba) out.dba = damlData.dba;
  if (damlData.country_subdivision_of_formation)
    out.country_subdivision_of_formation = damlData.country_subdivision_of_formation;
  if (damlData.country_subdivision_name_of_formation)
    out.country_subdivision_name_of_formation = damlData.country_subdivision_name_of_formation;
  if (damlData.tax_ids && damlData.tax_ids.length) out.tax_ids = damlData.tax_ids;
  if (damlData.email) out.email = damlEmailToNative(damlData.email);
  if (damlData.phone) out.phone = damlPhoneToNative(damlData.phone);
  if (damlData.address) out.address = damlAddressToNative(damlData.address);
  if ((damlData as unknown as { comments?: string[] }).comments)
    out.comments = (damlData as unknown as { comments: string[] }).comments;

  const isa = (damlData as unknown as { initial_shares_authorized?: unknown })
    .initial_shares_authorized;
  const normalizedIsa = normalizeInitialShares(isa);
  if (normalizedIsa !== undefined) out.initial_shares_authorized = normalizedIsa;

  return out;
}

/**
 * OCF Issuer object according to the Open Cap Table Coalition schema
 * Object describing the issuer of the cap table (the company whose cap table this is)
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
 */
export interface OcfIssuer {
  object_type: 'ISSUER';
  legal_name: string;
  dba?: string;
  formation_date?: string; // YYYY-MM-DD
  country_of_formation: string; // ISO 3166-1 alpha-2
  country_subdivision_of_formation?: string;
  country_subdivision_name_of_formation?: string;
  tax_ids?: Array<{ tax_id: string; country: string }>;
  email?: { email_type: 'BUSINESS' | 'PERSONAL' | 'OTHER'; email_address: string };
  phone?: { phone_type: 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER'; phone_number: string };
  address?: {
    address_type: 'LEGAL' | 'CONTACT' | 'OTHER';
    street_suite?: string;
    city?: string;
    country_subdivision?: string;
    country: string;
    postal_code?: string;
  };
  initial_shares_authorized?: string | number | 'UNLIMITED' | 'NOT_APPLICABLE';
  id?: string;
  comments?: string[];
}

export interface GetIssuerAsOcfParams {
  contractId: string;
}

export interface GetIssuerAsOcfResult {
  issuer: OcfIssuer;
  contractId: string;
}

export async function getIssuerAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAsOcfParams
): Promise<GetIssuerAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument as any;
  if (!('issuer_data' in createArgument)) {
    throw new Error('Issuer data not found in contract create argument');
  }

  const issuerData = createArgument.issuer_data as Fairmint.OpenCapTable.Issuer.OcfIssuerData;
  const native = damlIssuerDataToNative(issuerData);

  const ocfIssuer: OcfIssuer = {
    object_type: 'ISSUER',
    ...native,
  };

  return { issuer: ocfIssuer, contractId: params.contractId };
}
