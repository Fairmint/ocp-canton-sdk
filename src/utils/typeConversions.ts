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
  ValuationType
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
import type {
  OcfStockPlanData,
  StockPlanCancellationBehavior,
  OcfEquityCompensationIssuanceData,
  CompensationType,
  TerminationWindow,
  Vesting
} from '../types/native';
import type { OcfConvertibleIssuanceDataNative, OcfWarrantIssuanceDataNative, ConvertibleType, SimpleTrigger } from '../types/native';
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

export function stakeholderTypeToDaml(stakeholderType: StakeholderType): Fairmint.OpenCapTable.Types.OcfStakeholderType {
  switch (stakeholderType) {
    case 'INDIVIDUAL':
      return 'OcfStakeholderTypeIndividual';
    case 'INSTITUTION':
      return 'OcfStakeholderTypeInstitution';
    default:
      throw new Error(`Unknown stakeholder type: ${stakeholderType}`);
  }
}

export function damlStakeholderTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfStakeholderType): StakeholderType {
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

export function contactInfoToDaml(info: ContactInfo): Fairmint.OpenCapTable.Types.OcfContactInfo {
  return {
    name: info.name,
    email: info.email ? emailToDaml(info.email) : null,
    phone: info.phone ? phoneToDaml(info.phone) : null,
    address: info.address ? addressToDaml(info.address) : null
  };
}

export function damlContactInfoToNative(damlInfo: Fairmint.OpenCapTable.Types.OcfContactInfo): ContactInfo {
  return {
    name: damlInfo.name,
    ...(damlInfo.email && { email: damlEmailToNative(damlInfo.email) }),
    ...(damlInfo.phone && { phone: damlPhoneToNative(damlInfo.phone) }),
    ...(damlInfo.address && { address: damlAddressToNative(damlInfo.address) })
  };
}

export function contactInfoWithoutNameToDaml(info: ContactInfoWithoutName): Fairmint.OpenCapTable.Types.OcfContactInfoWithoutName {
  return {
    email: info.email ? emailToDaml(info.email) : null,
    phone: info.phone ? phoneToDaml(info.phone) : null,
    address: info.address ? addressToDaml(info.address) : null
  };
}

export function damlContactInfoWithoutNameToNative(
  damlInfo: Fairmint.OpenCapTable.Types.OcfContactInfoWithoutName
): ContactInfoWithoutName {
  return {
    ...(damlInfo.email && { email: damlEmailToNative(damlInfo.email) }),
    ...(damlInfo.phone && { phone: damlPhoneToNative(damlInfo.phone) }),
    ...(damlInfo.address && { address: damlAddressToNative(damlInfo.address) })
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
    country_subdivision_name_of_formation: issuerData.country_subdivision_name_of_formation || null,
    tax_ids: issuerData.tax_ids || null,
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
    comments: issuerData.comments || null
  };
}

export function damlIssuerDataToNative(damlData: Fairmint.OpenCapTable.Types.OcfIssuerData): OcfIssuerData {
  return {
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
  return {
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
      const mechanism: Fairmint.OpenCapTable.Types.OcfConversionMechanism =
        right.conversion_mechanism === 'RATIO_CONVERSION'
          ? 'OcfConversionMechanismRatioConversion'
          : right.conversion_mechanism === 'PERCENT_CONVERSION'
          ? 'OcfConversionMechanismPercentCapitalizationConversion'
          : 'OcfConversionMechanismFixedAmountConversion';

      // Trigger mapping - collapse to Automatic/Optional as per DAML type
      const trigger: Fairmint.OpenCapTable.Types.OcfConversionTrigger =
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
    comments: stockClassData.comments || null
  };
}

export function damlStockClassDataToNative(damlData: Fairmint.OpenCapTable.Types.OcfStockClassData): OcfStockClassData {
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

export function stakeholderDataToDaml(data: OcfStakeholderData): Fairmint.OpenCapTable.Types.OcfStakeholderData {
  const payload: any = {
    name: data.name,
    stakeholder_type: stakeholderTypeToDaml(data.stakeholder_type),
    issuer_assigned_id: data.issuer_assigned_id || null,
    primary_contact: data.primary_contact ? contactInfoToDaml(data.primary_contact) : null,
    contact_info: data.contact_info ? contactInfoWithoutNameToDaml(data.contact_info) : null,
    addresses: (data.addresses || []).map(addressToDaml),
    tax_ids: (data.tax_ids || []),
    comments: data.comments || null
  };
  if (data.current_relationships && data.current_relationships.length) {
    payload.current_relationships = data.current_relationships as any;
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
  return payload as Fairmint.OpenCapTable.Types.OcfStakeholderData;
}

export function damlStakeholderDataToNative(
  damlData: Fairmint.OpenCapTable.Types.OcfStakeholderData
): OcfStakeholderData {
  const dAny: any = damlData as any;
  const native: OcfStakeholderData = {
    name: damlData.name || '',
    stakeholder_type: damlStakeholderTypeToNative(damlData.stakeholder_type),
    ...(damlData.issuer_assigned_id && { issuer_assigned_id: damlData.issuer_assigned_id }),
    ...(dAny.current_relationships && { current_relationships: dAny.current_relationships as string[] }),
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
  };
  return native;
}

// ===== Stock Legend Template Conversions =====

export function stockLegendTemplateDataToDaml(data: OcfStockLegendTemplateData): Fairmint.OpenCapTable.Types.OcfStockLegendTemplateData {
  return {
    name: data.name,
    text: data.text,
    comments: data.comments || null
  };
}

export function damlStockLegendTemplateDataToNative(
  damlData: Fairmint.OpenCapTable.Types.OcfStockLegendTemplateData
): OcfStockLegendTemplateData {
  return {
    name: damlData.name || '',
    text: damlData.text || '',
    ...(damlData.comments && { comments: damlData.comments })
  };
}

// ===== Valuation Conversions =====

function valuationTypeToDaml(t: ValuationType): Fairmint.OpenCapTable.Types.OcfValuationType {
  switch (t) {
    case '409A':
      return 'OcfValuationType409A';
    default:
      throw new Error(`Unknown valuation type: ${t}`);
  }
}

function damlValuationTypeToNative(t: Fairmint.OpenCapTable.Types.OcfValuationType): ValuationType {
  switch (t) {
    case 'OcfValuationType409A':
      return '409A';
    default:
      throw new Error(`Unknown DAML valuation type: ${t}`);
  }
}

export function valuationDataToDaml(data: OcfValuationData): Fairmint.OpenCapTable.Types.OcfValuationData {
  return {
    provider: data.provider || null,
    board_approval_date: data.board_approval_date ? dateStringToDAMLTime(data.board_approval_date) : null,
    stockholder_approval_date: data.stockholder_approval_date ? dateStringToDAMLTime(data.stockholder_approval_date) : null,
    comments: data.comments || null,
    price_per_share: monetaryToDaml(data.price_per_share),
    effective_date: dateStringToDAMLTime(data.effective_date),
    valuation_type: valuationTypeToDaml(data.valuation_type)
  };
}

export function damlValuationDataToNative(d: Fairmint.OpenCapTable.Types.OcfValuationData): OcfValuationData {
  return {
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

function allocationTypeToDaml(t: AllocationType): Fairmint.OpenCapTable.Types.OcfAllocationType {
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

function damlAllocationTypeToNative(t: Fairmint.OpenCapTable.Types.OcfAllocationType): AllocationType {
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

function vestingPeriodToDaml(p: VestingPeriod): Fairmint.OpenCapTable.Types.OcfVestingPeriod {
  switch (p.type) {
    case 'DAYS': return { tag: 'OcfVestingPeriodDays', value: p.value } as any;
    case 'MONTHS': return { tag: 'OcfVestingPeriodMonths', value: p.value } as any;
    default: throw new Error('Unknown vesting period');
  }
}

function damlVestingPeriodToNative(p: any): VestingPeriod {
  if (p.tag === 'OcfVestingPeriodDays') return { type: 'DAYS', value: p.value };
  if (p.tag === 'OcfVestingPeriodMonths') return { type: 'MONTHS', value: p.value };
  throw new Error('Unknown DAML vesting period');
}

function vestingTriggerToDaml(t: VestingTrigger): Fairmint.OpenCapTable.Types.OcfVestingTrigger {
  switch (t.kind) {
    case 'START':
      return { tag: 'OcfVestingStartTrigger' } as any;
    case 'SCHEDULE_ABSOLUTE':
      return { tag: 'OcfVestingScheduleAbsoluteTrigger', value: dateStringToDAMLTime(t.at) } as any;
    case 'SCHEDULE_RELATIVE':
      return {
        tag: 'OcfVestingScheduleRelativeTrigger',
        value: {
          period: vestingPeriodToDaml(t.period) as any,
          relative_to_condition_id: t.relative_to_condition_id
        }
      } as any;
    case 'EVENT':
      return { tag: 'OcfVestingEventTrigger' } as any;
  }
}

function damlVestingTriggerToNative(t: any): VestingTrigger {
  if (t === 'OcfVestingStartTrigger') return { kind: 'START' };
  if (t.tag === 'OcfVestingScheduleAbsoluteTrigger') return { kind: 'SCHEDULE_ABSOLUTE', at: damlTimeToDateString(t.value) };
  if (t.tag === 'OcfVestingScheduleRelativeTrigger') return {
    kind: 'SCHEDULE_RELATIVE',
    period: damlVestingPeriodToNative(t.value.period),
    relative_to_condition_id: t.value.relative_to_condition_id
  };
  if (t === 'OcfVestingEventTrigger') return { kind: 'EVENT' };
  throw new Error('Unknown DAML vesting trigger');
}

function vestingConditionPortionToDaml(p: VestingConditionPortion): Fairmint.OpenCapTable.Types.OcfVestingConditionPortion {
  return {
    numerator: typeof p.numerator === 'number' ? p.numerator.toString() : p.numerator,
    denominator: typeof p.denominator === 'number' ? p.denominator.toString() : p.denominator,
    remainder: p.remainder
  } as any;
}

function damlVestingConditionPortionToNative(p: Fairmint.OpenCapTable.Types.OcfVestingConditionPortion): VestingConditionPortion {
  return {
    numerator: p.numerator,
    denominator: p.denominator,
    remainder: p.remainder
  };
}

function vestingConditionToDaml(c: VestingCondition): Fairmint.OpenCapTable.Types.OcfVestingCondition {
  return {
    id_: c.id,
    description: c.description || null,
    portion: c.portion ? { tag: 'Some', value: vestingConditionPortionToDaml(c.portion) } as any : null,
    quantity: c.quantity !== undefined ? (typeof c.quantity === 'number' ? c.quantity.toString() : c.quantity) : null,
    trigger: vestingTriggerToDaml(c.trigger) as any,
    next_condition_ids: c.next_condition_ids
  } as any;
}

function damlVestingConditionToNative(c: Fairmint.OpenCapTable.Types.OcfVestingCondition): VestingCondition {
  return {
    id: c.id_ || '',
    ...(c.description && { description: c.description }),
    ...(c.portion && { portion: damlVestingConditionPortionToNative(c.portion as any) }),
    ...(c.quantity && { quantity: c.quantity }),
    trigger: damlVestingTriggerToNative(c.trigger as any),
    next_condition_ids: c.next_condition_ids || []
  };
}

export function vestingTermsDataToDaml(d: OcfVestingTermsData): Fairmint.OpenCapTable.Types.OcfVestingTermsData {
  return {
    name: d.name,
    description: d.description,
    allocation_type: allocationTypeToDaml(d.allocation_type),
    vesting_conditions: d.vesting_conditions.map(vestingConditionToDaml) as any,
    comments: d.comments || null
  } as any;
}

export function damlVestingTermsDataToNative(d: Fairmint.OpenCapTable.Types.OcfVestingTermsData): OcfVestingTermsData {
  return {
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

export function stockPlanDataToDaml(d: OcfStockPlanData): Fairmint.OpenCapTable.Types.OcfStockPlanData {
  return {
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved: typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior) as any,
    comments: d.comments || null
  } as any;
}

export function damlStockPlanDataToNative(d: Fairmint.OpenCapTable.Types.OcfStockPlanData): OcfStockPlanData {
  return {
    plan_name: d.plan_name || '',
    ...(d.board_approval_date && { board_approval_date: damlTimeToDateString(d.board_approval_date) }),
    ...(d.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(d.stockholder_approval_date) }),
    initial_shares_reserved: d.initial_shares_reserved || '0',
    ...(d.default_cancellation_behavior && { default_cancellation_behavior: damlCancellationBehaviorToNative(d.default_cancellation_behavior) }),
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
    comments: d.comments || null
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

// ===== Convertible & Warrant Conversions =====

function convertibleTypeToDaml(t: ConvertibleType): Fairmint.OpenCapTable.Types.OcfConvertibleType {
  switch (t) {
    case 'NOTE': return 'OcfConvertibleNote';
    case 'SAFE': return 'OcfConvertibleSafe';
    case 'SECURITY': return 'OcfConvertibleSecurity';
    default: throw new Error('Unknown convertible type');
  }
}

function damlConvertibleTypeToNative(t: Fairmint.OpenCapTable.Types.OcfConvertibleType): ConvertibleType {
  switch (t) {
    case 'OcfConvertibleNote': return 'NOTE';
    case 'OcfConvertibleSafe': return 'SAFE';
    case 'OcfConvertibleSecurity': return 'SECURITY';
    default: throw new Error('Unknown DAML convertible type');
  }
}

function simpleTriggerToDaml(t: SimpleTrigger): Fairmint.OpenCapTable.Types.OcfConversionTrigger {
  return (t === 'AUTOMATIC'
    ? ({ tag: 'OcfConversionTriggerAutomatic' } as any)
    : ({ tag: 'OcfConversionTriggerOptional' } as any)) as any;
}

function damlSimpleTriggerToNative(t: Fairmint.OpenCapTable.Types.OcfConversionTrigger): SimpleTrigger {
  const tag = (t as any)?.tag || (t as unknown as string);
  return tag === 'OcfConversionTriggerAutomatic' ? 'AUTOMATIC' : 'OPTIONAL';
}

export function convertibleIssuanceToDaml(d: OcfConvertibleIssuanceDataNative): Fairmint.OpenCapTable.Types.OcfConvertibleIssuanceData {
  return {
    investment_amount: monetaryToDaml(d.investment_amount),
    convertible_type: convertibleTypeToDaml(d.convertible_type),
    conversion_triggers: d.conversion_triggers.map(t => (t === 'AUTOMATIC' ? ({ tag: 'OcfConversionTriggerAutomatic' } as any) : ({ tag: 'OcfConversionTriggerOptional' } as any))),
    seniority: d.seniority as any,
    pro_rata: d.pro_rata !== undefined ? (typeof d.pro_rata === 'number' ? d.pro_rata.toString() : d.pro_rata) : null,
    comments: d.comments || null
  } as any;
}

export function damlConvertibleIssuanceToNative(d: Fairmint.OpenCapTable.Types.OcfConvertibleIssuanceData): OcfConvertibleIssuanceDataNative {
  return {
    investment_amount: damlMonetaryToNative(d.investment_amount),
    convertible_type: damlConvertibleTypeToNative(d.convertible_type),
    conversion_triggers: d.conversion_triggers.map((t: any) => (t?.tag === 'OcfConversionTriggerAutomatic' ? 'AUTOMATIC' : 'OPTIONAL')),
    seniority: d.seniority as any,
    ...(d.pro_rata && { pro_rata: d.pro_rata }),
    ...(d.comments && { comments: d.comments })
  };
}

export function warrantIssuanceToDaml(d: OcfWarrantIssuanceDataNative): Fairmint.OpenCapTable.Types.OcfWarrantIssuanceData {
  return {
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    exercise_price: monetaryToDaml(d.exercise_price),
    purchase_price: monetaryToDaml(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map(t => (t === 'AUTOMATIC' ? ({ tag: 'OcfConversionTriggerAutomatic' } as any) : ({ tag: 'OcfConversionTriggerOptional' } as any))),
    warrant_expiration_date: d.warrant_expiration_date ? dateStringToDAMLTime(d.warrant_expiration_date) : null,
    vesting_terms_id: d.vesting_terms_id || null,
    comments: d.comments || null
  } as any;
}

export function damlWarrantIssuanceToNative(d: Fairmint.OpenCapTable.Types.OcfWarrantIssuanceData): OcfWarrantIssuanceDataNative {
  return {
    quantity: d.quantity,
    exercise_price: damlMonetaryToNative(d.exercise_price),
    purchase_price: damlMonetaryToNative(d.purchase_price),
    exercise_triggers: d.exercise_triggers.map((t: any) => (t?.tag === 'OcfConversionTriggerAutomatic' ? 'AUTOMATIC' : 'OPTIONAL')),
    ...(d.warrant_expiration_date && { warrant_expiration_date: damlTimeToDateString(d.warrant_expiration_date) }),
    ...(d.vesting_terms_id && { vesting_terms_id: d.vesting_terms_id }),
    ...(d.comments && { comments: d.comments })
  };
}
