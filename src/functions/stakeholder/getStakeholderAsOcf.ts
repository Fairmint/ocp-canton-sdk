import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlAddressToNative } from '../../utils/typeConversions';
import { OcfStakeholderData, Name, StakeholderType, EmailType, PhoneType, ContactInfo, ContactInfoWithoutName, Email, Phone } from '../../types/native';

function damlEmailTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfEmailType): EmailType {
  switch (damlType) {
    case 'OcfEmailTypePersonal': return 'PERSONAL';
    case 'OcfEmailTypeBusiness': return 'BUSINESS';
    case 'OcfEmailTypeOther': return 'OTHER';
    default: throw new Error(`Unknown DAML email type: ${damlType}`);
  }
}

function damlEmailToNative(damlEmail: Fairmint.OpenCapTable.Types.OcfEmail): Email {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address
  };
}

function damlPhoneTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfPhoneType): PhoneType {
  switch (damlType) {
    case 'OcfPhoneHome': return 'HOME';
    case 'OcfPhoneMobile': return 'MOBILE';
    case 'OcfPhoneBusiness': return 'BUSINESS';
    case 'OcfPhoneOther': return 'OTHER';
    default: throw new Error(`Unknown DAML phone type: ${damlType}`);
  }
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.OcfPhone): Phone {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number
  };
}

function damlContactInfoToNative(damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfo): ContactInfo {
  const name: Name = {
    legal_name: damlInfo.name.legal_name || '',
    ...(damlInfo.name.first_name ? { first_name: damlInfo.name.first_name } : {}),
    ...(damlInfo.name.last_name ? { last_name: damlInfo.name.last_name } : {})
  };
  const phones: Phone[] = (damlInfo.phone_numbers || []).map(damlPhoneToNative);
  const emails: Email[] = (damlInfo.emails || []).map(damlEmailToNative);
  return {
    name,
    phone_numbers: phones,
    emails
  } as ContactInfo;
}

function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  const phones: Phone[] = (damlInfo.phone_numbers || []).map(damlPhoneToNative);
  const emails: Email[] = (damlInfo.emails || []).map(damlEmailToNative);
  return {
    phone_numbers: phones,
    emails
  } as ContactInfoWithoutName;
}

function damlStakeholderTypeToNative(damlType: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderType): StakeholderType {
  switch (damlType) {
    case 'OcfStakeholderTypeIndividual':
      return 'INDIVIDUAL';
    case 'OcfStakeholderTypeInstitution':
      return 'INSTITUTION';
    default:
      throw new Error(`Unknown DAML stakeholder type: ${damlType}`);
  }
}

function damlStakeholderDataToNative(
  damlData: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData
): OcfStakeholderData {
  const dAny = damlData as unknown as { [k: string]: any };
  const name: Name = {
    legal_name: (dAny.name?.legal_name || '') as string,
    ...(dAny.name?.first_name ? { first_name: dAny.name.first_name } : {}),
    ...(dAny.name?.last_name ? { last_name: dAny.name.last_name } : {})
  };
  const mapRelBack = (s: string): string | undefined => {
    switch (s) {
      case 'OcfRelEmployee': return 'EMPLOYEE';
      case 'OcfRelAdvisor': return 'ADVISOR';
      case 'OcfRelInvestor': return 'INVESTOR';
      case 'OcfRelFounder': return 'FOUNDER';
      case 'OcfRelBoardMember': return 'BOARD_MEMBER';
      case 'OcfRelOfficer': return 'OFFICER';
      case 'OcfRelOther': return 'OTHER';
      default: return undefined;
    }
  };
  const relationships: string[] = Array.isArray(dAny.current_relationships)
    ? (dAny.current_relationships as string[]).map(r => mapRelBack(r) || 'OTHER')
    : [];
  const native: OcfStakeholderData = {
    ...(dAny.id ? { id: dAny.id as string } : {}),
    name,
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id && { issuer_assigned_id: damlData.issuer_assigned_id }),
    current_relationships: relationships,
    ...(dAny.current_status && { current_status: ((): string | undefined => {
      const s = dAny.current_status as string;
      switch (s) {
        case 'OcfStakeholderStatusActive': return 'ACTIVE';
        case 'OcfStakeholderStatusLeaveOfAbsence': return 'LEAVE_OF_ABSENCE';
        case 'OcfStakeholderStatusTerminationVoluntaryOther': return 'TERMINATION_VOLUNTARY_OTHER';
        case 'OcfStakeholderStatusTerminationVoluntaryGoodCause': return 'TERMINATION_VOLUNTARY_GOOD_CAUSE';
        case 'OcfStakeholderStatusTerminationVoluntaryRetirement': return 'TERMINATION_VOLUNTARY_RETIREMENT';
        case 'OcfStakeholderStatusTerminationInvoluntaryOther': return 'TERMINATION_INVOLUNTARY_OTHER';
        case 'OcfStakeholderStatusTerminationInvoluntaryDeath': return 'TERMINATION_INVOLUNTARY_DEATH';
        case 'OcfStakeholderStatusTerminationInvoluntaryDisability': return 'TERMINATION_INVOLUNTARY_DISABILITY';
        case 'OcfStakeholderStatusTerminationInvoluntaryWithCause': return 'TERMINATION_INVOLUNTARY_WITH_CAUSE';
        default: return undefined;
      }
    })() }),
    ...(damlData.primary_contact && { primary_contact: damlContactInfoToNative(damlData.primary_contact) }),
    ...(damlData.contact_info && { contact_info: damlContactInfoWithoutNameToNative(damlData.contact_info) }),
    addresses: (damlData.addresses || []).map(damlAddressToNative),
    tax_ids: (damlData.tax_ids || []),
    comments: (Array.isArray((dAny as { comments?: unknown }).comments) ? (dAny as { comments: string[] }).comments : [])
  } as OcfStakeholderData;
  return native;
}

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
  const { id, ...nativeWithoutId } = native as any;

  const ocfStakeholder: OcfStakeholder = {
    object_type: 'STAKEHOLDER',
    id,
    name: nativeWithoutId.name as any,
    stakeholder_type: nativeWithoutId.stakeholder_type,
    ...(nativeWithoutId.issuer_assigned_id && { issuer_assigned_id: nativeWithoutId.issuer_assigned_id }),
    ...(Array.isArray(nativeWithoutId.current_relationships) && nativeWithoutId.current_relationships.length > 0
      ? { current_relationships: nativeWithoutId.current_relationships }
      : {}),
    ...(nativeWithoutId.primary_contact && { primary_contact: nativeWithoutId.primary_contact as any }),
    ...(nativeWithoutId.contact_info && { contact_info: nativeWithoutId.contact_info as any }),
    addresses: nativeWithoutId.addresses,
    tax_ids: nativeWithoutId.tax_ids,
    ...(Array.isArray(nativeWithoutId.comments) && nativeWithoutId.comments.length > 0
      ? { comments: nativeWithoutId.comments }
      : {})
  };

  return { stakeholder: ocfStakeholder, contractId: params.contractId };
}
