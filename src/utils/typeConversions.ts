/**
 * Utility functions to convert between DAML types and TypeScript-native types
 * 
 * This file contains ONLY shared helper functions used by multiple entity conversion files.
 * Entity-specific conversions have been moved to their respective function files.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  EmailType,
  AddressType,
  PhoneType,
  StockClassType,
  Monetary,
  Email,
  Address,
  Phone,
  StakeholderType,
  ContactInfo,
  ContactInfoWithoutName,
  Name,
} from '../types/native';

// ===== Date Conversion Helpers =====

/**
 * Convert a date string (YYYY-MM-DD) to DAML Time format (ISO string with 0 timestamp)
 * DAML Time expects a string in the format YYYY-MM-DDTHH:MM:SS.000Z
 * Since we only care about the date, we use 00:00:00.000Z for the time portion
 * If the date already has a time portion, return it as-is
 */
export function dateStringToDAMLTime(dateString: string): string {
  // If already has time portion, return as-is
  if (dateString.includes('T')) {
    return dateString;
  }
  return `${dateString}T00:00:00.000Z`;
}

/**
 * Convert a DAML Time string back to a date string (YYYY-MM-DD)
 * Extract only the date portion and return as string
 */
export function damlTimeToDateString(timeString: string): string {
  // Extract just the date portion (YYYY-MM-DD)
  return timeString.split('T')[0];
}

// ===== Email Type Conversions (Internal Helpers) =====

function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
  switch (emailType) {
    case 'PERSONAL':
      return 'OcfEmailTypePersonal';
    case 'BUSINESS':
      return 'OcfEmailTypeBusiness';
    case 'OTHER':
      return 'OcfEmailTypeOther';
    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
}

function damlEmailTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfEmailType): EmailType {
  switch (damlType) {
    case 'OcfEmailTypePersonal':
      return 'PERSONAL';
    case 'OcfEmailTypeBusiness':
      return 'BUSINESS';
    case 'OcfEmailTypeOther':
      return 'OTHER';
    default:
      throw new Error(`Unknown DAML email type: ${damlType}`);
  }
}

// ===== Address Type Conversions (Internal Helpers) =====

function addressTypeToDaml(addressType: AddressType): Fairmint.OpenCapTable.Types.OcfAddressType {
  switch (addressType) {
    case 'LEGAL':
      return 'OcfAddressTypeLegal';
    case 'CONTACT':
      return 'OcfAddressTypeContact';
    case 'OTHER':
      return 'OcfAddressTypeOther';
    default:
      throw new Error(`Unknown address type: ${addressType}`);
  }
}

function damlAddressTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfAddressType): AddressType {
  switch (damlType) {
    case 'OcfAddressTypeLegal':
      return 'LEGAL';
    case 'OcfAddressTypeContact':
      return 'CONTACT';
    case 'OcfAddressTypeOther':
      return 'OTHER';
    default:
      throw new Error(`Unknown DAML address type: ${damlType}`);
  }
}

// ===== Stock Class Type Conversions =====

export function stockClassTypeToDaml(stockClassType: StockClassType): any {
  switch (stockClassType) {
    case 'PREFERRED':
      return 'OcfStockClassTypePreferred';
    case 'COMMON':
      return 'OcfStockClassTypeCommon';
    default:
      throw new Error(`Unknown stock class type: ${stockClassType}`);
  }
}

export function damlStockClassTypeToNative(damlType: any): StockClassType {
  switch (damlType) {
    case 'OcfStockClassTypePreferred':
      return 'PREFERRED';
    case 'OcfStockClassTypeCommon':
      return 'COMMON';
    default:
      throw new Error(`Unknown DAML stock class type: ${damlType}`);
  }
}

// ===== Monetary Value Conversions =====

export function monetaryToDaml(monetary: Monetary): Fairmint.OpenCapTable.Types.OcfMonetary {
  return {
    amount: typeof monetary.amount === 'number' ? monetary.amount.toString() : monetary.amount,
    currency: monetary.currency
  };
}

export function damlMonetaryToNative(damlMonetary: Fairmint.OpenCapTable.Types.OcfMonetary): Monetary {
  return {
    amount: damlMonetary.amount,
    currency: damlMonetary.currency
  };
}

