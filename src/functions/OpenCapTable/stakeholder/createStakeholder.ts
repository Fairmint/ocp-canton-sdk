import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type {
  ContactInfo,
  ContactInfoWithoutName,
  EmailType,
  Name,
  OcfStakeholderData,
  PhoneType,
  StakeholderType,
} from '../../../types';
import { addressToDaml, cleanComments, optionalString } from '../../../utils/typeConversions';

function stakeholderTypeToDaml(
  stakeholderType: StakeholderType
): Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderType {
  switch (stakeholderType) {
    case 'INDIVIDUAL':
      return 'OcfStakeholderTypeIndividual';
    case 'INSTITUTION':
      return 'OcfStakeholderTypeInstitution';
    default: {
      const exhaustiveCheck: never = stakeholderType;
      throw new Error(`Unknown stakeholder type: ${exhaustiveCheck as string}`);
    }
  }
}

function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
  switch (emailType) {
    case 'PERSONAL':
      return 'OcfEmailTypePersonal';
    case 'BUSINESS':
      return 'OcfEmailTypeBusiness';
    case 'OTHER':
      return 'OcfEmailTypeOther';
    default: {
      const exhaustiveCheck: never = emailType;
      throw new Error(`Unknown email type: ${exhaustiveCheck as string}`);
    }
  }
}

function emailToDaml(email: { email_type: EmailType; email_address: string }): Fairmint.OpenCapTable.Types.OcfEmail {
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address,
  };
}

function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
  switch (phoneType) {
    case 'HOME':
      return 'OcfPhoneHome';
    case 'MOBILE':
      return 'OcfPhoneMobile';
    case 'BUSINESS':
      return 'OcfPhoneBusiness';
    case 'OTHER':
      return 'OcfPhoneOther';
    default: {
      const exhaustiveCheck: never = phoneType;
      throw new Error(`Unknown phone type: ${exhaustiveCheck as string}`);
    }
  }
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

export function stakeholderDataToDaml(
  data: OcfStakeholderData
): Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData {
  if (!data.id) throw new Error('stakeholder.id is required');

  const dataWithSingular = data as OcfStakeholderData & { current_relationship?: string };
  const relationships =
    (data.current_relationships ?? []).length > 0
      ? data.current_relationships
      : dataWithSingular.current_relationship
        ? [dataWithSingular.current_relationship]
        : [];

  const mapRel = (r: string): Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType => {
    const v = r.toUpperCase();
    if (v.includes('EMPLOYEE')) return 'OcfRelEmployee';
    if (v.includes('ADVISOR')) return 'OcfRelAdvisor';
    if (v.includes('INVESTOR')) return 'OcfRelInvestor';
    if (v.includes('FOUNDER')) return 'OcfRelFounder';
    if (v.includes('BOARD')) return 'OcfRelBoardMember';
    if (v.includes('OFFICER')) return 'OcfRelOfficer';
    return 'OcfRelOther';
  };

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
    current_relationships: relationships?.map(mapRel) ?? [],
    current_status: data.current_status
      ? data.current_status === 'ACTIVE'
        ? 'OcfStakeholderStatusActive'
        : data.current_status === 'LEAVE_OF_ABSENCE'
          ? 'OcfStakeholderStatusLeaveOfAbsence'
          : data.current_status === 'TERMINATION_VOLUNTARY_OTHER'
            ? 'OcfStakeholderStatusTerminationVoluntaryOther'
            : data.current_status === 'TERMINATION_VOLUNTARY_GOOD_CAUSE'
              ? 'OcfStakeholderStatusTerminationVoluntaryGoodCause'
              : data.current_status === 'TERMINATION_VOLUNTARY_RETIREMENT'
                ? 'OcfStakeholderStatusTerminationVoluntaryRetirement'
                : data.current_status === 'TERMINATION_INVOLUNTARY_OTHER'
                  ? 'OcfStakeholderStatusTerminationInvoluntaryOther'
                  : data.current_status === 'TERMINATION_INVOLUNTARY_DEATH'
                    ? 'OcfStakeholderStatusTerminationInvoluntaryDeath'
                    : data.current_status === 'TERMINATION_INVOLUNTARY_DISABILITY'
                      ? 'OcfStakeholderStatusTerminationInvoluntaryDisability'
                      : 'OcfStakeholderStatusTerminationInvoluntaryWithCause'
      : null,
  };

  return payload;
}
