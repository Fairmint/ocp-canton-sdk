import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlIssuerDataToNative } from '../../utils/typeConversions';

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

  const issuerData = (createArgument as any).issuer_data as Fairmint.OpenCapTable.Issuer.OcfIssuerData;
  const native = damlIssuerDataToNative(issuerData);
  const { ocf_id, ...nativeWithoutId } = native as any;

  const ocfIssuer: OcfIssuer = {
    object_type: 'ISSUER',
    id: ocf_id,
    legal_name: nativeWithoutId.legal_name,
    country_of_formation: nativeWithoutId.country_of_formation,
    formation_date: nativeWithoutId.formation_date,
    ...(nativeWithoutId.dba && { dba: nativeWithoutId.dba }),
    ...(nativeWithoutId.country_subdivision_of_formation && {
      country_subdivision_of_formation: nativeWithoutId.country_subdivision_of_formation
    }),
    ...(nativeWithoutId.country_subdivision_name_of_formation && {
      country_subdivision_name_of_formation: nativeWithoutId.country_subdivision_name_of_formation
    }),
    ...(nativeWithoutId.tax_ids && { tax_ids: nativeWithoutId.tax_ids }),
    ...(nativeWithoutId.email && { email: nativeWithoutId.email }),
    ...(nativeWithoutId.phone && { phone: nativeWithoutId.phone }),
    ...(nativeWithoutId.address && { address: nativeWithoutId.address }),
    ...(nativeWithoutId.initial_shares_authorized !== undefined && {
      initial_shares_authorized: nativeWithoutId.initial_shares_authorized
    }),
    ...(nativeWithoutId.comments && { comments: nativeWithoutId.comments })
  };

  return { issuer: ocfIssuer, contractId: params.contractId };
}
