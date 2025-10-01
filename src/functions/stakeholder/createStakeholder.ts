import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStakeholderData, CommandWithDisclosedContracts, Name, StakeholderType, EmailType, PhoneType, ContactInfo, ContactInfoWithoutName } from '../../types';
import { addressToDaml } from '../../utils/typeConversions';

function stakeholderTypeToDaml(stakeholderType: StakeholderType): Fairmint.OpenCapTable.Stakeholder.OcfStakeholderType {
  switch (stakeholderType) {
    case 'INDIVIDUAL':
      return 'OcfStakeholderTypeIndividual';
    case 'INSTITUTION':
      return 'OcfStakeholderTypeInstitution';
    default:
      throw new Error(`Unknown stakeholder type: ${stakeholderType}`);
  }
}

function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
  switch (emailType) {
    case 'PERSONAL': return 'OcfEmailTypePersonal';
    case 'BUSINESS': return 'OcfEmailTypeBusiness';
    case 'OTHER': return 'OcfEmailTypeOther';
    default: throw new Error(`Unknown email type: ${emailType}`);
  }
}

function emailToDaml(email: { email_type: EmailType; email_address: string }): Fairmint.OpenCapTable.Types.OcfEmail {
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address
  };
}

function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
  switch (phoneType) {
    case 'HOME': return 'OcfPhoneHome';
    case 'MOBILE': return 'OcfPhoneMobile';
    case 'BUSINESS': return 'OcfPhoneBusiness';
    case 'OTHER': return 'OcfPhoneOther';
    default: throw new Error(`Unknown phone type: ${phoneType}`);
  }
}

function phoneToDaml(phone: { phone_type: PhoneType; phone_number: string }): Fairmint.OpenCapTable.Types.OcfPhone {
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number
  };
}

function nameToDaml(n: Name): Fairmint.OpenCapTable.Stakeholder.OcfName {
  return {
    legal_name: n.legal_name,
    first_name: n.first_name || null,
    last_name: n.last_name || null
  };
}

function contactInfoToDaml(info: ContactInfo): Fairmint.OpenCapTable.Stakeholder.OcfContactInfo {
  return {
    name: nameToDaml(info.name),
    phone_numbers: (info.phone_numbers || []).map(phoneToDaml),
    emails: (info.emails || []).map(emailToDaml)
  };
}

function contactInfoWithoutNameToDaml(info: ContactInfoWithoutName): Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName | null {
  const phones = (info.phone_numbers || []).map(phoneToDaml);
  const emails = (info.emails || []).map(emailToDaml);
  
  if (phones.length === 0 && emails.length === 0) {
    return null;
  }

  return {
    phone_numbers: phones,
    emails: emails
  };
}

function stakeholderDataToDaml(data: OcfStakeholderData): Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData {
  if (!data.id) throw new Error('stakeholder.id is required');
  const payload: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData = {
    id: data.id,
    name: nameToDaml(data.name),
    stakeholder_type: stakeholderTypeToDaml(data.stakeholder_type),
    issuer_assigned_id: data.issuer_assigned_id || null,
    primary_contact: data.primary_contact ? contactInfoToDaml(data.primary_contact) : null,
    contact_info: data.contact_info ? contactInfoWithoutNameToDaml(data.contact_info) : null,
    addresses: (data.addresses || []).map(addressToDaml),
    tax_ids: (data.tax_ids || []),
    comments: data.comments || []
  } as any;
  
  const dataWithSingular = data as OcfStakeholderData & { current_relationship?: string };
  const relationships = data.current_relationships 
    || (dataWithSingular.current_relationship ? [dataWithSingular.current_relationship] : []);
  
  if (relationships && relationships.length) {
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
    payload.current_relationships = relationships.map(mapRel);
  }
  if (data.current_status) {
    const status: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderStatusType = (
      data.current_status === 'ACTIVE' ? 'OcfStakeholderStatusActive' :
      data.current_status === 'LEAVE_OF_ABSENCE' ? 'OcfStakeholderStatusLeaveOfAbsence' :
      data.current_status === 'TERMINATION_VOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationVoluntaryOther' :
      data.current_status === 'TERMINATION_VOLUNTARY_GOOD_CAUSE' ? 'OcfStakeholderStatusTerminationVoluntaryGoodCause' :
      data.current_status === 'TERMINATION_VOLUNTARY_RETIREMENT' ? 'OcfStakeholderStatusTerminationVoluntaryRetirement' :
      data.current_status === 'TERMINATION_INVOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationInvoluntaryOther' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DEATH' ? 'OcfStakeholderStatusTerminationInvoluntaryDeath' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DISABILITY' ? 'OcfStakeholderStatusTerminationInvoluntaryDisability' :
      'OcfStakeholderStatusTerminationInvoluntaryWithCause'
    );
    payload.current_status = status;
  }
  return payload;
}

export interface CreateStakeholderParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  stakeholderData: OcfStakeholderData;
}

export function buildCreateStakeholderCommand(params: CreateStakeholderParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStakeholder = {
    stakeholder_data: stakeholderDataToDaml(params.stakeholderData)
  } as any;

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStakeholder',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}
