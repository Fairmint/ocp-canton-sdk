/**
 * Centralized enum conversion utilities for OCF to DAML transformations.
 *
 * This module provides bidirectional converters between native OCF enum values
 * and their DAML equivalents. All enum converters follow the pattern:
 * - `*ToDaml()` - Native OCF → DAML
 * - `daml*ToNative()` - DAML → Native OCF
 *
 * @example
 *   ```typescript
 *   import { emailTypeToDaml, damlEmailTypeToNative } from '../utils/enumConversions';
 *
 *   // Native → DAML
 *   const damlEmailType = emailTypeToDaml('BUSINESS'); // 'OcfEmailTypeBusiness'
 *
 *   // DAML → Native
 *   const nativeEmailType = damlEmailTypeToNative('OcfEmailTypeBusiness'); // 'BUSINESS'
 *   ```
 */

import { OcpErrorCodes, OcpParseError } from '../errors';
import {
  STAKEHOLDER_RELATIONSHIP_TYPES,
  type EmailType,
  type PhoneType,
  type StakeholderRelationshipType,
  type StakeholderStatus,
  type StakeholderType,
  type StockClassType,
} from '../types/native';

export { STAKEHOLDER_RELATIONSHIP_TYPES } from '../types/native';

// Keep public utility declarations structural so generated DAML codecs remain
// an implementation detail of the ledger boundary.
type DamlEmailType = 'OcfEmailTypeBusiness' | 'OcfEmailTypePersonal' | 'OcfEmailTypeOther';
type DamlPhoneType = 'OcfPhoneHome' | 'OcfPhoneMobile' | 'OcfPhoneBusiness' | 'OcfPhoneOther';
type DamlStakeholderType = 'OcfStakeholderTypeIndividual' | 'OcfStakeholderTypeInstitution';

// ===== Email Type Conversions =====

/**
 * Convert native OCF EmailType to DAML OcfEmailType.
 *
 * @param emailType - Native email type ('PERSONAL' | 'BUSINESS' | 'OTHER')
 * @returns DAML email type enum value
 * @throws Error if emailType is not a valid value
 */
