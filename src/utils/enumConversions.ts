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

import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../errors';
import type {
  EmailType,
  PhoneType,
  StakeholderRelationshipType,
  StakeholderStatus,
  StakeholderType,
  StockClassType,
} from '../types/native';

// ===== Email Type Conversions =====

/**
 * Convert native OCF EmailType to DAML OcfEmailType.
 *
 * @param emailType - Native email type ('PERSONAL' | 'BUSINESS' | 'OTHER')
 * @returns DAML email type enum value
 * @throws Error if emailType is not a valid value
 */
export function emailTypeToDaml(emailType: EmailType): Fairmint.OpenCapTable.Types.OcfEmailType {
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
export function damlEmailTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfEmailType): EmailType {
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
export function phoneTypeToDaml(phoneType: PhoneType): Fairmint.OpenCapTable.Types.OcfPhoneType {
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
export function damlPhoneTypeToNative(damlType: Fairmint.OpenCapTable.Types.OcfPhoneType): PhoneType {
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
export function stakeholderTypeToDaml(
  stakeholderType: StakeholderType
): Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderType {
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
export function damlStakeholderTypeToNative(
  damlType: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderType
): StakeholderType {
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
export type DamlStakeholderRelationshipType = Fairmint.OpenCapTable.Types.OcfStakeholderRelationshipType;

/**
 * Convert a native OCF stakeholder relationship string to DAML enum.
 * Uses exact string matching (case-insensitive) with fallback to OTHER for unknown values.
 *
 * @param relationship - Native relationship string (e.g., 'EMPLOYEE', 'BOARD_MEMBER')
 * @returns DAML stakeholder relationship type enum value
 */
export function stakeholderRelationshipToDaml(relationship: string): DamlStakeholderRelationshipType {
  const normalized = relationship.toUpperCase();
  switch (normalized) {
    case 'EMPLOYEE':
      return 'OcfRelEmployee';
    case 'ADVISOR':
      return 'OcfRelAdvisor';
    case 'INVESTOR':
      return 'OcfRelInvestor';
    case 'FOUNDER':
      return 'OcfRelFounder';
    case 'BOARD_MEMBER':
      return 'OcfRelBoardMember';
    case 'OFFICER':
      return 'OcfRelOfficer';
    case 'OTHER':
    default:
      // Unknown relationship types default to OTHER for forward compatibility
      return 'OcfRelOther';
  }
}

/**
 * Alias for stakeholderRelationshipToDaml for compatibility with typed inputs.
 */
export function stakeholderRelationshipTypeToDaml(
  relationship: StakeholderRelationshipType
): DamlStakeholderRelationshipType {
  return stakeholderRelationshipToDaml(relationship);
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
    case 'OcfRelExEmployee':
    case 'OcfRelNonUsEmployee':
      return 'EMPLOYEE';
    case 'OcfRelAdvisor':
    case 'OcfRelExAdvisor':
      return 'ADVISOR';
    case 'OcfRelInvestor':
      return 'INVESTOR';
    case 'OcfRelFounder':
      return 'FOUNDER';
    case 'OcfRelBoardMember':
      return 'BOARD_MEMBER';
    case 'OcfRelOfficer':
    case 'OcfRelExecutive':
      return 'OFFICER';
    case 'OcfRelConsultant':
    case 'OcfRelExConsultant':
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
export type DamlStakeholderStatus = Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType;

/**
 * Convert a native OCF stakeholder status to DAML enum.
 *
 * @param status - Native stakeholder status
 * @returns DAML stakeholder status enum value
 * @throws Error if status is not a valid value
 */
export function stakeholderStatusToDaml(status: StakeholderStatus): DamlStakeholderStatus {
  switch (status) {
    case 'ACTIVE':
      return 'OcfStakeholderStatusActive';
    case 'LEAVE_OF_ABSENCE':
      return 'OcfStakeholderStatusLeaveOfAbsence';
    case 'TERMINATION_VOLUNTARY_OTHER':
      return 'OcfStakeholderStatusTerminationVoluntaryOther';
    case 'TERMINATION_VOLUNTARY_GOOD_CAUSE':
      return 'OcfStakeholderStatusTerminationVoluntaryGoodCause';
    case 'TERMINATION_VOLUNTARY_RETIREMENT':
      return 'OcfStakeholderStatusTerminationVoluntaryRetirement';
    case 'TERMINATION_INVOLUNTARY_OTHER':
      return 'OcfStakeholderStatusTerminationInvoluntaryOther';
    case 'TERMINATION_INVOLUNTARY_DEATH':
      return 'OcfStakeholderStatusTerminationInvoluntaryDeath';
    case 'TERMINATION_INVOLUNTARY_DISABILITY':
      return 'OcfStakeholderStatusTerminationInvoluntaryDisability';
    case 'TERMINATION_INVOLUNTARY_WITH_CAUSE':
      return 'OcfStakeholderStatusTerminationInvoluntaryWithCause';
    default: {
      const exhaustiveCheck: never = status;
      throw new OcpParseError(`Unknown stakeholder status: ${exhaustiveCheck as string}`, {
        source: 'stakeholderStatus',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

/**
 * Convert a DAML stakeholder status to native OCF string.
 *
 * @param damlStatus - DAML stakeholder status enum value
 * @returns Native status string or undefined for unknown status
 */
export function damlStakeholderStatusToNative(damlStatus: string): StakeholderStatus | undefined {
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
    default:
      return undefined;
  }
}
