import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlStakeholderDataToNative } from '../../utils/typeConversions';

export interface OcfStakeholder {
  object_type: 'STAKEHOLDER';
  id?: string;
  name: { legal_name: string; first_name?: string; last_name?: string };
  stakeholder_type: 'INDIVIDUAL' | 'INSTITUTION';
  issuer_assigned_id?: string;
  current_relationships?: string[];
  primary_contact?: {
    name: { legal_name: string; first_name?: string; last_name?: string };
    phone_numbers?: Array<{ phone_type: 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER'; phone_number: string }>;
    emails?: Array<{ email_type: 'PERSONAL' | 'BUSINESS' | 'OTHER'; email_address: string }>;
  };
  contact_info?: {
    phone_numbers?: Array<{ phone_type: 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER'; phone_number: string }>;
    emails?: Array<{ email_type: 'PERSONAL' | 'BUSINESS' | 'OTHER'; email_address: string }>;
  };
  addresses: Array<{
    address_type: 'LEGAL' | 'CONTACT' | 'OTHER';
    street_suite?: string;
    city?: string;
    country_subdivision?: string;
    country: string;
    postal_code?: string;
  }>;
  tax_ids: Array<{ tax_id: string; country: string }>;
  comments?: string[];
}

export interface GetStakeholderAsOcfParams {
  contractId: string;
}

export interface GetStakeholderAsOcfResult {
  stakeholder: OcfStakeholder;
  contractId: string;
}

/**
 * Retrieve a stakeholder contract by ID and return it as an OCF JSON object
 */
export async function getStakeholderAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderAsOcfParams
): Promise<GetStakeholderAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.contractId
  });

  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }

  const createArgument = eventsResponse.created.createdEvent.createArgument;

  function hasStakeholderData(arg: unknown): arg is { stakeholder_data: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData } {
    return typeof arg === 'object' && arg !== null && 'stakeholder_data' in arg && typeof (arg as any).stakeholder_data === 'object';
  }

  if (!hasStakeholderData(createArgument)) {
    throw new Error('Stakeholder data not found in contract create argument');
  }

  const native = damlStakeholderDataToNative(createArgument.stakeholder_data);

  const ocfStakeholder: OcfStakeholder = {
    object_type: 'STAKEHOLDER',
    id: params.contractId,
    name: native.name as any,
    stakeholder_type: native.stakeholder_type,
    ...(native.issuer_assigned_id && { issuer_assigned_id: native.issuer_assigned_id }),
    ...(native.current_relationships && { current_relationships: native.current_relationships }),
    ...(native.primary_contact && { primary_contact: native.primary_contact as any }),
    ...(native.contact_info && { contact_info: native.contact_info as any }),
    addresses: native.addresses,
    tax_ids: native.tax_ids,
    ...(native.comments && { comments: native.comments })
  };

  return { stakeholder: ocfStakeholder, contractId: params.contractId };
}