export function emailTypeToDaml(emailType: EmailType): DamlEmailType {
  switch (emailType) {
    case 'PERSONAL':
      return 'OcfEmailTypePersonal';
    case 'BUSINESS':
      return 'OcfEmailTypeBusiness';
    case 'OTHER':
      return 'OcfEmailTypeOther';
    default: {
      const exhaustiveCheck: never = emailType;
      throw new OcpParseError(`Unknown email type: ${exhaustiveCheck as string}`, {
        source: 'emailType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Convert DAML OcfEmailType to native OCF EmailType.
 *
 * @param damlType - DAML email type enum value
 * @returns Native email type
 * @throws Error if damlType is not a valid value
 */
export function damlEmailTypeToNative(damlType: DamlEmailType): EmailType {
  switch (damlType) {
    case 'OcfEmailTypePersonal':
      return 'PERSONAL';
    case 'OcfEmailTypeBusiness':
      return 'BUSINESS';
    case 'OcfEmailTypeOther':
      return 'OTHER';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new OcpParseError(`Unknown DAML email type: ${exhaustiveCheck as string}`, {
        source: 'damlEmailType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

// ===== Phone Type Conversions =====

/**
 * Convert native OCF PhoneType to DAML OcfPhoneType.
 *
 * @param phoneType - Native phone type ('HOME' | 'MOBILE' | 'BUSINESS' | 'OTHER')
 * @returns DAML phone type enum value
 * @throws Error if phoneType is not a valid value
 */
export function phoneTypeToDaml(phoneType: PhoneType): DamlPhoneType {
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
      throw new OcpParseError(`Unknown phone type: ${exhaustiveCheck as string}`, {
        source: 'phoneType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Convert DAML OcfPhoneType to native OCF PhoneType.
 *
 * @param damlType - DAML phone type enum value
 * @returns Native phone type
 * @throws Error if damlType is not a valid value
 */
export function damlPhoneTypeToNative(damlType: DamlPhoneType): PhoneType {
  switch (damlType) {
    case 'OcfPhoneHome':
      return 'HOME';
    case 'OcfPhoneMobile':
      return 'MOBILE';
    case 'OcfPhoneBusiness':
      return 'BUSINESS';
    case 'OcfPhoneOther':
      return 'OTHER';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new OcpParseError(`Unknown DAML phone type: ${exhaustiveCheck as string}`, {
        source: 'damlPhoneType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

// ===== Stakeholder Type Conversions =====

/**
 * Convert native OCF StakeholderType to DAML OcfStakeholderType.
 *
 * @param stakeholderType - Native stakeholder type ('INDIVIDUAL' | 'INSTITUTION')
 * @returns DAML stakeholder type enum value
 * @throws Error if stakeholderType is not a valid value
 */
export function stakeholderTypeToDaml(stakeholderType: StakeholderType): DamlStakeholderType {
  switch (stakeholderType) {
    case 'INDIVIDUAL':
      return 'OcfStakeholderTypeIndividual';
    case 'INSTITUTION':
      return 'OcfStakeholderTypeInstitution';
    default: {
      const exhaustiveCheck: never = stakeholderType;
      throw new OcpParseError(`Unknown stakeholder type: ${exhaustiveCheck as string}`, {
        source: 'stakeholderType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Convert DAML OcfStakeholderType to native OCF StakeholderType.
 *
 * @param damlType - DAML stakeholder type enum value
 * @returns Native stakeholder type
 * @throws Error if damlType is not a valid value
 */
export function damlStakeholderTypeToNative(damlType: DamlStakeholderType): StakeholderType {
  switch (damlType) {
    case 'OcfStakeholderTypeIndividual':
      return 'INDIVIDUAL';
    case 'OcfStakeholderTypeInstitution':
      return 'INSTITUTION';
    default: {
      const exhaustiveCheck: never = damlType;
      throw new OcpParseError(`Unknown DAML stakeholder type: ${exhaustiveCheck as string}`, {
        source: 'damlStakeholderType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

// ===== Stock Class Type Conversions =====

/**
 * Convert native OCF StockClassType to DAML stock class type.
 *
 * @param stockClassType - Native stock class type ('COMMON' | 'PREFERRED')
 * @returns DAML stock class type string literal
 * @throws Error if stockClassType is not a valid value
 */
export function stockClassTypeToDaml(
  stockClassType: StockClassType
): 'OcfStockClassTypePreferred' | 'OcfStockClassTypeCommon' {
  switch (stockClassType) {
    case 'PREFERRED':
      return 'OcfStockClassTypePreferred';
    case 'COMMON':
      return 'OcfStockClassTypeCommon';
    default: {
      const exhaustiveCheck: never = stockClassType;
      throw new OcpParseError(`Unknown stock class type: ${exhaustiveCheck as string}`, {
        source: 'stockClassType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Convert DAML stock class type to native OCF StockClassType.
 *
 * @param damlType - DAML stock class type string
 * @returns Native stock class type
 * @throws Error if damlType is not a valid value
 */
export function damlStockClassTypeToNative(damlType: string): StockClassType {
  switch (damlType) {
    case 'OcfStockClassTypePreferred':
      return 'PREFERRED';
    case 'OcfStockClassTypeCommon':
      return 'COMMON';
    default:
      throw new OcpParseError(`Unknown DAML stock class type: ${damlType}`, {
        source: 'damlStockClassType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

// ===== Stakeholder Relationship Type Conversions =====

/**
 * DAML stakeholder relationship type enum values.
 */
export type DamlStakeholderRelationshipType =
  | 'OcfRelAdvisor'
  | 'OcfRelBoardMember'
  | 'OcfRelConsultant'
  | 'OcfRelEmployee'
  | 'OcfRelExAdvisor'
  | 'OcfRelExConsultant'
  | 'OcfRelExEmployee'
  | 'OcfRelExecutive'
  | 'OcfRelFounder'
  | 'OcfRelInvestor'
  | 'OcfRelNonUsEmployee'
  | 'OcfRelOfficer'
  | 'OcfRelOther';

/**
 * Exhaustive canonical relationship mapping shared by validation and encoding.
 *
 * `satisfies Record<...>` makes adding a public relationship value a compile-time
 * error here until its DAML representation is defined, preventing validator and
 * converter support from drifting apart.
 */
export const STAKEHOLDER_RELATIONSHIP_TYPE_TO_DAML = {
  ADVISOR: 'OcfRelAdvisor',
  BOARD_MEMBER: 'OcfRelBoardMember',
  CONSULTANT: 'OcfRelConsultant',
  EMPLOYEE: 'OcfRelEmployee',
  EX_ADVISOR: 'OcfRelExAdvisor',
  EX_CONSULTANT: 'OcfRelExConsultant',
  EX_EMPLOYEE: 'OcfRelExEmployee',
  EXECUTIVE: 'OcfRelExecutive',
  FOUNDER: 'OcfRelFounder',
  INVESTOR: 'OcfRelInvestor',
  NON_US_EMPLOYEE: 'OcfRelNonUsEmployee',
  OFFICER: 'OcfRelOfficer',
  OTHER: 'OcfRelOther',
} as const satisfies Record<StakeholderRelationshipType, DamlStakeholderRelationshipType>;

const STAKEHOLDER_RELATIONSHIP_TYPE_SET: ReadonlySet<string> = new Set(STAKEHOLDER_RELATIONSHIP_TYPES);

/** Runtime guard backed by the same exhaustive relationship source used for DAML encoding. */
export function isStakeholderRelationshipType(value: unknown): value is StakeholderRelationshipType {
  return typeof value === 'string' && STAKEHOLDER_RELATIONSHIP_TYPE_SET.has(value);
}

/**
 * Convert a native OCF stakeholder relationship type to DAML enum.
 *
 * @param relationship - Native relationship type
 * @returns DAML stakeholder relationship type enum value
 * @throws Error if relationship is not a valid value
 */
export function stakeholderRelationshipTypeToDaml(
  relationship: StakeholderRelationshipType
): DamlStakeholderRelationshipType {
  if (isStakeholderRelationshipType(relationship)) {
    return STAKEHOLDER_RELATIONSHIP_TYPE_TO_DAML[relationship];
  }

  throw new OcpParseError(`Unknown stakeholder relationship type: ${String(relationship)}`, {
    source: 'stakeholderRelationshipType',
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

/**
 * Convert a DAML stakeholder relationship type to native OCF string.
 *
 * @param damlType - DAML stakeholder relationship type enum value
 * @returns Native relationship string
 */
export function damlStakeholderRelationshipToNative(
  damlType: DamlStakeholderRelationshipType
): StakeholderRelationshipType {
  switch (damlType) {
    case 'OcfRelEmployee':
      return 'EMPLOYEE';
    case 'OcfRelExEmployee':
      return 'EX_EMPLOYEE';
    case 'OcfRelNonUsEmployee':
      return 'NON_US_EMPLOYEE';
    case 'OcfRelAdvisor':
      return 'ADVISOR';
    case 'OcfRelExAdvisor':
      return 'EX_ADVISOR';
    case 'OcfRelInvestor':
      return 'INVESTOR';
    case 'OcfRelFounder':
      return 'FOUNDER';
    case 'OcfRelBoardMember':
      return 'BOARD_MEMBER';
    case 'OcfRelOfficer':
      return 'OFFICER';
    case 'OcfRelExecutive':
      return 'EXECUTIVE';
    case 'OcfRelConsultant':
      return 'CONSULTANT';
    case 'OcfRelExConsultant':
      return 'EX_CONSULTANT';
    case 'OcfRelOther':
      return 'OTHER';
    default: {
      // Exhaustive check - should never reach here
      const exhaustiveCheck: never = damlType;
      throw new OcpParseError(`Unknown DAML stakeholder relationship type: ${exhaustiveCheck as string}`, {
        source: 'damlStakeholderRelationshipType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

// ===== Stakeholder Status Conversions =====

/**
 * DAML stakeholder status type.
 */
export type DamlStakeholderStatus =
  | 'OcfStakeholderStatusActive'
  | 'OcfStakeholderStatusLeaveOfAbsence'
  | 'OcfStakeholderStatusTerminationVoluntaryOther'
  | 'OcfStakeholderStatusTerminationVoluntaryGoodCause'
  | 'OcfStakeholderStatusTerminationVoluntaryRetirement'
  | 'OcfStakeholderStatusTerminationInvoluntaryOther'
  | 'OcfStakeholderStatusTerminationInvoluntaryDeath'
  | 'OcfStakeholderStatusTerminationInvoluntaryDisability'
  | 'OcfStakeholderStatusTerminationInvoluntaryWithCause';

/** Exhaustive canonical status mapping shared by validation and encoding. */
export const STAKEHOLDER_STATUS_TO_DAML = {
  ACTIVE: 'OcfStakeholderStatusActive',
  LEAVE_OF_ABSENCE: 'OcfStakeholderStatusLeaveOfAbsence',
  TERMINATION_VOLUNTARY_OTHER: 'OcfStakeholderStatusTerminationVoluntaryOther',
  TERMINATION_VOLUNTARY_GOOD_CAUSE: 'OcfStakeholderStatusTerminationVoluntaryGoodCause',
  TERMINATION_VOLUNTARY_RETIREMENT: 'OcfStakeholderStatusTerminationVoluntaryRetirement',
  TERMINATION_INVOLUNTARY_OTHER: 'OcfStakeholderStatusTerminationInvoluntaryOther',
  TERMINATION_INVOLUNTARY_DEATH: 'OcfStakeholderStatusTerminationInvoluntaryDeath',
  TERMINATION_INVOLUNTARY_DISABILITY: 'OcfStakeholderStatusTerminationInvoluntaryDisability',
  TERMINATION_INVOLUNTARY_WITH_CAUSE: 'OcfStakeholderStatusTerminationInvoluntaryWithCause',
} as const satisfies Record<StakeholderStatus, DamlStakeholderStatus>;

/** All nine canonical OCF stakeholder statuses. */
export const STAKEHOLDER_STATUSES = Object.freeze(Object.keys(STAKEHOLDER_STATUS_TO_DAML) as StakeholderStatus[]);

const STAKEHOLDER_STATUS_SET: ReadonlySet<string> = new Set(STAKEHOLDER_STATUSES);

/** Runtime guard backed by the same exhaustive source used by the writer. */
export function isStakeholderStatus(value: unknown): value is StakeholderStatus {
  return typeof value === 'string' && STAKEHOLDER_STATUS_SET.has(value);
}

/**
 * Convert a native OCF stakeholder status to DAML enum.
 *
 * @param status - Native stakeholder status
 * @returns DAML stakeholder status enum value
 * @throws Error if status is not a valid value
 */
export function stakeholderStatusToDaml(status: StakeholderStatus): DamlStakeholderStatus {
  if (isStakeholderStatus(status)) {
    return STAKEHOLDER_STATUS_TO_DAML[status];
  }

  throw new OcpParseError(`Unknown stakeholder status: ${String(status)}`, {
    source: 'stakeholderStatus',
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
  });
}

/**
 * Convert a DAML stakeholder status to native OCF string.
 *
 * @param damlStatus - DAML stakeholder status enum value
 * @returns Native status string
 * @throws OcpParseError if damlStatus is not a valid value
 */
export function damlStakeholderStatusToNative(
  damlStatus: DamlStakeholderStatus,
  source = 'damlStakeholderStatus'
): StakeholderStatus {
  switch (damlStatus) {
    case 'OcfStakeholderStatusActive':
      return 'ACTIVE';
    case 'OcfStakeholderStatusLeaveOfAbsence':
      return 'LEAVE_OF_ABSENCE';
    case 'OcfStakeholderStatusTerminationVoluntaryOther':
      return 'TERMINATION_VOLUNTARY_OTHER';
    case 'OcfStakeholderStatusTerminationVoluntaryGoodCause':
      return 'TERMINATION_VOLUNTARY_GOOD_CAUSE';
    case 'OcfStakeholderStatusTerminationVoluntaryRetirement':
      return 'TERMINATION_VOLUNTARY_RETIREMENT';
    case 'OcfStakeholderStatusTerminationInvoluntaryOther':
      return 'TERMINATION_INVOLUNTARY_OTHER';
    case 'OcfStakeholderStatusTerminationInvoluntaryDeath':
      return 'TERMINATION_INVOLUNTARY_DEATH';
    case 'OcfStakeholderStatusTerminationInvoluntaryDisability':
      return 'TERMINATION_INVOLUNTARY_DISABILITY';
    case 'OcfStakeholderStatusTerminationInvoluntaryWithCause':
      return 'TERMINATION_INVOLUNTARY_WITH_CAUSE';
    default: {
      const exhaustiveCheck: never = damlStatus;
      throw new OcpParseError(`Unknown DAML stakeholder status: ${exhaustiveCheck as string}`, {
        source,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}
