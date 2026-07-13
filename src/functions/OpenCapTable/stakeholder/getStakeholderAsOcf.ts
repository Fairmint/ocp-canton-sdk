import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { DeepReadonly, GetByContractIdParams } from '../../../types/common';
import type {
  ContactInfo,
  ContactInfoWithoutName,
  Email,
  Name,
  Phone,
  StakeholderRelationshipType,
} from '../../../types/native';
import type { OcfStakeholderOutput } from '../../../types/output';
import { validateStakeholderData } from '../../../utils/entityValidators';
import {
  damlEmailTypeToNative,
  damlPhoneTypeToNative,
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  damlStakeholderTypeToNative,
} from '../../../utils/enumConversions';
import { requireGeneratedRecord } from '../../../utils/generatedDamlValidation';
import { damlAddressToNative, isRecord } from '../../../utils/typeConversions';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';

function damlEmailToNative(damlEmail: Fairmint.OpenCapTable.Types.Contact.OcfEmail): DeepReadonly<Email> {
  return Object.freeze({
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address,
  });
}

function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.Contact.OcfPhone): DeepReadonly<Phone> {
  return Object.freeze({
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number,
  });
}

function damlContactInfoToNative(
  damlInfo: DeepReadonly<Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfo>
): DeepReadonly<ContactInfo> {
  // Validate required field
  if (!damlInfo.name.legal_name) {
    throw new OcpValidationError('contactInfo.name.legal_name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: damlInfo.name.legal_name,
    });
  }

  const name = Object.freeze({
    legal_name: damlInfo.name.legal_name,
    ...(damlInfo.name.first_name ? { first_name: damlInfo.name.first_name } : {}),
    ...(damlInfo.name.last_name ? { last_name: damlInfo.name.last_name } : {}),
  }) satisfies DeepReadonly<Name>;
  const phones = Object.freeze(damlInfo.phone_numbers.map(damlPhoneToNative));
  const emails = Object.freeze(damlInfo.emails.map(damlEmailToNative));
  return Object.freeze({
    name,
    phone_numbers: phones,
    emails,
  });
}

function damlContactInfoWithoutNameToNative(
  damlInfo: DeepReadonly<Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfoWithoutName>
): DeepReadonly<ContactInfoWithoutName> {
  const phones = Object.freeze(damlInfo.phone_numbers.map(damlPhoneToNative));
  const emails = Object.freeze(damlInfo.emails.map(damlEmailToNative));
  return Object.freeze({
    phone_numbers: phones,
    emails,
  });
}

export function damlStakeholderDataToNative(value: unknown): OcfStakeholderOutput {
  // Keep the established direct-converter nullish diagnostics without walking
  // non-null hostile graphs before the bounded generated-DAML decoder owns them.
  if (value === null || value === undefined) {
    assertCanonicalJsonGraph(value, 'stakeholder');
    requireGeneratedRecord(value, 'stakeholder');
  }
  const data = decodeDamlEntityData('stakeholder', value);
  const { id: generatedId } = data;
  const id: unknown = generatedId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stakeholder.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }

  const nameData: unknown = data.name;
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
  const name = Object.freeze({
    legal_name: legalName,
    ...(typeof nameData.first_name === 'string' && nameData.first_name.length > 0
      ? { first_name: nameData.first_name }
      : {}),
    ...(typeof nameData.last_name === 'string' && nameData.last_name.length > 0
      ? { last_name: nameData.last_name }
      : {}),
  }) satisfies DeepReadonly<Name>;
  const relationships = Object.freeze(
    data.current_relationships.map(damlStakeholderRelationshipToNative)
  ) satisfies readonly StakeholderRelationshipType[];
  const addresses = Object.freeze(data.addresses.map((address) => Object.freeze(damlAddressToNative(address))));
  const taxIds = Object.freeze(data.tax_ids.map((taxId) => Object.freeze({ ...taxId })));
  const comments = Object.freeze([...data.comments]);
  const native = {
    object_type: 'STAKEHOLDER',
    id,
    name,
    stakeholder_type: damlStakeholderTypeToNative(data.stakeholder_type),
    ...(data.issuer_assigned_id ? { issuer_assigned_id: data.issuer_assigned_id } : {}),
    current_relationships: relationships,
    ...(data.current_status
      ? {
          current_status: damlStakeholderStatusToNative(data.current_status),
        }
      : {}),
    ...(data.primary_contact && {
      primary_contact: damlContactInfoToNative(data.primary_contact),
    }),
    ...(data.contact_info && {
      contact_info: damlContactInfoWithoutNameToNative(data.contact_info),
    }),
    addresses,
    tax_ids: taxIds,
    ...(comments.length > 0 ? { comments } : {}),
  } satisfies OcfStakeholderOutput;
  validateStakeholderData(native, 'stakeholder');
  return Object.freeze(native);
}

export interface GetStakeholderAsOcfParams extends GetByContractIdParams {}

export interface GetStakeholderAsOcfResult {
  readonly stakeholder: OcfStakeholderOutput;
  readonly contractId: string;
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

  return Object.freeze({ stakeholder, contractId: params.contractId });
}