// ===== Phone Type Conversions (Internal Helpers) =====

function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
  switch (phoneType) {
    case 'HOME': return 'OcfPhoneHome';
    case 'MOBILE': return 'OcfPhoneMobile';
    case 'BUSINESS': return 'OcfPhoneBusiness';
    case 'OTHER': return 'OcfPhoneOther';
    default: throw new Error(`Unknown phone type: ${phoneType}`);
  }
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

export function phoneToDaml(phone: Phone): Fairmint.OpenCapTable.Types.OcfPhone {
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number
  };
}

export function damlPhoneToNative(phone: Fairmint.OpenCapTable.Types.OcfPhone): Phone {
  return {
    phone_type: damlPhoneTypeToNative(phone.phone_type),
    phone_number: phone.phone_number
  };
}

// ===== Complex Object Conversions =====

export function emailToDaml(email: Email): Fairmint.OpenCapTable.Types.OcfEmail {
  return {
    email_type: emailTypeToDaml(email.email_type),
    email_address: email.email_address
  };
}

export function damlEmailToNative(damlEmail: Fairmint.OpenCapTable.Types.OcfEmail): Email {
  return {
    email_type: damlEmailTypeToNative(damlEmail.email_type),
    email_address: damlEmail.email_address
  };
}

export function addressToDaml(address: Address): Fairmint.OpenCapTable.Types.OcfAddress {
  return {
    address_type: addressTypeToDaml(address.address_type),
    street_suite: address.street_suite || null,
    city: address.city || null,
    country_subdivision: address.country_subdivision || null,
    country: address.country,
    postal_code: address.postal_code || null
  };
}

export function damlAddressToNative(damlAddress: Fairmint.OpenCapTable.Types.OcfAddress): Address {
  return {
    address_type: damlAddressTypeToNative(damlAddress.address_type),
    country: damlAddress.country,
    ...(damlAddress.street_suite && { street_suite: damlAddress.street_suite }),
    ...(damlAddress.city && { city: damlAddress.city }),
    ...(damlAddress.country_subdivision && { country_subdivision: damlAddress.country_subdivision }),
    ...(damlAddress.postal_code && { postal_code: damlAddress.postal_code })
  };
}

// ===== Stakeholder Type Conversions =====

export function stakeholderTypeToDaml(stakeholderType: StakeholderType): Fairmint.OpenCapTable.Stakeholder.OcfStakeholderType {
  switch (stakeholderType) {
    case 'INDIVIDUAL':
      return 'OcfStakeholderTypeIndividual';
    case 'INSTITUTION':
      return 'OcfStakeholderTypeInstitution';
    default:
      throw new Error(`Unknown stakeholder type: ${stakeholderType}`);
  }
}

export function damlStakeholderTypeToNative(damlType: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderType): StakeholderType {
  switch (damlType) {
    case 'OcfStakeholderTypeIndividual':
      return 'INDIVIDUAL';
    case 'OcfStakeholderTypeInstitution':
      return 'INSTITUTION';
    default:
      throw new Error(`Unknown DAML stakeholder type: ${damlType}`);
  }
}

// ===== Contact Info Conversions =====

export function contactInfoToDaml(info: ContactInfo): Fairmint.OpenCapTable.Stakeholder.OcfContactInfo {
  function nameToDaml(n: Name): Fairmint.OpenCapTable.Stakeholder.OcfName {
    return {
      legal_name: n.legal_name,
      first_name: n.first_name || null,
      last_name: n.last_name || null
    };
  }
  
  return {
    name: nameToDaml(info.name),
    phone_numbers: (info.phone_numbers || []).map(phoneToDaml),
    emails: (info.emails || []).map(emailToDaml)
  };
}

export function damlContactInfoToNative(damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfo): ContactInfo {
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

export function contactInfoWithoutNameToDaml(info: ContactInfoWithoutName): Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName | null {
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

export function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  const phones: Phone[] = (damlInfo.phone_numbers || []).map(damlPhoneToNative);
  const emails: Email[] = (damlInfo.emails || []).map(damlEmailToNative);
  return {
    phone_numbers: phones,
    emails
  } as ContactInfoWithoutName;
}

