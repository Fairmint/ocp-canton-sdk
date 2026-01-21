/**
 * Bidirectional enum conversions between OCF native types and DAML types.
 *
 * These functions handle the mapping between OCF enum values (SCREAMING_SNAKE_CASE)
 * and their DAML equivalents (PascalCase prefixed strings).
 */

import type { StakeholderRelationshipType, StakeholderStatus } from '../types/native';

// =============================================================================
// Stakeholder Status Conversions
// =============================================================================

/**
 * Convert native OCF stakeholder status to DAML format.
 */
export function stakeholderStatusToDaml(status: StakeholderStatus): string {
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
      throw new Error(`Unknown stakeholder status: ${exhaustiveCheck as string}`);
    }
  }
}

/**
 * Convert DAML stakeholder status string to native OCF format.
 */
export function damlStakeholderStatusToNative(damlStatus: string): StakeholderStatus {
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
      throw new Error(`Unknown DAML stakeholder status: ${damlStatus}`);
  }
}

// =============================================================================
// Stakeholder Relationship Type Conversions
// =============================================================================

/**
 * Convert native OCF stakeholder relationship type to DAML format.
 */
export function stakeholderRelationshipTypeToDaml(relationship: StakeholderRelationshipType): string {
  switch (relationship) {
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
      return 'OcfRelOther';
    default: {
      const exhaustiveCheck: never = relationship;
      throw new Error(`Unknown stakeholder relationship type: ${exhaustiveCheck as string}`);
    }
  }
}

/**
 * Convert DAML stakeholder relationship type string to native OCF format.
 */
export function damlStakeholderRelationshipToNative(damlRel: string): StakeholderRelationshipType {
  switch (damlRel) {
    case 'OcfRelEmployee':
      return 'EMPLOYEE';
    case 'OcfRelAdvisor':
      return 'ADVISOR';
    case 'OcfRelInvestor':
      return 'INVESTOR';
    case 'OcfRelFounder':
      return 'FOUNDER';
    case 'OcfRelBoardMember':
      return 'BOARD_MEMBER';
    case 'OcfRelOfficer':
      return 'OFFICER';
    case 'OcfRelOther':
      return 'OTHER';
    default:
      throw new Error(`Unknown DAML stakeholder relationship type: ${damlRel}`);
  }
}
