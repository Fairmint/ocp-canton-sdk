/**
 * Utility functions to convert between DAML types and TypeScript-native types
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { 
  EmailType, 
  AddressType, 
  StockClassType, 
  Monetary, 
  Email,
  Address,
  TaxId,
  OcfIssuerData,
  OcfStockClassData
} from '../types/native';

// ===== Date Conversion Helpers =====

/**
 * Convert a date string (YYYY-MM-DD) to DAML Time format (ISO string with 0 timestamp)
 * DAML Time expects a string in the format YYYY-MM-DDTHH:MM:SS.000Z
 * Since we only care about the date, we use 00:00:00.000Z for the time portion
 */
export function dateStringToDAMLTime(dateString: string): string {
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

// ===== Email Type Conversions =====

export function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
  switch (emailType) {
    case 'PERSONAL':
      return 'OcfEmailTypePersonal';
    case 'BUSINESS':
      return 'OcfEmailTypeBusiness';
    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
}

export function damlEmailTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfEmailType): EmailType {
  switch (damlType) {
    case 'OcfEmailTypePersonal':
      return 'PERSONAL';
    case 'OcfEmailTypeBusiness':
      return 'BUSINESS';
    default:
      throw new Error(`Unknown DAML email type: ${damlType}`);
  }
}

// ===== Address Type Conversions =====

export function addressTypeToDaml(addressType: AddressType): Fairmint.OpenCapTable.Types.OcfAddressType {
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

export function damlAddressTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfAddressType): AddressType {
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

export function stockClassTypeToDaml(stockClassType: StockClassType): Fairmint.OpenCapTable.Types.OcfStockClassType {
  switch (stockClassType) {
    case 'PREFERRED':
      return 'OcfStockClassTypePreferred';
    case 'COMMON':
      return 'OcfStockClassTypeCommon';
    default:
      throw new Error(`Unknown stock class type: ${stockClassType}`);
  }
}

export function damlStockClassTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfStockClassType): StockClassType {
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

// ===== Main Data Structure Conversions =====

export function issuerDataToDaml(issuerData: OcfIssuerData): Fairmint.OpenCapTable.Types.OcfIssuerData {
  return {
    legal_name: issuerData.legal_name,
    country_of_formation: issuerData.country_of_formation,
    dba: issuerData.dba || null,
    formation_date: issuerData.formation_date ? dateStringToDAMLTime(issuerData.formation_date) : null,
    country_subdivision_of_formation: issuerData.country_subdivision_of_formation || null,
    tax_ids: issuerData.tax_ids || null,
    email: issuerData.email ? emailToDaml(issuerData.email) : null,
    phone: issuerData.phone || null,
    address: issuerData.address ? addressToDaml(issuerData.address) : null,
    initial_shares_authorized: issuerData.initial_shares_authorized ? 
      (typeof issuerData.initial_shares_authorized === 'number' ? 
        issuerData.initial_shares_authorized.toString() : 
        issuerData.initial_shares_authorized) : null
  };
}

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.Types.OcfIssuerData): OcfIssuerData {
  return {
    legal_name: damlData.legal_name || '',
    country_of_formation: damlData.country_of_formation || '',
    ...(damlData.dba && { dba: damlData.dba }),
    ...(damlData.formation_date && { formation_date: damlTimeToDateString(damlData.formation_date) }),
    ...(damlData.country_subdivision_of_formation && { 
      country_subdivision_of_formation: damlData.country_subdivision_of_formation 
    }),
    ...(damlData.tax_ids && { tax_ids: damlData.tax_ids }),
    ...(damlData.email && { email: damlEmailToNative(damlData.email) }),
    ...(damlData.phone && { phone: damlData.phone }),
    ...(damlData.address && { address: damlAddressToNative(damlData.address) }),
    ...(damlData.initial_shares_authorized && { 
      initial_shares_authorized: damlData.initial_shares_authorized 
    })
  };
}

