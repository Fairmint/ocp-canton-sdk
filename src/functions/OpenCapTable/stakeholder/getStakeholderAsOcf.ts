import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  ContactInfo,
  ContactInfoWithoutName,
  Email,
  Name,
  OcfStakeholder,
  Phone,
  StakeholderRelationshipType,
} from '../../../types/native';
import {
  damlEmailTypeToNative,
  damlPhoneTypeToNative,
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  damlStakeholderTypeToNative,
} from '../../../utils/enumConversions';
import { damlAddressToNative } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

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
  };
}

function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  const phones: Phone[] = damlInfo.phone_numbers.map(damlPhoneToNative);
  const emails: Email[] = damlInfo.emails.map(damlEmailToNative);
  return {
    phone_numbers: phones,
    emails,
  };
}

export function damlStakeholderDataToNative(
  damlData: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData
): OcfStakeholder {
  const dAny = damlData as unknown as Record<string, unknown>;
  const { id } = dAny;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stakeholder.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }

  const nameData = dAny.name;
  if (typeof nameData !== 'object' || nameData === null || Array.isArray(nameData)) {
    throw new OcpValidationError('stakeholder.name', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: nameData,
    });
  }
  const legalName = (nameData as Record<string, unknown>).legal_name;
  if (typeof legalName !== 'string' || legalName.length === 0) {
    throw new OcpValidationError('stakeholder.name.legal_name', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: legalName,
    });
  }
  const nameRecord = nameData as Record<string, unknown>;
  const name: Name = {
    legal_name: legalName,
    ...(typeof nameRecord.first_name === 'string' && nameRecord.first_name.length > 0
      ? { first_name: nameRecord.first_name }
      : {}),
    ...(typeof nameRecord.last_name === 'string' && nameRecord.last_name.length > 0
      ? { last_name: nameRecord.last_name }
      : {}),
  };
  const relationships: StakeholderRelationshipType[] = Array.isArray(dAny.current_relationships)
    ? (dAny.current_relationships as string[]).map((r) =>
        damlStakeholderRelationshipToNative(r as Fairmint.OpenCapTable.Types.Stakeholder.OcfStakeholderRelationshipType)
      )
    : [];
  const native: OcfStakeholder = {
    object_type: 'STAKEHOLDER',
    id,
    name,
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id ? { issuer_assigned_id: damlData.issuer_assigned_id } : {}),
    current_relationships: relationships,
    ...(dAny.current_status
      ? {
          current_status: damlStakeholderStatusToNative(
            dAny.current_status as Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType
          ),
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
  };
  return native;
}

export interface GetStakeholderAsOcfParams extends GetByContractIdParams {}

export interface GetStakeholderAsOcfResult {
  stakeholder: OcfStakeholder;
  contractId: string;
}

/**
 * Retrieve a stakeholder contract by ID and return native OCF-shaped data plus contract id.
 *
 * @param client - Ledger JSON API client
 * @param params - Contract id (and optional read scope) for the stakeholder template
 * @returns Raw `{ stakeholder, contractId }`; {@link OcpClient.OpenCapTable.stakeholder.get} adapts to `ContractResult`.
 * @throws OcpParseError / OcpValidationError when contract data cannot be read or is invalid
 */
export async function getStakeholderAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderAsOcfParams
): Promise<GetStakeholderAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
    missingDataError: 'parse',
  });

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

  const stakeholder = damlStakeholderDataToNative(createArgument.stakeholder_data);

  return { stakeholder, contractId: params.contractId };
}
