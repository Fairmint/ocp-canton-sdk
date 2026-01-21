/**
 * DAML to OCF converters for remaining event types.
 *
 * These converters transform DAML ledger data back to native OCF format
 * for reading entities from the ledger.
 */

import type { StakeholderRelationshipType, StakeholderStatus } from '../../../types/native';

/**
 * Convert a DAML stakeholder status string to native OCF format.
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

/**
 * Convert a DAML stakeholder relationship type string to native OCF format.
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
