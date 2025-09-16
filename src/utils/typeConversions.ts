/**
 * Utility functions to convert between DAML types and TypeScript-native types
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
  TaxId,
  OcfIssuerData,
  OcfStockClassData,
  StakeholderType,
  ContactInfo,
  ContactInfoWithoutName,
  OcfStakeholderData,
  OcfStockLegendTemplateData,
  OcfValuationData,
  ValuationType,
  Name,
  OcfDocumentData,
  OcfObjectReference
} from '../types/native';
import type {
  AllocationType,
  PeriodType,
  VestingPeriod,
  VestingTrigger,
  VestingConditionPortion,
  VestingCondition,
  OcfVestingTermsData
} from '../types/native';
import type { OcfStockIssuanceData, SecurityExemption, ShareNumberRange, VestingSimple, StockIssuanceType } from '../types/native';
import type {
  OcfStockPlanData,
  StockPlanCancellationBehavior,
  OcfEquityCompensationIssuanceData,
  CompensationType,
  TerminationWindow,
  Vesting
} from '../types/native';
import type { ConversionMechanism, ConversionTrigger, StockClassConversionRight } from '../types/native';

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
    case 'OTHER':
      return 'OcfEmailTypeOther';
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
    case 'OcfEmailTypeOther':
      return 'OTHER';
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

export function stockClassTypeToDaml(stockClassType: StockClassType): Fairmint.OpenCapTable.StockClass.OcfStockClassType {
  switch (stockClassType) {
    case 'PREFERRED':
      return 'OcfStockClassTypePreferred';
    case 'COMMON':
      return 'OcfStockClassTypeCommon';
    default:
      throw new Error(`Unknown stock class type: ${stockClassType}`);
  }
}

export function damlStockClassTypeToNative(damlType: Fairmint.OpenCapTable.StockClass.OcfStockClassType): StockClassType {
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

// ===== Phone Type Conversions =====

export function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
  switch (phoneType) {
    case 'HOME': return 'OcfPhoneHome';
    case 'MOBILE': return 'OcfPhoneMobile';
    case 'BUSINESS': return 'OcfPhoneBusiness';
    case 'OTHER': return 'OcfPhoneOther';
    default: throw new Error(`Unknown phone type: ${phoneType}`);
  }
}

export function damlPhoneTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfPhoneType): PhoneType {
  switch (damlType) {
    case 'OcfPhoneHome': return 'HOME';
    case 'OcfPhoneMobile': return 'MOBILE';
    case 'OcfPhoneBusiness': return 'BUSINESS';
    case 'OcfPhoneOther': return 'OTHER';
    default: throw new Error(`Unknown DAML phone type: ${damlType}`);
  }
}

export function phoneToDaml(phone: Phone): any {
  return {
    phone_type: phoneTypeToDaml(phone.phone_type),
    phone_number: phone.phone_number
  } as any;
}

export function damlPhoneToNative(phone: any): Phone {
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

function nameToDaml(n: Name): Fairmint.OpenCapTable.Stakeholder.OcfName {
  return {
    legal_name: n.legal_name,
    first_name: n.first_name || null,
    last_name: n.last_name || null
  } as any;
}

export function contactInfoToDaml(info: ContactInfo): Fairmint.OpenCapTable.Stakeholder.OcfContactInfo {
  return {
    name: nameToDaml(info.name),
    phone_numbers: (info.phone_numbers || []).map(phoneToDaml) as any,
    emails: (info.emails || []).map(emailToDaml)
  } as any;
}

export function damlContactInfoToNative(damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfo): ContactInfo {
  const name: Name = {
    legal_name: (damlInfo as any).name.legal_name || '',
    ...(damlInfo as any).name.first_name ? { first_name: (damlInfo as any).name.first_name } : {},
    ...(damlInfo as any).name.last_name ? { last_name: (damlInfo as any).name.last_name } : {}
  };
  const phones: Phone[] = ((damlInfo as any).phone_numbers || []).map(damlPhoneToNative);
  const emails: Email[] = ((damlInfo as any).emails || []).map(damlEmailToNative);
  return {
    name,
    ...(phones.length ? { phone_numbers: phones } : {}),
    ...(emails.length ? { emails } : {})
  } as ContactInfo;
}

export function contactInfoWithoutNameToDaml(info: ContactInfoWithoutName): Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName {
  return {
    phone_numbers: (info.phone_numbers || []).map(phoneToDaml) as any,
    emails: (info.emails || []).map(emailToDaml)
  } as any;
}

export function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.Stakeholder.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  const phones: Phone[] = ((damlInfo as any).phone_numbers || []).map(damlPhoneToNative);
  const emails: Email[] = ((damlInfo as any).emails || []).map(damlEmailToNative);
  return {
    ...(phones.length ? { phone_numbers: phones } : {}),
    ...(emails.length ? { emails } : {})
  } as ContactInfoWithoutName;
}

// ===== Main Data Structure Conversions =====

export function issuerDataToDaml(issuerData: OcfIssuerData): Fairmint.OpenCapTable.Issuer.OcfIssuerData {
  if (!issuerData.ocf_id) throw new Error('issuerData.ocf_id is required');
  return {
    ocf_id: issuerData.ocf_id,
    legal_name: issuerData.legal_name,
    country_of_formation: issuerData.country_of_formation,
    dba: issuerData.dba || null,
    formation_date: issuerData.formation_date ? dateStringToDAMLTime(issuerData.formation_date) : null,
    country_subdivision_of_formation: issuerData.country_subdivision_of_formation || null,
    country_subdivision_name_of_formation: issuerData.country_subdivision_name_of_formation || null,
    tax_ids: issuerData.tax_ids || [],
    email: issuerData.email ? emailToDaml(issuerData.email) : null,
    phone: issuerData.phone ? (phoneToDaml(issuerData.phone) as any) : null,
    address: issuerData.address ? addressToDaml(issuerData.address) : null,
    // Map to DAML union: OcfInitialSharesAuthorized = Numeric | Enum
    initial_shares_authorized:
      issuerData.initial_shares_authorized !== undefined && issuerData.initial_shares_authorized !== null
        ? ((): any => {
            const v = issuerData.initial_shares_authorized;
            if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))) {
              return { tag: 'OcfInitialSharesNumeric', value: typeof v === 'number' ? v.toString() : v };
            }
            if (v === 'UNLIMITED') {
              return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesUnlimited' };
            }
            // Treat NOT_APPLICABLE and others as NotApplicable enum
            return { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesNotApplicable' };
          })()
        : null,
    comments: issuerData.comments || []
  };
}

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.Issuer.OcfIssuerData): OcfIssuerData {
  return {
    ocf_id: damlData.ocf_id,
    legal_name: damlData.legal_name || '',
    country_of_formation: damlData.country_of_formation || '',
    ...(damlData.formation_date && { formation_date: damlTimeToDateString(damlData.formation_date) }),
    ...(damlData.dba && { dba: damlData.dba }),
    ...(damlData.country_subdivision_of_formation && { country_subdivision_of_formation: damlData.country_subdivision_of_formation }),
    // TODO: Expose country_subdivision_name_of_formation when SDK updates
    ...(damlData.tax_ids && { tax_ids: damlData.tax_ids }),
    ...(damlData.email && { email: damlEmailToNative(damlData.email) }),
    ...(damlData.phone && { phone: damlPhoneToNative(damlData.phone as any) }),
    ...(damlData.address && { address: damlAddressToNative(damlData.address) }),
    ...(damlData.initial_shares_authorized && {
      initial_shares_authorized: ((): any => {
        const isa: any = damlData.initial_shares_authorized as any;
        if (isa.tag === 'OcfInitialSharesNumeric') return isa.value;
        if (isa.tag === 'OcfInitialSharesEnum') {
          return isa.value === 'OcfAuthorizedSharesUnlimited' ? 'UNLIMITED' : 'NOT_APPLICABLE';
        }
        return undefined;
      })()
    })
  };
}

export function stockClassDataToDaml(stockClassData: OcfStockClassData): any {
  if (!stockClassData.ocf_id) throw new Error('stockClassData.ocf_id is required');
  return {
    ocf_id: stockClassData.ocf_id,
    name: stockClassData.name,
    class_type: stockClassTypeToDaml(stockClassData.class_type),
    default_id_prefix: stockClassData.default_id_prefix,
    // Support DAML Decimal (as string) payload
    initial_shares_authorized: typeof stockClassData.initial_shares_authorized === 'number'
      ? stockClassData.initial_shares_authorized.toString()
      : stockClassData.initial_shares_authorized,
    votes_per_share: typeof stockClassData.votes_per_share === 'number' ?
      stockClassData.votes_per_share.toString() : stockClassData.votes_per_share,
    seniority: typeof stockClassData.seniority === 'number' ?
      stockClassData.seniority.toString() : stockClassData.seniority,
    board_approval_date: stockClassData.board_approval_date ? dateStringToDAMLTime(stockClassData.board_approval_date) : null,
    stockholder_approval_date: stockClassData.stockholder_approval_date ? dateStringToDAMLTime(stockClassData.stockholder_approval_date) : null,
    par_value: stockClassData.par_value ? monetaryToDaml(stockClassData.par_value) : null,
    price_per_share: stockClassData.price_per_share ? monetaryToDaml(stockClassData.price_per_share) : null,
    conversion_rights: (stockClassData.conversion_rights || []).map((right) => {
      // Mechanism mapping
      const mechanism: Fairmint.OpenCapTable.StockClass.OcfConversionMechanism =
        right.conversion_mechanism === 'RATIO_CONVERSION'
          ? 'OcfConversionMechanismRatioConversion'
          : right.conversion_mechanism === 'PERCENT_CONVERSION'
          ? 'OcfConversionMechanismPercentCapitalizationConversion'
          : 'OcfConversionMechanismFixedAmountConversion';

      // Trigger mapping - collapse to Automatic/Optional as per DAML type
      const trigger: Fairmint.OpenCapTable.StockClass.OcfConversionTrigger =
        right.conversion_trigger.startsWith('AUTOMATIC')
          ? ({ tag: 'OcfConversionTriggerAutomatic' } as any)
          : ({ tag: 'OcfConversionTriggerOptional' } as any);

      // Ratio mapping if provided
      let ratio: any = null;
      const numerator = right.ratio_numerator ?? (right.ratio !== undefined ? right.ratio : undefined);
      const denominator = right.ratio_denominator ?? (right.ratio !== undefined ? 1 : undefined);
      if (numerator !== undefined && denominator !== undefined) {
        ratio = { numerator: typeof numerator === 'number' ? numerator.toString() : String(numerator), denominator: typeof denominator === 'number' ? denominator.toString() : String(denominator) } as any;
      }

      return {
        type_: right.type,
        conversion_mechanism: mechanism,
        conversion_trigger: trigger,
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        ratio: ratio ? { tag: 'Some', value: ratio } : null,
        percent_of_capitalization: right.percent_of_capitalization !== undefined ? { tag: 'Some', value: typeof right.percent_of_capitalization === 'number' ? right.percent_of_capitalization.toString() : String(right.percent_of_capitalization) } : null,
        conversion_price: right.conversion_price ? { tag: 'Some', value: monetaryToDaml(right.conversion_price) } : null,
        reference_share_price: right.reference_share_price ? { tag: 'Some', value: monetaryToDaml(right.reference_share_price) } : null,
        reference_valuation_price_per_share: right.reference_valuation_price_per_share ? { tag: 'Some', value: monetaryToDaml(right.reference_valuation_price_per_share) } : null,
        discount_rate: right.discount_rate !== undefined ? { tag: 'Some', value: typeof right.discount_rate === 'number' ? right.discount_rate.toString() : String(right.discount_rate) } : null,
        valuation_cap: right.valuation_cap ? { tag: 'Some', value: monetaryToDaml(right.valuation_cap) } : null,
        floor_price_per_share: right.floor_price_per_share ? { tag: 'Some', value: monetaryToDaml(right.floor_price_per_share) } : null,
        ceiling_price_per_share: right.ceiling_price_per_share ? { tag: 'Some', value: monetaryToDaml(right.ceiling_price_per_share) } : null,
        custom_description: right.custom_description ? { tag: 'Some', value: right.custom_description } : null,
        expires_at: right.expires_at ? dateStringToDAMLTime(right.expires_at) : null
      } as any;
    }),
    liquidation_preference_multiple: stockClassData.liquidation_preference_multiple ?
      (typeof stockClassData.liquidation_preference_multiple === 'number' ?
        stockClassData.liquidation_preference_multiple.toString() : stockClassData.liquidation_preference_multiple) : null,
    participation_cap_multiple: stockClassData.participation_cap_multiple ?
      (typeof stockClassData.participation_cap_multiple === 'number' ?
        stockClassData.participation_cap_multiple.toString() : stockClassData.participation_cap_multiple) : null,
    comments: stockClassData.comments || []
  };
}

export function damlStockClassDataToNative(damlData: Fairmint.OpenCapTable.StockClass.OcfStockClassData): OcfStockClassData {
  const dAny: any = damlData as any;
  // Handle either union-shaped or plain decimal-shaped initial_shares_authorized
  let initialShares: string = '0';
  const isa = dAny.initial_shares_authorized;
  if (typeof isa === 'string' || typeof isa === 'number') {
    initialShares = String(isa);
  } else if (isa && typeof isa === 'object' && 'tag' in isa) {
    initialShares = isa.tag === 'OcfInitialSharesNumeric' ? isa.value : (isa.value === 'OcfAuthorizedSharesUnlimited' ? 'Unlimited' : 'N/A');
  }

  return {
    ...(dAny.ocf_id ? { ocf_id: dAny.ocf_id as string } : {}),
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
      conversion_rights: damlData.conversion_rights.map((right: any) => {
        const mechanism: ConversionMechanism =
          right.conversion_mechanism === 'OcfConversionMechanismRatioConversion'
            ? 'RATIO_CONVERSION'
            : right.conversion_mechanism === 'OcfConversionMechanismPercentCapitalizationConversion'
            ? 'PERCENT_CONVERSION'
            : 'FIXED_AMOUNT_CONVERSION';
        const isAutomatic = (right.conversion_trigger as any)?.tag
          ? (right.conversion_trigger as any).tag === 'OcfConversionTriggerAutomatic'
          : right.conversion_trigger === 'OcfConversionTriggerAutomatic';
        const trigger: ConversionTrigger = isAutomatic ? 'AUTOMATIC_ON_CONDITION' : 'ELECTIVE_AT_WILL';

        let ratioValue: number | undefined;
        if (right.ratio && right.ratio.tag === 'Some') {
          const r = right.ratio.value;
          const num = parseFloat(r.numerator || '1');
          const den = parseFloat(r.denominator || '1');
          ratioValue = den !== 0 ? num / den : undefined;
        }

        return {
          type: right.type_,
          conversion_mechanism: mechanism,
          conversion_trigger: trigger,
          converts_to_stock_class_id: right.converts_to_stock_class_id,
          ...(ratioValue !== undefined ? { ratio: ratioValue } : {}),
          ...(right.conversion_price && right.conversion_price.tag === 'Some' && { conversion_price: damlMonetaryToNative(right.conversion_price.value) }),
          ...(right.reference_share_price && right.reference_share_price.tag === 'Some' && { reference_share_price: damlMonetaryToNative(right.reference_share_price.value) }),
          ...(right.reference_valuation_price_per_share && right.reference_valuation_price_per_share.tag === 'Some' && { reference_valuation_price_per_share: damlMonetaryToNative(right.reference_valuation_price_per_share.value) }),
          ...(right.percent_of_capitalization && right.percent_of_capitalization.tag === 'Some' && { percent_of_capitalization: parseFloat(right.percent_of_capitalization.value) }),
          ...(right.discount_rate && right.discount_rate.tag === 'Some' && { discount_rate: parseFloat(right.discount_rate.value) }),
          ...(right.valuation_cap && right.valuation_cap.tag === 'Some' && { valuation_cap: damlMonetaryToNative(right.valuation_cap.value) }),
          ...(right.floor_price_per_share && right.floor_price_per_share.tag === 'Some' && { floor_price_per_share: damlMonetaryToNative(right.floor_price_per_share.value) }),
          ...(right.ceiling_price_per_share && right.ceiling_price_per_share.tag === 'Some' && { ceiling_price_per_share: damlMonetaryToNative(right.ceiling_price_per_share.value) }),
          ...(right.custom_description && right.custom_description.tag === 'Some' && { custom_description: right.custom_description.value }),
          ...(right.expires_at && { expires_at: damlTimeToDateString(right.expires_at) })
        } as StockClassConversionRight;
      })
    }),
    ...(damlData.liquidation_preference_multiple && {
      liquidation_preference_multiple: damlData.liquidation_preference_multiple
    }),
    ...(damlData.participation_cap_multiple && {
      participation_cap_multiple: damlData.participation_cap_multiple
    }),
    ...(dAny.comments && { comments: dAny.comments as string[] })
  };
}

// ===== Stakeholder Data Conversions =====

export function stakeholderDataToDaml(data: OcfStakeholderData): Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData {
  if (!data.ocf_id) throw new Error('stakeholder.ocf_id is required');
  const payload: any = {
    ocf_id: data.ocf_id,
    name: nameToDaml(data.name),
    stakeholder_type: stakeholderTypeToDaml(data.stakeholder_type),
    issuer_assigned_id: data.issuer_assigned_id || null,
    primary_contact: data.primary_contact ? contactInfoToDaml(data.primary_contact) : null,
    contact_info: data.contact_info ? contactInfoWithoutNameToDaml(data.contact_info) : null,
    addresses: (data.addresses || []).map(addressToDaml),
    tax_ids: (data.tax_ids || []),
    comments: data.comments || []
  };
  if (data.current_relationships && data.current_relationships.length) {
    const mapRel = (r: string): Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType => {
      const v = r.toUpperCase();
      if (v.includes('EMPLOYEE')) return 'OcfRelEmployee' as any;
      if (v.includes('ADVISOR')) return 'OcfRelAdvisor' as any;
      if (v.includes('INVESTOR')) return 'OcfRelInvestor' as any;
      if (v.includes('FOUNDER')) return 'OcfRelFounder' as any;
      if (v.includes('BOARD')) return 'OcfRelBoardMember' as any;
      if (v.includes('OFFICER')) return 'OcfRelOfficer' as any;
      return 'OcfRelOther' as any;
    };
    payload.current_relationships = data.current_relationships.map(mapRel);
  }
  if (data.current_status) {
    payload.current_status = (
      data.current_status === 'ACTIVE' ? 'OcfStakeholderStatusActive' :
      data.current_status === 'LEAVE_OF_ABSENCE' ? 'OcfStakeholderStatusLeaveOfAbsence' :
      data.current_status === 'TERMINATION_VOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationVoluntaryOther' :
      data.current_status === 'TERMINATION_VOLUNTARY_GOOD_CAUSE' ? 'OcfStakeholderStatusTerminationVoluntaryGoodCause' :
      data.current_status === 'TERMINATION_VOLUNTARY_RETIREMENT' ? 'OcfStakeholderStatusTerminationVoluntaryRetirement' :
      data.current_status === 'TERMINATION_INVOLUNTARY_OTHER' ? 'OcfStakeholderStatusTerminationInvoluntaryOther' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DEATH' ? 'OcfStakeholderStatusTerminationInvoluntaryDeath' :
      data.current_status === 'TERMINATION_INVOLUNTARY_DISABILITY' ? 'OcfStakeholderStatusTerminationInvoluntaryDisability' :
      'OcfStakeholderStatusTerminationInvoluntaryWithCause'
    ) as any;
  }
  return payload as Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData;
}

export function damlStakeholderDataToNative(
  damlData: Fairmint.OpenCapTable.Stakeholder.OcfStakeholderData
): OcfStakeholderData {
  const dAny: any = damlData as any;
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
  const native: OcfStakeholderData = {
    ...(dAny.ocf_id ? { ocf_id: dAny.ocf_id as string } : {}),
    name,
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id && { issuer_assigned_id: damlData.issuer_assigned_id }),
    ...(dAny.current_relationships && { current_relationships: (dAny.current_relationships as string[]).map(r => mapRelBack(r) || 'OTHER') }),
    ...(dAny.current_status && { current_status: ((): any => {
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
    ...(damlData.comments && { comments: damlData.comments })
  } as OcfStakeholderData;
  return native;
}

// ===== Stock Legend Template Conversions =====

export function stockLegendTemplateDataToDaml(data: OcfStockLegendTemplateData): Fairmint.OpenCapTable.StockLegendTemplate.OcfStockLegendTemplateData {
  if (!data.ocf_id) throw new Error('stockLegendTemplate.ocf_id is required');
  return {
    ocf_id: data.ocf_id,
    name: data.name,
    text: data.text,
    comments: data.comments || []
  };
}

export function damlStockLegendTemplateDataToNative(
  damlData: Fairmint.OpenCapTable.StockLegendTemplate.OcfStockLegendTemplateData
): OcfStockLegendTemplateData {
  return {
    ocf_id: damlData.ocf_id,
    name: damlData.name || '',
    text: damlData.text || '',
    ...(damlData.comments && { comments: damlData.comments })
  };
}

// ===== Document Conversions =====

function objectTypeToDaml(t: OcfObjectReference['object_type']): Fairmint.OpenCapTable.Document.OcfObjectType {
  switch (t) {
    case 'ISSUER': return 'OcfObjIssuer';
    case 'STAKEHOLDER': return 'OcfObjStakeholder';
    case 'STOCK_CLASS': return 'OcfObjStockClass';
    case 'STOCK_LEGEND_TEMPLATE': return 'OcfObjStockLegendTemplate';
    case 'STOCK_PLAN': return 'OcfObjStockPlan';
    case 'VALUATION': return 'OcfObjValuation';
    case 'VESTING_TERMS': return 'OcfObjVestingTerms';
    case 'FINANCING': return 'OcfObjFinancing';
    case 'DOCUMENT': return 'OcfObjDocument';
    case 'CE_STAKEHOLDER_RELATIONSHIP': return 'OcfObjCeStakeholderRelationship';
    case 'CE_STAKEHOLDER_STATUS': return 'OcfObjCeStakeholderStatus';
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT': return 'OcfObjTxIssuerAuthorizedSharesAdjustment';
    case 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT': return 'OcfObjTxStockClassConversionRatioAdjustment';
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT': return 'OcfObjTxStockClassAuthorizedSharesAdjustment';
    case 'TX_STOCK_CLASS_SPLIT': return 'OcfObjTxStockClassSplit';
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT': return 'OcfObjTxStockPlanPoolAdjustment';
    case 'TX_STOCK_PLAN_RETURN_TO_POOL': return 'OcfObjTxStockPlanReturnToPool';
    case 'TX_CONVERTIBLE_ACCEPTANCE': return 'OcfObjTxConvertibleAcceptance';
    case 'TX_CONVERTIBLE_CANCELLATION': return 'OcfObjTxConvertibleCancellation';
    case 'TX_CONVERTIBLE_CONVERSION': return 'OcfObjTxConvertibleConversion';
    case 'TX_CONVERTIBLE_ISSUANCE': return 'OcfObjTxConvertibleIssuance';
    case 'TX_CONVERTIBLE_RETRACTION': return 'OcfObjTxConvertibleRetraction';
    case 'TX_CONVERTIBLE_TRANSFER': return 'OcfObjTxConvertibleTransfer';
    case 'TX_EQUITY_COMPENSATION_ACCEPTANCE': return 'OcfObjTxEquityCompensationAcceptance';
    case 'TX_EQUITY_COMPENSATION_CANCELLATION': return 'OcfObjTxEquityCompensationCancellation';
    case 'TX_EQUITY_COMPENSATION_EXERCISE': return 'OcfObjTxEquityCompensationExercise';
    case 'TX_EQUITY_COMPENSATION_ISSUANCE': return 'OcfObjTxEquityCompensationIssuance';
    case 'TX_EQUITY_COMPENSATION_RELEASE': return 'OcfObjTxEquityCompensationRelease';
    case 'TX_EQUITY_COMPENSATION_RETRACTION': return 'OcfObjTxEquityCompensationRetraction';
    case 'TX_EQUITY_COMPENSATION_TRANSFER': return 'OcfObjTxEquityCompensationTransfer';
    case 'TX_EQUITY_COMPENSATION_REPRICING': return 'OcfObjTxEquityCompensationRepricing';
    case 'TX_PLAN_SECURITY_ACCEPTANCE': return 'OcfObjTxPlanSecurityAcceptance';
    case 'TX_PLAN_SECURITY_CANCELLATION': return 'OcfObjTxPlanSecurityCancellation';
    case 'TX_PLAN_SECURITY_EXERCISE': return 'OcfObjTxPlanSecurityExercise';
    case 'TX_PLAN_SECURITY_ISSUANCE': return 'OcfObjTxPlanSecurityIssuance';
    case 'TX_PLAN_SECURITY_RELEASE': return 'OcfObjTxPlanSecurityRelease';
    case 'TX_PLAN_SECURITY_RETRACTION': return 'OcfObjTxPlanSecurityRetraction';
    case 'TX_PLAN_SECURITY_TRANSFER': return 'OcfObjTxPlanSecurityTransfer';
    case 'TX_STOCK_ACCEPTANCE': return 'OcfObjTxStockAcceptance';
    case 'TX_STOCK_CANCELLATION': return 'OcfObjTxStockCancellation';
    case 'TX_STOCK_CONVERSION': return 'OcfObjTxStockConversion';
    case 'TX_STOCK_ISSUANCE': return 'OcfObjTxStockIssuance';
    case 'TX_STOCK_REISSUANCE': return 'OcfObjTxStockReissuance';
    case 'TX_STOCK_CONSOLIDATION': return 'OcfObjTxStockConsolidation';
    case 'TX_STOCK_REPURCHASE': return 'OcfObjTxStockRepurchase';
    case 'TX_STOCK_RETRACTION': return 'OcfObjTxStockRetraction';
    case 'TX_STOCK_TRANSFER': return 'OcfObjTxStockTransfer';
    case 'TX_WARRANT_ACCEPTANCE': return 'OcfObjTxWarrantAcceptance';
    case 'TX_WARRANT_CANCELLATION': return 'OcfObjTxWarrantCancellation';
    case 'TX_WARRANT_EXERCISE': return 'OcfObjTxWarrantExercise';
    case 'TX_WARRANT_ISSUANCE': return 'OcfObjTxWarrantIssuance';
    case 'TX_WARRANT_RETRACTION': return 'OcfObjTxWarrantRetraction';
    case 'TX_WARRANT_TRANSFER': return 'OcfObjTxWarrantTransfer';
    case 'TX_VESTING_ACCELERATION': return 'OcfObjTxVestingAcceleration';
    case 'TX_VESTING_START': return 'OcfObjTxVestingStart';
    case 'TX_VESTING_EVENT': return 'OcfObjTxVestingEvent';
    default: throw new Error(`Unsupported object reference type: ${t}`);
  }
}

function objectTypeToNative(t: Fairmint.OpenCapTable.Document.OcfObjectType): OcfObjectReference['object_type'] {
  switch (t) {
    case 'OcfObjIssuer': return 'ISSUER';
    case 'OcfObjStakeholder': return 'STAKEHOLDER';
    case 'OcfObjStockClass': return 'STOCK_CLASS';
    case 'OcfObjStockLegendTemplate': return 'STOCK_LEGEND_TEMPLATE';
    case 'OcfObjStockPlan': return 'STOCK_PLAN';
    case 'OcfObjValuation': return 'VALUATION';
    case 'OcfObjVestingTerms': return 'VESTING_TERMS';
    case 'OcfObjFinancing': return 'FINANCING';
    case 'OcfObjDocument': return 'DOCUMENT';
    case 'OcfObjCeStakeholderRelationship': return 'CE_STAKEHOLDER_RELATIONSHIP';
    case 'OcfObjCeStakeholderStatus': return 'CE_STAKEHOLDER_STATUS';
    case 'OcfObjTxIssuerAuthorizedSharesAdjustment': return 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT';
    case 'OcfObjTxStockClassConversionRatioAdjustment': return 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT';
    case 'OcfObjTxStockClassAuthorizedSharesAdjustment': return 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT';
    case 'OcfObjTxStockClassSplit': return 'TX_STOCK_CLASS_SPLIT';
    case 'OcfObjTxStockPlanPoolAdjustment': return 'TX_STOCK_PLAN_POOL_ADJUSTMENT';
    case 'OcfObjTxStockPlanReturnToPool': return 'TX_STOCK_PLAN_RETURN_TO_POOL';
    case 'OcfObjTxConvertibleAcceptance': return 'TX_CONVERTIBLE_ACCEPTANCE';
    case 'OcfObjTxConvertibleCancellation': return 'TX_CONVERTIBLE_CANCELLATION';
    case 'OcfObjTxConvertibleConversion': return 'TX_CONVERTIBLE_CONVERSION';
    case 'OcfObjTxConvertibleIssuance': return 'TX_CONVERTIBLE_ISSUANCE';
    case 'OcfObjTxConvertibleRetraction': return 'TX_CONVERTIBLE_RETRACTION';
    case 'OcfObjTxConvertibleTransfer': return 'TX_CONVERTIBLE_TRANSFER';
    case 'OcfObjTxEquityCompensationAcceptance': return 'TX_EQUITY_COMPENSATION_ACCEPTANCE';
    case 'OcfObjTxEquityCompensationCancellation': return 'TX_EQUITY_COMPENSATION_CANCELLATION';
    case 'OcfObjTxEquityCompensationExercise': return 'TX_EQUITY_COMPENSATION_EXERCISE';
    case 'OcfObjTxEquityCompensationIssuance': return 'TX_EQUITY_COMPENSATION_ISSUANCE';
    case 'OcfObjTxEquityCompensationRelease': return 'TX_EQUITY_COMPENSATION_RELEASE';
    case 'OcfObjTxEquityCompensationRetraction': return 'TX_EQUITY_COMPENSATION_RETRACTION';
    case 'OcfObjTxEquityCompensationTransfer': return 'TX_EQUITY_COMPENSATION_TRANSFER';
    case 'OcfObjTxEquityCompensationRepricing': return 'TX_EQUITY_COMPENSATION_REPRICING';
    case 'OcfObjTxPlanSecurityAcceptance': return 'TX_PLAN_SECURITY_ACCEPTANCE';
    case 'OcfObjTxPlanSecurityCancellation': return 'TX_PLAN_SECURITY_CANCELLATION';
    case 'OcfObjTxPlanSecurityExercise': return 'TX_PLAN_SECURITY_EXERCISE';
    case 'OcfObjTxPlanSecurityIssuance': return 'TX_PLAN_SECURITY_ISSUANCE';
    case 'OcfObjTxPlanSecurityRelease': return 'TX_PLAN_SECURITY_RELEASE';
    case 'OcfObjTxPlanSecurityRetraction': return 'TX_PLAN_SECURITY_RETRACTION';
    case 'OcfObjTxPlanSecurityTransfer': return 'TX_PLAN_SECURITY_TRANSFER';
    case 'OcfObjTxStockAcceptance': return 'TX_STOCK_ACCEPTANCE';
    case 'OcfObjTxStockCancellation': return 'TX_STOCK_CANCELLATION';
    case 'OcfObjTxStockConversion': return 'TX_STOCK_CONVERSION';
    case 'OcfObjTxStockIssuance': return 'TX_STOCK_ISSUANCE';
    case 'OcfObjTxStockReissuance': return 'TX_STOCK_REISSUANCE';
    case 'OcfObjTxStockConsolidation': return 'TX_STOCK_CONSOLIDATION';
    case 'OcfObjTxStockRepurchase': return 'TX_STOCK_REPURCHASE';
    case 'OcfObjTxStockRetraction': return 'TX_STOCK_RETRACTION';
    case 'OcfObjTxStockTransfer': return 'TX_STOCK_TRANSFER';
    case 'OcfObjTxWarrantAcceptance': return 'TX_WARRANT_ACCEPTANCE';
    case 'OcfObjTxWarrantCancellation': return 'TX_WARRANT_CANCELLATION';
    case 'OcfObjTxWarrantExercise': return 'TX_WARRANT_EXERCISE';
    case 'OcfObjTxWarrantIssuance': return 'TX_WARRANT_ISSUANCE';
    case 'OcfObjTxWarrantRetraction': return 'TX_WARRANT_RETRACTION';
    case 'OcfObjTxWarrantTransfer': return 'TX_WARRANT_TRANSFER';
    case 'OcfObjTxVestingAcceleration': return 'TX_VESTING_ACCELERATION';
    case 'OcfObjTxVestingStart': return 'TX_VESTING_START';
    case 'OcfObjTxVestingEvent': return 'TX_VESTING_EVENT';
    default: throw new Error(`Unknown DAML object reference type: ${t}`);
  }
}

export function documentDataToDaml(d: OcfDocumentData): Fairmint.OpenCapTable.Document.OcfDocument {
  if (!d.ocf_id) throw new Error('document.ocf_id is required');
  if (!d.md5) throw new Error('document.md5 is required');
  if (!d.path && !d.uri) throw new Error('document requires path or uri');
  return {
    ocf_id: d.ocf_id,
    path: d.path ?? null,
    uri: d.uri ?? null,
    md5: d.md5,
    related_objects: (d.related_objects || []).map(r => ({
      object_type: objectTypeToDaml(r.object_type),
      object_id: r.object_id
    })),
    comments: d.comments || []
  };
}

export function damlDocumentDataToNative(d: Fairmint.OpenCapTable.Document.OcfDocument): OcfDocumentData {
  return {
    ocf_id: d.ocf_id,
    ...(d.path ? { path: d.path || undefined } : {}),
    ...(d.uri ? { uri: d.uri || undefined } : {}),
    md5: d.md5,
    related_objects: (d.related_objects || []).map(r => ({
      object_type: objectTypeToNative(r.object_type),
      object_id: r.object_id
    })),
    ...(d.comments && { comments: d.comments })
  };
}

// ===== Stock Issuance Conversions =====

function securityExemptionToDaml(e: SecurityExemption): Fairmint.OpenCapTable.Types.OcfSecurityExemption {
  return {
    description: e.description,
    jurisdiction: e.jurisdiction
  } as any;
}

function damlSecurityExemptionToNative(e: Fairmint.OpenCapTable.Types.OcfSecurityExemption): SecurityExemption {
  return { description: e.description, jurisdiction: e.jurisdiction };
}

function shareNumberRangeToDaml(r: ShareNumberRange): Fairmint.OpenCapTable.Types.OcfShareNumberRange {
  return {
    starting_share_number: typeof r.starting_share_number === 'number' ? r.starting_share_number.toString() : r.starting_share_number,
    ending_share_number: typeof r.ending_share_number === 'number' ? r.ending_share_number.toString() : r.ending_share_number
  } as any;
}

function damlShareNumberRangeToNative(r: Fairmint.OpenCapTable.Types.OcfShareNumberRange): ShareNumberRange {
  return {
    starting_share_number: r.starting_share_number,
    ending_share_number: r.ending_share_number
  };
}

function stockIssuanceTypeToDaml(t: StockIssuanceType | undefined): any {
  if (!t) return null;
  switch (t) {
    case 'RSA': return 'OcfStockIssuanceRSA';
    case 'FOUNDERS_STOCK': return 'OcfStockIssuanceFounders';
    default: throw new Error(`Unknown stock issuance type: ${t}`);
  }
}

function damlStockIssuanceTypeToNative(t: any): StockIssuanceType | undefined {
  switch (t) {
    case 'OcfStockIssuanceRSA': return 'RSA';
    case 'OcfStockIssuanceFounders': return 'FOUNDERS_STOCK';
    default: return undefined;
  }
}

export function stockIssuanceDataToDaml(d: OcfStockIssuanceData): Fairmint.OpenCapTable.StockIssuance.OcfStockIssuanceData {
  if (!d.ocf_id) throw new Error('stockIssuance.ocf_id is required');
  if (!d.security_id) throw new Error('stockIssuance.security_id is required');
  if (!d.custom_id) throw new Error('stockIssuance.custom_id is required');
  if (!d.stakeholder_id) throw new Error('stockIssuance.stakeholder_id is required');
  if (!d.stock_class_id) throw new Error('stockIssuance.stock_class_id is required');
  // Allow empty array for stock_legend_ids per OCF schema (no minItems)
  return {
    ocf_id: d.ocf_id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: d.consideration_text ?? null,
    security_law_exemptions: (d.security_law_exemptions || []).map(securityExemptionToDaml),
    stock_class_id: d.stock_class_id,
    stock_plan_id: d.stock_plan_id ?? null,
    share_numbers_issued: (d.share_numbers_issued || []).map(shareNumberRangeToDaml) as any,
    share_price: monetaryToDaml(d.share_price),
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })) as any,
    cost_basis: d.cost_basis ? monetaryToDaml(d.cost_basis) : null,
    stock_legend_ids: d.stock_legend_ids,
    issuance_type: stockIssuanceTypeToDaml(d.issuance_type) as any,
    comments: d.comments || []
  } as any;
}

export function damlStockIssuanceDataToNative(d: Fairmint.OpenCapTable.StockIssuance.OcfStockIssuanceData): OcfStockIssuanceData {
  const anyD: any = d as any;
  return {
    ocf_id: d.ocf_id,
    date: damlTimeToDateString(d.date as any),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    ...(d.board_approval_date && { board_approval_date: damlTimeToDateString(d.board_approval_date) }),
    ...(d.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date) }),
    ...(d.consideration_text && { consideration_text: d.consideration_text }),
    security_law_exemptions: (anyD.security_law_exemptions || []).map(damlSecurityExemptionToNative),
    stock_class_id: d.stock_class_id,
    ...(d.stock_plan_id && { stock_plan_id: d.stock_plan_id }),
    ...(anyD.share_numbers_issued && { share_numbers_issued: (anyD.share_numbers_issued as any[]).map(damlShareNumberRangeToNative) }),
    share_price: damlMonetaryToNative(d.share_price),
    quantity: d.quantity,
    ...(d.vesting_terms_id && { vesting_terms_id: d.vesting_terms_id }),
    ...(anyD.vestings && { vestings: (anyD.vestings as any[]).map((v: any) => ({ date: damlTimeToDateString(v.date), amount: v.amount })) }),
    ...(d.cost_basis && { cost_basis: damlMonetaryToNative(d.cost_basis) }),
    stock_legend_ids: (d as any).stock_legend_ids || [],
    ...(anyD.issuance_type && { issuance_type: damlStockIssuanceTypeToNative(anyD.issuance_type) }),
    ...(anyD.comments && { comments: anyD.comments as string[] })
  };
}
// ===== Valuation Conversions =====

function valuationTypeToDaml(t: ValuationType): Fairmint.OpenCapTable.Valuation.OcfValuationType {
  switch (t) {
    case '409A':
      return 'OcfValuationType409A';
    default:
      throw new Error(`Unknown valuation type: ${t}`);
  }
}

function damlValuationTypeToNative(t: Fairmint.OpenCapTable.Valuation.OcfValuationType): ValuationType {
  switch (t) {
    case 'OcfValuationType409A':
      return '409A';
    default:
      throw new Error(`Unknown DAML valuation type: ${t}`);
  }
}

export function valuationDataToDaml(data: OcfValuationData): Fairmint.OpenCapTable.Valuation.OcfValuationData {
  if (!data.ocf_id) throw new Error('valuation.ocf_id is required');
  if (!(data as any).stock_class_id) throw new Error('valuation.stock_class_id is required');
  return {
    ocf_id: data.ocf_id,
    stock_class_id: (data as any).stock_class_id || '',
    provider: data.provider || null,
    board_approval_date: data.board_approval_date ? dateStringToDAMLTime(data.board_approval_date) : null,
    stockholder_approval_date: data.stockholder_approval_date ? dateStringToDAMLTime(data.stockholder_approval_date) : null,
    comments: data.comments || [],
    price_per_share: monetaryToDaml(data.price_per_share),
    effective_date: dateStringToDAMLTime(data.effective_date),
    valuation_type: valuationTypeToDaml(data.valuation_type)
  };
}

export function damlValuationDataToNative(d: Fairmint.OpenCapTable.Valuation.OcfValuationData): OcfValuationData {
  return {
    ocf_id: d.ocf_id,
    stock_class_id: ((d as any).stock_class_id || '') as string,
    ...(d.provider && { provider: d.provider }),
    ...(d.board_approval_date && { board_approval_date: damlTimeToDateString(d.board_approval_date) }),
    ...(d.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date) }),
    ...(d.comments && { comments: d.comments }),
    price_per_share: damlMonetaryToNative(d.price_per_share),
    effective_date: damlTimeToDateString(d.effective_date),
    valuation_type: damlValuationTypeToNative(d.valuation_type)
  };
}

// ===== Vesting Terms Conversions =====

function allocationTypeToDaml(t: AllocationType): Fairmint.OpenCapTable.VestingTerms.OcfAllocationType {
  switch (t) {
    case 'CUMULATIVE_ROUNDING': return 'OcfAllocationCumulativeRounding';
    case 'CUMULATIVE_ROUND_DOWN': return 'OcfAllocationCumulativeRoundDown';
    case 'FRONT_LOADED': return 'OcfAllocationFrontLoaded';
    case 'BACK_LOADED': return 'OcfAllocationBackLoaded';
    case 'FRONT_LOADED_SINGLE_TRANCHE': return 'OcfAllocationFrontLoadedToSingleTranche';
    case 'BACK_LOADED_SINGLE_TRANCHE': return 'OcfAllocationBackLoadedToSingleTranche';
    case 'FRACTIONAL': return 'OcfAllocationFractional';
    default: throw new Error(`Unknown allocation type: ${t}`);
  }
}

function damlAllocationTypeToNative(t: Fairmint.OpenCapTable.VestingTerms.OcfAllocationType): AllocationType {
  switch (t) {
    case 'OcfAllocationCumulativeRounding': return 'CUMULATIVE_ROUNDING';
    case 'OcfAllocationCumulativeRoundDown': return 'CUMULATIVE_ROUND_DOWN';
    case 'OcfAllocationFrontLoaded': return 'FRONT_LOADED';
    case 'OcfAllocationBackLoaded': return 'BACK_LOADED';
    case 'OcfAllocationFrontLoadedToSingleTranche': return 'FRONT_LOADED_SINGLE_TRANCHE';
    case 'OcfAllocationBackLoadedToSingleTranche': return 'BACK_LOADED_SINGLE_TRANCHE';
    case 'OcfAllocationFractional': return 'FRACTIONAL';
    default: throw new Error(`Unknown DAML allocation type: ${t}`);
  }
}

function mapOcfDayOfMonthToDaml(day: string): any {
  const d = (day || '').toString().toUpperCase();
  const table: Record<string, any> = {
    '01': 'OcfVestingDay01', '02': 'OcfVestingDay02', '03': 'OcfVestingDay03', '04': 'OcfVestingDay04', '05': 'OcfVestingDay05',
    '06': 'OcfVestingDay06', '07': 'OcfVestingDay07', '08': 'OcfVestingDay08', '09': 'OcfVestingDay09', '10': 'OcfVestingDay10',
    '11': 'OcfVestingDay11', '12': 'OcfVestingDay12', '13': 'OcfVestingDay13', '14': 'OcfVestingDay14', '15': 'OcfVestingDay15',
    '16': 'OcfVestingDay16', '17': 'OcfVestingDay17', '18': 'OcfVestingDay18', '19': 'OcfVestingDay19', '20': 'OcfVestingDay20',
    '21': 'OcfVestingDay21', '22': 'OcfVestingDay22', '23': 'OcfVestingDay23', '24': 'OcfVestingDay24', '25': 'OcfVestingDay25',
    '26': 'OcfVestingDay26', '27': 'OcfVestingDay27', '28': 'OcfVestingDay28',
    '29_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay29OrLast',
    '30_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay30OrLast',
    '31_OR_LAST_DAY_OF_MONTH': 'OcfVestingDay31OrLast',
    'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH': 'OcfVestingStartDayOrLast'
  };
  return table[d] || 'OcfVestingStartDayOrLast';
}

function mapDamlDayOfMonthToOcf(day: any): string {
  const table: Record<string, string> = {
    OcfVestingDay01: '01', OcfVestingDay02: '02', OcfVestingDay03: '03', OcfVestingDay04: '04', OcfVestingDay05: '05',
    OcfVestingDay06: '06', OcfVestingDay07: '07', OcfVestingDay08: '08', OcfVestingDay09: '09', OcfVestingDay10: '10',
    OcfVestingDay11: '11', OcfVestingDay12: '12', OcfVestingDay13: '13', OcfVestingDay14: '14', OcfVestingDay15: '15',
    OcfVestingDay16: '16', OcfVestingDay17: '17', OcfVestingDay18: '18', OcfVestingDay19: '19', OcfVestingDay20: '20',
    OcfVestingDay21: '21', OcfVestingDay22: '22', OcfVestingDay23: '23', OcfVestingDay24: '24', OcfVestingDay25: '25',
    OcfVestingDay26: '26', OcfVestingDay27: '27', OcfVestingDay28: '28',
    OcfVestingDay29OrLast: '29_OR_LAST_DAY_OF_MONTH',
    OcfVestingDay30OrLast: '30_OR_LAST_DAY_OF_MONTH',
    OcfVestingDay31OrLast: '31_OR_LAST_DAY_OF_MONTH',
    OcfVestingStartDayOrLast: 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH'
  };
  return table[day] || 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH';
}

// Legacy helper for old native type VestingPeriod

function damlVestingPeriodToNative(p: any): { tag: 'DAYS' | 'MONTHS'; length: number; occurrences: number; day_of_month?: string; cliff_installment?: number } {
  if (p.tag === 'OcfVestingPeriodDays') {
    const v = p.value || {};
    const occRaw = v.occurrences;
    if (occRaw === undefined || occRaw === null) throw new Error('Missing vesting period occurrences');
    const occ = Number(occRaw);
    if (!Number.isFinite(occ) || occ < 1) throw new Error('Invalid vesting period occurrences');
    return {
      tag: 'DAYS',
      length: Number(v.period_length),
      occurrences: occ,
      ...(v.cliff_installment !== null && v.cliff_installment !== undefined ? { cliff_installment: Number(v.cliff_installment) } : {})
    };
  }
  if (p.tag === 'OcfVestingPeriodMonths') {
    const v = p.value || {};
    const occRaw = v.occurrences;
    if (occRaw === undefined || occRaw === null) throw new Error('Missing vesting period occurrences');
    const occ = Number(occRaw);
    if (!Number.isFinite(occ) || occ < 1) throw new Error('Invalid vesting period occurrences');
    if (v.day_of_month === undefined || v.day_of_month === null) throw new Error('Missing vesting period day_of_month for MONTHS');
    return {
      tag: 'MONTHS',
      length: Number(v.period_length),
      occurrences: occ,
      day_of_month: mapDamlDayOfMonthToOcf(v.day_of_month),
      ...(v.cliff_installment !== null && v.cliff_installment !== undefined ? { cliff_installment: Number(v.cliff_installment) } : {})
    };
  }
  throw new Error('Unknown DAML vesting period');
}

function vestingTriggerToDaml(t: any): Fairmint.OpenCapTable.VestingTerms.OcfVestingTrigger {
  const type: string | undefined = typeof t?.type === 'string' ? t.type.toUpperCase() : undefined;

  // Map schema 'type' to DAML
  if (type === 'VESTING_START_DATE') return { tag: 'OcfVestingStartTrigger' } as any;
  if (type === 'VESTING_EVENT') return { tag: 'OcfVestingEventTrigger' } as any;
  if (type === 'VESTING_SCHEDULE_ABSOLUTE') {
    const date: string | undefined = t?.date || t?.at;
    if (!date) throw new Error('Vesting absolute trigger requires date');
    return { tag: 'OcfVestingScheduleAbsoluteTrigger', value: dateStringToDAMLTime(date) } as any;
  }
  if (type === 'VESTING_SCHEDULE_RELATIVE') {
    const p = t?.period || {};
    const pType: 'DAYS' | 'MONTHS' = ((p?.type || '').toString().toUpperCase()) === 'MONTHS' ? 'MONTHS' : 'DAYS';
    const lengthVal = p?.length ?? p?.value;
    const occurrencesVal = p?.occurrences;
    const cliffVal = p?.cliff_installment;
    const lengthNum: number = Number(lengthVal);
    if (occurrencesVal === undefined || occurrencesVal === null) throw new Error('Missing vesting relative period occurrences');
    const occurrencesNum: number = Number(occurrencesVal);
    if (!Number.isFinite(lengthNum) || lengthNum <= 0) throw new Error('Invalid vesting relative period length');
    if (!Number.isFinite(occurrencesNum) || occurrencesNum < 1) throw new Error('Invalid vesting relative period occurrences');
    let period: any;
    if (pType === 'DAYS') {
      period = { tag: 'OcfVestingPeriodDays', value: { period_length: lengthNum, occurrences: occurrencesNum, cliff_installment: cliffVal === undefined ? null : Number(cliffVal) } };
    } else {
      if (p?.day_of_month === undefined || p?.day_of_month === null) throw new Error('Missing vesting relative period day_of_month for MONTHS');
      period = { tag: 'OcfVestingPeriodMonths', value: { period_length: lengthNum, occurrences: occurrencesNum, day_of_month: mapOcfDayOfMonthToDaml(p?.day_of_month), cliff_installment: cliffVal === undefined ? null : Number(cliffVal) } };
    }
    return {
      tag: 'OcfVestingScheduleRelativeTrigger',
      value: {
        period,
        relative_to_condition_id: t?.relative_to_condition_id
      }
    } as any;
  }
  
  throw new Error('Unknown vesting trigger');
}

function damlVestingTriggerToNative(t: any): any {
  // Emit schema-compliant trigger objects
  const tag: string | undefined = typeof t === 'string' ? t : t?.tag;

  if (tag === 'OcfVestingStartTrigger') {
    return { type: 'VESTING_START_DATE' };
  }

  if (tag === 'OcfVestingEventTrigger') {
    return { type: 'VESTING_EVENT' };
  }

  if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    const value = typeof t === 'string' ? undefined : t?.value;
    if (!value) throw new Error('Missing value for OcfVestingScheduleAbsoluteTrigger');
    return { type: 'VESTING_SCHEDULE_ABSOLUTE', date: damlTimeToDateString(value) };
  }

  if (tag === 'OcfVestingScheduleRelativeTrigger') {
    const value = typeof t === 'string' ? undefined : t?.value;
    if (!value) throw new Error('Missing value for OcfVestingScheduleRelativeTrigger');
    const p = damlVestingPeriodToNative(value.period);
    if (p.tag === 'MONTHS') {
      return {
        type: 'VESTING_SCHEDULE_RELATIVE',
        period: {
          type: 'MONTHS',
          length: p.length,
          occurrences: p.occurrences,
          day_of_month: p.day_of_month || 'VESTING_START_DAY_OR_LAST_DAY_OF_MONTH',
          ...(p.cliff_installment !== undefined ? { cliff_installment: p.cliff_installment } : {})
        },
        relative_to_condition_id: value.relative_to_condition_id
      };
    }
    return {
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: {
        type: 'DAYS',
        length: p.length,
        occurrences: p.occurrences,
        ...(p.cliff_installment !== undefined ? { cliff_installment: p.cliff_installment } : {})
      },
      relative_to_condition_id: value.relative_to_condition_id
    };
  }

  throw new Error('Unknown DAML vesting trigger');
}

function vestingConditionPortionToDaml(p: VestingConditionPortion): Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion {
  return {
    numerator: typeof p.numerator === 'number' ? p.numerator.toString() : p.numerator,
    denominator: typeof p.denominator === 'number' ? p.denominator.toString() : p.denominator,
    remainder: p.remainder
  } as any;
}

function damlVestingConditionPortionToNative(p: Fairmint.OpenCapTable.VestingTerms.OcfVestingConditionPortion): VestingConditionPortion {
  return {
    numerator: p.numerator,
    denominator: p.denominator,
    remainder: p.remainder
  };
}

function vestingConditionToDaml(c: VestingCondition): Fairmint.OpenCapTable.VestingTerms.OcfVestingCondition {
  return {
    id_: c.id,
    description: c.description || null,
    portion: c.portion ? { tag: 'Some', value: vestingConditionPortionToDaml(c.portion) } as any : null,
    quantity: c.quantity !== undefined ? (typeof c.quantity === 'number' ? c.quantity.toString() : c.quantity) : null,
    trigger: vestingTriggerToDaml(c.trigger) as any,
    next_condition_ids: c.next_condition_ids
  } as any;
}

function damlVestingConditionToNative(c: Fairmint.OpenCapTable.VestingTerms.OcfVestingCondition): VestingCondition {
  return {
    id: c.id_ || '',
    ...(c.description && { description: c.description }),
    ...(c.portion && { portion: damlVestingConditionPortionToNative(c.portion as any) }),
    ...(c.quantity && { quantity: c.quantity }),
    trigger: damlVestingTriggerToNative(c.trigger as any),
    next_condition_ids: c.next_condition_ids || []
  };
}

export function vestingTermsDataToDaml(d: OcfVestingTermsData): Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData {
  if (!d.ocf_id) throw new Error('vestingTerms.ocf_id is required');
  return {
    ocf_id: d.ocf_id,
    name: d.name,
    description: d.description,
    allocation_type: allocationTypeToDaml(d.allocation_type),
    vesting_conditions: d.vesting_conditions.map(vestingConditionToDaml) as any,
    comments: d.comments || []
  } as any;
}

export function damlVestingTermsDataToNative(d: Fairmint.OpenCapTable.VestingTerms.OcfVestingTermsData): OcfVestingTermsData {
  return {
    ocf_id: d.ocf_id,
    name: d.name || '',
    description: d.description || '',
    allocation_type: damlAllocationTypeToNative(d.allocation_type),
    vesting_conditions: (d.vesting_conditions || []).map(damlVestingConditionToNative),
    ...(d.comments && { comments: d.comments })
  };
}

// ===== Stock Plan Conversions =====

function cancellationBehaviorToDaml(b: StockPlanCancellationBehavior | undefined): any {
  if (!b) return null;
  switch (b) {
    case 'RETIRE': return 'OcfPlanCancelRetire';
    case 'RETURN_TO_POOL': return 'OcfPlanCancelReturnToPool';
    case 'HOLD_AS_CAPITAL_STOCK': return 'OcfPlanCancelHoldAsCapitalStock';
    case 'DEFINED_PER_PLAN_SECURITY': return 'OcfPlanCancelDefinedPerPlanSecurity';
    default: throw new Error('Unknown cancellation behavior');
  }
}

function damlCancellationBehaviorToNative(b: any): StockPlanCancellationBehavior | undefined {
  switch (b) {
    case 'OcfPlanCancelRetire': return 'RETIRE';
    case 'OcfPlanCancelReturnToPool': return 'RETURN_TO_POOL';
    case 'OcfPlanCancelHoldAsCapitalStock': return 'HOLD_AS_CAPITAL_STOCK';
    case 'OcfPlanCancelDefinedPerPlanSecurity': return 'DEFINED_PER_PLAN_SECURITY';
    default: return undefined;
  }
}

export function stockPlanDataToDaml(d: OcfStockPlanData): Fairmint.OpenCapTable.StockPlan.OcfStockPlanData {
  if (!d.ocf_id) throw new Error('stockPlan.ocf_id is required');
  return {
    ocf_id: d.ocf_id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved: typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior) as any,
    stock_class_ids: d.stock_class_ids,
    comments: d.comments || []
  } as any;
}

export function damlStockPlanDataToNative(d: Fairmint.OpenCapTable.StockPlan.OcfStockPlanData): OcfStockPlanData {
  return {
    ocf_id: d.ocf_id,
    plan_name: d.plan_name || '',
    ...(d.board_approval_date && { board_approval_date: damlTimeToDateString(d.board_approval_date) }),
    ...(d.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date) }),
    initial_shares_reserved: d.initial_shares_reserved || '0',
    ...(d.default_cancellation_behavior && { default_cancellation_behavior: damlCancellationBehaviorToNative(d.default_cancellation_behavior) }),
    stock_class_ids: (d as any).stock_class_ids || [],
    ...(d.comments && { comments: d.comments })
  };
}

// ===== Equity Compensation Issuance Conversions =====

function compensationTypeToDaml(t: CompensationType): Fairmint.OpenCapTable.Types.OcfCompensationType {
  switch (t) {
    case 'OPTION_NSO': return 'OcfCompensationTypeOptionNSO';
    case 'OPTION_ISO': return 'OcfCompensationTypeOptionISO';
    case 'OPTION': return 'OcfCompensationTypeOption';
    case 'RSU': return 'OcfCompensationTypeRSU';
    case 'CSAR': return 'OcfCompensationTypeCSAR';
    case 'SSAR': return 'OcfCompensationTypeSSAR';
    default: throw new Error('Unknown compensation type');
  }
}

function damlCompensationTypeToNative(t: Fairmint.OpenCapTable.Types.OcfCompensationType): CompensationType {
  switch (t) {
    case 'OcfCompensationTypeOptionNSO': return 'OPTION_NSO';
    case 'OcfCompensationTypeOptionISO': return 'OPTION_ISO';
    case 'OcfCompensationTypeOption': return 'OPTION';
    case 'OcfCompensationTypeRSU': return 'RSU';
    case 'OcfCompensationTypeCSAR': return 'CSAR';
    case 'OcfCompensationTypeSSAR': return 'SSAR';
    default: throw new Error('Unknown DAML compensation type');
  }
}

function terminationWindowToDaml(w: TerminationWindow): Fairmint.OpenCapTable.Types.OcfTerminationWindow {
  const reasonMap: Record<TerminationWindow['reason'], Fairmint.OpenCapTable.Types.OcfTerminationWindowType> = {
    VOLUNTARY_OTHER: 'OcfTermVoluntaryOther',
    VOLUNTARY_GOOD_CAUSE: 'OcfTermVoluntaryGoodCause',
    VOLUNTARY_RETIREMENT: 'OcfTermVoluntaryRetirement',
    INVOLUNTARY_OTHER: 'OcfTermInvoluntaryOther',
    INVOLUNTARY_DEATH: 'OcfTermInvoluntaryDeath',
    INVOLUNTARY_DISABILITY: 'OcfTermInvoluntaryDisability',
    INVOLUNTARY_WITH_CAUSE: 'OcfTermInvoluntaryWithCause'
  };
  const periodTypeMap: Record<TerminationWindow['period_type'], Fairmint.OpenCapTable.Types.OcfPeriodType> = {
    DAYS: 'OcfPeriodDays',
    MONTHS: 'OcfPeriodMonths'
  };
  return {
    reason: reasonMap[w.reason],
    period: w.period,
    period_type: periodTypeMap[w.period_type]
  } as any;
}

function damlTerminationWindowToNative(w: Fairmint.OpenCapTable.Types.OcfTerminationWindow): TerminationWindow {
  const reasonMap: Record<string, TerminationWindow['reason']> = {
    OcfTermVoluntaryOther: 'VOLUNTARY_OTHER',
    OcfTermVoluntaryGoodCause: 'VOLUNTARY_GOOD_CAUSE',
    OcfTermVoluntaryRetirement: 'VOLUNTARY_RETIREMENT',
    OcfTermInvoluntaryOther: 'INVOLUNTARY_OTHER',
    OcfTermInvoluntaryDeath: 'INVOLUNTARY_DEATH',
    OcfTermInvoluntaryDisability: 'INVOLUNTARY_DISABILITY',
    OcfTermInvoluntaryWithCause: 'INVOLUNTARY_WITH_CAUSE'
  };
  const periodTypeMap: Record<string, TerminationWindow['period_type']> = {
    OcfPeriodDays: 'DAYS',
    OcfPeriodMonths: 'MONTHS'
  };
  return {
    reason: reasonMap[w.reason as any],
    period: w.period as any,
    period_type: periodTypeMap[w.period_type as any]
  };
}

export function equityCompIssuanceDataToDaml(d: OcfEquityCompensationIssuanceData): Fairmint.OpenCapTable.Types.OcfEquityCompensationIssuanceData {
  return {
    compensation_type: compensationTypeToDaml(d.compensation_type),
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    exercise_price: d.exercise_price ? monetaryToDaml(d.exercise_price) : null,
    base_price: d.base_price ? monetaryToDaml(d.base_price) : null,
    early_exercisable: d.early_exercisable === undefined ? null : d.early_exercisable,
    vestings: d.vestings ? d.vestings.map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })) as any : null,
    expiration_date: d.expiration_date ? dateStringToDAMLTime(d.expiration_date) : null,
    termination_exercise_windows: d.termination_exercise_windows.map(terminationWindowToDaml) as any,
    comments: d.comments || []
  } as any;
}

export function damlEquityCompIssuanceDataToNative(d: Fairmint.OpenCapTable.Types.OcfEquityCompensationIssuanceData): OcfEquityCompensationIssuanceData {
  return {
    compensation_type: damlCompensationTypeToNative(d.compensation_type),
    quantity: d.quantity,
    ...(d.exercise_price && { exercise_price: damlMonetaryToNative(d.exercise_price) }),
    ...(d.base_price && { base_price: damlMonetaryToNative(d.base_price) }),
    ...(d.early_exercisable !== null && d.early_exercisable !== undefined && { early_exercisable: d.early_exercisable as any }),
    ...(d.vestings && { vestings: (d.vestings as any).map((v: any) => ({ date: damlTimeToDateString(v.date), amount: v.amount })) as Vesting[] }),
    ...(d.expiration_date && { expiration_date: damlTimeToDateString(d.expiration_date) }),
    termination_exercise_windows: (d.termination_exercise_windows as any).map(damlTerminationWindowToNative),
    ...(d.comments && { comments: d.comments })
  };
}
