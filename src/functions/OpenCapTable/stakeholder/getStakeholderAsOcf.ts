import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { ContactInfo, ContactInfoWithoutName, Email, Name, Phone } from '../../../types/native';
import {
  damlEmailTypeToNative,
  damlPhoneTypeToNative,
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  damlStakeholderTypeToNative,
} from '../../../utils/enumConversions';
import { damlAddressToNative } from '../../../utils/typeConversions';

function damlEmailToNative(damlEmail: Fairmint.OpenCapTable.Types.Contact.OcfEmail): Email {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address,
  };
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.Contact.OcfPhone): Phone {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function damlContactInfoToNative(damlInfo: Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfo): ContactInfo {
  // Validate required field
  if (!damlInfo.name.legal_name) {
    throw new OcpValidationError('contactInfo.name.legal_name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: damlInfo.name.legal_name,
    });
  }

  const name: Name = {
    legal_name: damlInfo.name.legal_name,
    ...(damlInfo.name.first_name ? { first_name: damlInfo.name.first_name } : {}),
    ...(damlInfo.name.last_name ? { last_name: damlInfo.name.last_name } : {}),
  };
  const phones: Phone[] = damlInfo.phone_numbers.map(damlPhoneToNative);
  const emails: Email[] = damlInfo.emails.map(damlEmailToNative);
  return {
    name,
    phone_numbers: phones,
    emails,
  } as ContactInfo;
}

function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  const phones: Phone[] = damlInfo.phone_numbers.map(damlPhoneToNative);
  const emails: Email[] = damlInfo.emails.map(damlEmailToNative);
  return {
    phone_numbers: phones,
    emails,
  } as ContactInfoWithoutName;
}

function damlStakeholderDataToNative(
  damlData: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData
): Omit<OcfStakeholderOutput, 'object_type'> {
  const dAny = damlData as unknown as Record<string, unknown>;
  const nameData = dAny.name as Record<string, unknown> | undefined;
  const name: Name = {
    legal_name: (nameData?.legal_name as string | undefined) ?? '',
    ...(nameData?.first_name ? { first_name: nameData.first_name as string } : {}),
    ...(nameData?.last_name ? { last_name: nameData.last_name as string } : {}),
  };
  const relationships: string[] = Array.isArray(dAny.current_relationships)
    ? (dAny.current_relationships as string[]).map((r) =>
        damlStakeholderRelationshipToNative(r as Fairmint.OpenCapTable.Types.Stakeholder.OcfStakeholderRelationshipType)
      )
    : [];
  const dataWithId = dAny as { id?: string };
  const native: Omit<OcfStakeholderOutput, 'object_type'> = {
    id: dataWithId.id ?? '',
    name,
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id ? { issuer_assigned_id: damlData.issuer_assigned_id } : {}),
    current_relationships: relationships,
    ...(dAny.current_status
      ? {
          current_status: damlStakeholderStatusToNative(dAny.current_status as string),
        }
      : {}),
    ...(damlData.primary_contact && {
      primary_contact: damlContactInfoToNative(damlData.primary_contact),
    }),
    ...(damlData.contact_info && {
      contact_info: damlContactInfoWithoutNameToNative(damlData.contact_info),
    }),
    addresses: damlData.addresses.map(damlAddressToNative),
    tax_ids: damlData.tax_ids,
    ...(Array.isArray((dAny as { comments?: unknown }).comments) && (dAny as { comments: string[] }).comments.length > 0
      ? { comments: (dAny as { comments: string[] }).comments }
      : {}),
  } as Omit<OcfStakeholderOutput, 'object_type'>;
  return native;
}

interface OcfStakeholderOutput {
  object_type: 'STAKEHOLDER';
  id?: string;
  name: { legal_name: string; first_name?: string; last_name?: string };
  stakeholder_type: 'INDIVIDUAL' | 'INSTITUTION';
  issuer_assigned_id?: string;
  current_relationships?: string[];
  primary_contact?: {
    name: { legal_name: string; first_name?: string; last_name?: string };
    phone_numbers?: Array<{
      phone_type: 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER';
      phone_number: string;
    }>;
    emails?: Array<{ email_type: 'PERSONAL' | 'BUSINESS' | 'OTHER'; email_address: string }>;
  };
  contact_info?: {
    phone_numbers?: Array<{
      phone_type: 'HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER';
      phone_number: string;
    }>;
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
  stakeholder: OcfStakeholderOutput;
  contractId: string;
}

/** Retrieve a stakeholder contract by ID and return it as an OCF JSON object */
export async function getStakeholderAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderAsOcfParams
): Promise<GetStakeholderAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.contractId,
  });

  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpParseError('Invalid contract events response: missing created event or create argument', {
      source: `contract ${params.contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasStakeholderData(
    arg: unknown
  ): arg is { stakeholder_data: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'stakeholder_data' in record &&
      typeof record.stakeholder_data === 'object'
    );
  }

  if (!hasStakeholderData(createArgument)) {
    throw new OcpParseError('Stakeholder data not found in contract create argument', {
      source: 'stakeholder contract',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlStakeholderDataToNative(createArgument.stakeholder_data);

  const ocfStakeholder: OcfStakeholderOutput = {
    object_type: 'STAKEHOLDER',
    ...native,
    addresses: native.addresses,
    tax_ids: native.tax_ids,
  };

  return { stakeholder: ocfStakeholder, contractId: params.contractId };
}
