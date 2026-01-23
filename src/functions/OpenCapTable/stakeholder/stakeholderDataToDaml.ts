import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpValidationError } from '../../../errors';
import type { ContactInfo, ContactInfoWithoutName, EmailType, Name, OcfStakeholder, PhoneType } from '../../../types';
import {
  emailTypeToDaml,
  phoneTypeToDaml,
  stakeholderRelationshipToDaml,
  stakeholderStatusToDaml,
  stakeholderTypeToDaml,
} from '../../../utils/enumConversions';
import { addressToDaml, cleanComments, optionalString } from '../../../utils/typeConversions';

function emailToDaml(email: { email_type: EmailType; email_address: string }): Fairmint.OpenCapTable.Types.OcfEmail {
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address,
  };
}

function phoneToDaml(phone: { phone_type: PhoneType; phone_number: string }): Fairmint.OpenCapTable.Types.OcfPhone {
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number,
  };
}

function nameToDaml(n: Name): Fairmint.OpenCapTable.OCF.Stakeholder.OcfName {
  return {
    legal_name: n.legal_name,
    first_name: optionalString(n.first_name),
    last_name: optionalString(n.last_name),
  };
}

function contactInfoToDaml(info: ContactInfo): Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfo {
  return {
    name: nameToDaml(info.name),
    phone_numbers: (info.phone_numbers ?? []).map(phoneToDaml),
    emails: (info.emails ?? []).map(emailToDaml),
  };
}

function contactInfoWithoutNameToDaml(
  info: ContactInfoWithoutName
): Fairmint.OpenCapTable.OCF.Stakeholder.OcfContactInfoWithoutName | null {
  const phones = (info.phone_numbers ?? []).map(phoneToDaml);
  const emails = (info.emails ?? []).map(emailToDaml);

  if (phones.length === 0 && emails.length === 0) {
    return null;
  }

  return {
    phone_numbers: phones,
    emails,
  };
}

export function stakeholderDataToDaml(data: OcfStakeholder): Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData {
  if (!data.id) {
    throw new OcpValidationError('stakeholder.id', 'Required field is missing or empty', {
      expectedType: 'string',
      receivedValue: data.id,
    });
  }

  const dataWithSingular = data as OcfStakeholder & { current_relationship?: string };
  const relationships =
    (data.current_relationships ?? []).length > 0
      ? data.current_relationships
      : dataWithSingular.current_relationship
        ? [dataWithSingular.current_relationship]
        : [];

  const payload: Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData = {
    id: data.id,
    name: nameToDaml(data.name),
    stakeholder_type: stakeholderTypeToDaml(data.stakeholder_type),
    issuer_assigned_id: optionalString(data.issuer_assigned_id),
    primary_contact: data.primary_contact ? contactInfoToDaml(data.primary_contact) : null,
    contact_info: data.contact_info ? contactInfoWithoutNameToDaml(data.contact_info) : null,
    addresses: (data.addresses ?? []).map(addressToDaml),
    tax_ids: data.tax_ids ?? [],
    comments: cleanComments(data.comments),
    current_relationships: relationships?.map(stakeholderRelationshipToDaml) ?? [],
    current_status: data.current_status ? stakeholderStatusToDaml(data.current_status) : null,
  };

  return payload;
}
