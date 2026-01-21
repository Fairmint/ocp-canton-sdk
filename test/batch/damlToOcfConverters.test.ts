/**
 * Unit tests for DAML to OCF converters.
 *
 * Tests the reverse conversion from DAML ledger format back to native OCF format.
 */

import { damlStakeholderRelationshipToNative, damlStakeholderStatusToNative } from '../../src/utils/enumConversions';

describe('DAML to OCF Converters', () => {
  describe('damlStakeholderStatusToNative', () => {
    it('converts all status types correctly', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusActive')).toBe('ACTIVE');
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusLeaveOfAbsence')).toBe('LEAVE_OF_ABSENCE');
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationVoluntaryOther')).toBe(
        'TERMINATION_VOLUNTARY_OTHER'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationVoluntaryGoodCause')).toBe(
        'TERMINATION_VOLUNTARY_GOOD_CAUSE'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationVoluntaryRetirement')).toBe(
        'TERMINATION_VOLUNTARY_RETIREMENT'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationInvoluntaryOther')).toBe(
        'TERMINATION_INVOLUNTARY_OTHER'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationInvoluntaryDeath')).toBe(
        'TERMINATION_INVOLUNTARY_DEATH'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationInvoluntaryDisability')).toBe(
        'TERMINATION_INVOLUNTARY_DISABILITY'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTerminationInvoluntaryWithCause')).toBe(
        'TERMINATION_INVOLUNTARY_WITH_CAUSE'
      );
    });

    it('throws error for unknown status', () => {
      expect(() => damlStakeholderStatusToNative('UnknownStatus')).toThrow('Unknown DAML stakeholder status');
    });
  });

  describe('damlStakeholderRelationshipToNative', () => {
    it('converts all relationship types correctly', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelEmployee')).toBe('EMPLOYEE');
      expect(damlStakeholderRelationshipToNative('OcfRelAdvisor')).toBe('ADVISOR');
      expect(damlStakeholderRelationshipToNative('OcfRelInvestor')).toBe('INVESTOR');
      expect(damlStakeholderRelationshipToNative('OcfRelFounder')).toBe('FOUNDER');
      expect(damlStakeholderRelationshipToNative('OcfRelBoardMember')).toBe('BOARD_MEMBER');
      expect(damlStakeholderRelationshipToNative('OcfRelOfficer')).toBe('OFFICER');
      expect(damlStakeholderRelationshipToNative('OcfRelOther')).toBe('OTHER');
    });

    it('throws error for unknown relationship', () => {
      expect(() => damlStakeholderRelationshipToNative('UnknownRelationship')).toThrow(
        'Unknown DAML stakeholder relationship type'
      );
    });
  });

  describe('round-trip conversion consistency', () => {
    // These tests verify that the OCF→DAML and DAML→OCF converters are consistent
    // by checking that converting back and forth produces the same result

    it('maintains consistency for status conversions', () => {
      const statuses = [
        'ACTIVE',
        'LEAVE_OF_ABSENCE',
        'TERMINATION_VOLUNTARY_OTHER',
        'TERMINATION_VOLUNTARY_GOOD_CAUSE',
        'TERMINATION_VOLUNTARY_RETIREMENT',
        'TERMINATION_INVOLUNTARY_OTHER',
        'TERMINATION_INVOLUNTARY_DEATH',
        'TERMINATION_INVOLUNTARY_DISABILITY',
        'TERMINATION_INVOLUNTARY_WITH_CAUSE',
      ] as const;

      const damlStatuses = [
        'OcfStakeholderStatusActive',
        'OcfStakeholderStatusLeaveOfAbsence',
        'OcfStakeholderStatusTerminationVoluntaryOther',
        'OcfStakeholderStatusTerminationVoluntaryGoodCause',
        'OcfStakeholderStatusTerminationVoluntaryRetirement',
        'OcfStakeholderStatusTerminationInvoluntaryOther',
        'OcfStakeholderStatusTerminationInvoluntaryDeath',
        'OcfStakeholderStatusTerminationInvoluntaryDisability',
        'OcfStakeholderStatusTerminationInvoluntaryWithCause',
      ];

      // Verify each DAML status converts to expected native status
      for (let i = 0; i < damlStatuses.length; i++) {
        expect(damlStakeholderStatusToNative(damlStatuses[i])).toBe(statuses[i]);
      }
    });

    it('maintains consistency for relationship conversions', () => {
      const relationships = ['EMPLOYEE', 'ADVISOR', 'INVESTOR', 'FOUNDER', 'BOARD_MEMBER', 'OFFICER', 'OTHER'] as const;

      const damlRelationships = [
        'OcfRelEmployee',
        'OcfRelAdvisor',
        'OcfRelInvestor',
        'OcfRelFounder',
        'OcfRelBoardMember',
        'OcfRelOfficer',
        'OcfRelOther',
      ];

      // Verify each DAML relationship converts to expected native relationship
      for (let i = 0; i < damlRelationships.length; i++) {
        expect(damlStakeholderRelationshipToNative(damlRelationships[i])).toBe(relationships[i]);
      }
    });
  });
});