export function stockClassDataToDaml(stockClassData: OcfStockClassData): Fairmint.OpenCapTable.Types.OcfStockClassData {
  // Convert initial_shares_authorized to the required tagged union format
  const initialSharesValue = typeof stockClassData.initial_shares_authorized === 'number' ?
    stockClassData.initial_shares_authorized.toString() : stockClassData.initial_shares_authorized;
  
  return {
    name: stockClassData.name,
    class_type: stockClassTypeToDaml(stockClassData.class_type),
    default_id_prefix: stockClassData.default_id_prefix,
    initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: initialSharesValue },
    votes_per_share: typeof stockClassData.votes_per_share === 'number' ?
      stockClassData.votes_per_share.toString() : stockClassData.votes_per_share,
    seniority: typeof stockClassData.seniority === 'number' ?
      stockClassData.seniority.toString() : stockClassData.seniority,
    board_approval_date: stockClassData.board_approval_date ? dateStringToDAMLTime(stockClassData.board_approval_date) : null,
    stockholder_approval_date: stockClassData.stockholder_approval_date ? dateStringToDAMLTime(stockClassData.stockholder_approval_date) : null,
    par_value: stockClassData.par_value ? monetaryToDaml(stockClassData.par_value) : null,
    price_per_share: stockClassData.price_per_share ? monetaryToDaml(stockClassData.price_per_share) : null,
    conversion_rights: stockClassData.conversion_rights ? 
      stockClassData.conversion_rights.map(right => ({
        type_: right.type,
        conversion_mechanism: right.conversion_mechanism === 'RATIO_CONVERSION' ? 'OcfConversionMechanismRatioConversion' :
                            right.conversion_mechanism === 'PERCENT_CONVERSION' ? 'OcfConversionMechanismPercentConversion' :
                            'OcfConversionMechanismFixedAmountConversion',
        conversion_trigger: right.conversion_trigger === 'AUTOMATIC_ON_CONDITION' ? 'OcfConversionTriggerAutomatic' :
                          right.conversion_trigger === 'AUTOMATIC_ON_DATE' ? 'OcfConversionTriggerAutomatic' :
                          'OcfConversionTriggerOptional',
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        conversion_rate: right.ratio.toString(),
        conversion_price: monetaryToDaml(right.conversion_price),
        expires_at: right.expires_at ? dateStringToDAMLTime(right.expires_at) : null
      })) : [],
    liquidation_preference_multiple: stockClassData.liquidation_preference_multiple ?
      (typeof stockClassData.liquidation_preference_multiple === 'number' ?
        stockClassData.liquidation_preference_multiple.toString() : stockClassData.liquidation_preference_multiple) : null,
    participation_cap_multiple: stockClassData.participation_cap_multiple ?
      (typeof stockClassData.participation_cap_multiple === 'number' ?
        stockClassData.participation_cap_multiple.toString() : stockClassData.participation_cap_multiple) : null
  };
}

export function damlStockClassDataToNative(damlData: Fairmint.OpenCapTable.Types.OcfStockClassData): OcfStockClassData {
  // Extract initial_shares_authorized from tagged union
  let initialShares = '0';
  if (damlData.initial_shares_authorized) {
    if (damlData.initial_shares_authorized.tag === 'OcfInitialSharesNumeric') {
      initialShares = damlData.initial_shares_authorized.value;
    } else if (damlData.initial_shares_authorized.tag === 'OcfInitialSharesEnum') {
      initialShares = damlData.initial_shares_authorized.value === 'OcfAuthorizedSharesUnlimited' ? 'Unlimited' : 'N/A';
    }
  }

  return {
    name: damlData.name || '',
    class_type: damlStockClassTypeToNative(damlData.class_type),
    default_id_prefix: damlData.default_id_prefix || '',
    initial_shares_authorized: initialShares,
    votes_per_share: damlData.votes_per_share || '0',
    seniority: damlData.seniority || '0',
    ...(damlData.board_approval_date && { board_approval_date: damlTimeToDateString(damlData.board_approval_date) }),
    ...(damlData.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(damlData.stockholder_approval_date) }),
    ...(damlData.par_value && { par_value: damlMonetaryToNative(damlData.par_value) }),
    ...(damlData.price_per_share && { price_per_share: damlMonetaryToNative(damlData.price_per_share) }),
    ...(damlData.conversion_rights && damlData.conversion_rights.length > 0 && { 
      conversion_rights: damlData.conversion_rights.map(right => ({
        type: right.type_,
        conversion_mechanism: right.conversion_mechanism === 'OcfConversionMechanismRatioConversion' ? 'RATIO_CONVERSION' as const :
                            right.conversion_mechanism === 'OcfConversionMechanismPercentConversion' ? 'PERCENT_CONVERSION' as const :
                            'FIXED_AMOUNT_CONVERSION' as const,
        conversion_trigger: right.conversion_trigger === 'OcfConversionTriggerAutomatic' ? 'AUTOMATIC_ON_CONDITION' as const :
                          'ELECTIVE_AT_WILL' as const,
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        ratio: parseFloat(right.conversion_rate || '1'),
        conversion_price: right.conversion_price ? damlMonetaryToNative(right.conversion_price) : { amount: '0', currency: 'USD' },
        rounding_type: 'NORMAL' as const, // Default rounding type since DAML doesn't store this yet
        ...(right.expires_at && { expires_at: damlTimeToDateString(right.expires_at) })
      }))
    }),
    ...(damlData.liquidation_preference_multiple && { 
      liquidation_preference_multiple: damlData.liquidation_preference_multiple 
    }),
    ...(damlData.participation_cap_multiple && { 
      participation_cap_multiple: damlData.participation_cap_multiple 
    })
  };
}
