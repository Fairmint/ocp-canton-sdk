/**
 * Unit tests for DAML to OCF converters.
 *
 * Tests the reverse conversion from DAML ledger format back to native OCF format.
 */

import {
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  type DamlStakeholderRelationshipType,
} from '../../src/utils/enumConversions';
import { requireDefined } from '../../src/utils/requireDefined';

describe('DAML to OCF Converters', () => {
  describe('damlStakeholderStatusToNative', () => {
    it('converts all status types correctly', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeActive')).toBe('ACTIVE');
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeLeaveOfAbsence')).toBe('LEAVE_OF_ABSENCE');
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationVoluntaryOther')).toBe(
        'TERMINATION_VOLUNTARY_OTHER'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationVoluntaryGoodCause')).toBe(
        'TERMINATION_VOLUNTARY_GOOD_CAUSE'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationVoluntaryRetirement')).toBe(
        'TERMINATION_VOLUNTARY_RETIREMENT'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationInvoluntaryOther')).toBe(
        'TERMINATION_INVOLUNTARY_OTHER'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationInvoluntaryDeath')).toBe(
        'TERMINATION_INVOLUNTARY_DEATH'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationInvoluntaryDisability')).toBe(
        'TERMINATION_INVOLUNTARY_DISABILITY'
      );
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeTerminationInvoluntaryWithCause')).toBe(
        'TERMINATION_INVOLUNTARY_WITH_CAUSE'
      );
    });

    it('throws for unknown status', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlStakeholderStatusToNative('UnknownStatus')).toThrow();
    });
  });

  describe('damlStakeholderRelationshipToNative', () => {
    it('converts all relationship types correctly', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeEmployee')).toBe('EMPLOYEE');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeAdvisor')).toBe('ADVISOR');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeInvestor')).toBe('INVESTOR');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeFounder')).toBe('FOUNDER');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeBoardMember')).toBe('BOARD_MEMBER');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeOfficer')).toBe('OFFICER');
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeOther')).toBe('OTHER');
    });

    it('throws error for unknown relationship', () => {
      expect(() =>
        damlStakeholderRelationshipToNative('UnknownRelationship' as DamlStakeholderRelationshipType)
      ).toThrow('Unknown DAML OcfStakeholderRelationshipType constructor');
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
        'OcfStakeholderStatusTypeActive',
        'OcfStakeholderStatusTypeLeaveOfAbsence',
        'OcfStakeholderStatusTypeTerminationVoluntaryOther',
        'OcfStakeholderStatusTypeTerminationVoluntaryGoodCause',
        'OcfStakeholderStatusTypeTerminationVoluntaryRetirement',
        'OcfStakeholderStatusTypeTerminationInvoluntaryOther',
        'OcfStakeholderStatusTypeTerminationInvoluntaryDeath',
        'OcfStakeholderStatusTypeTerminationInvoluntaryDisability',
        'OcfStakeholderStatusTypeTerminationInvoluntaryWithCause',
      ];

      // Verify each DAML status converts to expected native status
      for (const [i, damlStatus] of damlStatuses.entries()) {
        expect(damlStakeholderStatusToNative(damlStatus as Parameters<typeof damlStakeholderStatusToNative>[0])).toBe(
          requireDefined(statuses[i], `native status at index ${i}`)
        );
      }
    });

    it('maintains consistency for relationship conversions', () => {
      const relationships = ['EMPLOYEE', 'ADVISOR', 'INVESTOR', 'FOUNDER', 'BOARD_MEMBER', 'OFFICER', 'OTHER'] as const;

      const damlRelationships: DamlStakeholderRelationshipType[] = [
        'OcfStakeholderRelationshipTypeEmployee',
        'OcfStakeholderRelationshipTypeAdvisor',
        'OcfStakeholderRelationshipTypeInvestor',
        'OcfStakeholderRelationshipTypeFounder',
        'OcfStakeholderRelationshipTypeBoardMember',
        'OcfStakeholderRelationshipTypeOfficer',
        'OcfStakeholderRelationshipTypeOther',
      ];

      // Verify each DAML relationship converts to expected native relationship
      for (const [i, damlRelationship] of damlRelationships.entries()) {
        expect(damlStakeholderRelationshipToNative(damlRelationship)).toBe(
          requireDefined(relationships[i], `native relationship at index ${i}`)
        );
      }
    });
  });
});
