import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
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
import { damlAddressToNative, isRecord } from '../../../utils/typeConversions';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
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
  const { id: generatedId } = damlData;
  const id: unknown = generatedId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stakeholder.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }

  const nameData: unknown = damlData.name;
  if (!isRecord(nameData)) {
    throw new OcpValidationError('stakeholder.name', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: nameData,
    });
  }
  const legalName = nameData.legal_name;
  if (typeof legalName !== 'string' || legalName.length === 0) {
    throw new OcpValidationError('stakeholder.name.legal_name', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: legalName,
    });
  }
  const name: Name = {
    legal_name: legalName,
    ...(typeof nameData.first_name === 'string' && nameData.first_name.length > 0
      ? { first_name: nameData.first_name }
      : {}),
    ...(typeof nameData.last_name === 'string' && nameData.last_name.length > 0
      ? { last_name: nameData.last_name }
      : {}),
  };
  const relationships: StakeholderRelationshipType[] = damlData.current_relationships.map(
    damlStakeholderRelationshipToNative
  );
  const native: OcfStakeholder = {
    object_type: 'STAKEHOLDER',
    id,
    name,
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id ? { issuer_assigned_id: damlData.issuer_assigned_id } : {}),
    current_relationships: relationships,
    ...(damlData.current_status
      ? {
          current_status: damlStakeholderStatusToNative(damlData.current_status),
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
    ...(damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
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
  const stakeholderData = extractAndDecodeDamlEntityData('stakeholder', createArgument);
  const stakeholder = damlStakeholderDataToNative(stakeholderData);

  return { stakeholder, contractId: params.contractId };
}
