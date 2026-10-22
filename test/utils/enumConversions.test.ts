/** Unit tests for enumConversions utility functions. */

import {
  damlEmailTypeToNative,
  damlPhoneTypeToNative,
  damlStakeholderRelationshipToNative,
  damlStakeholderStatusToNative,
  damlStakeholderTypeToNative,
  damlStockClassTypeToNative,
  emailTypeToDaml,
  phoneTypeToDaml,
  stakeholderRelationshipTypeToDaml,
  stakeholderStatusToDaml,
  stakeholderTypeToDaml,
  stockClassTypeToDaml,
} from '../../src/utils/enumConversions';

describe('enumConversions', () => {
  describe('emailTypeToDaml', () => {
    test('converts PERSONAL to OcfEmailTypePersonal', () => {
      expect(emailTypeToDaml('PERSONAL')).toBe('OcfEmailTypePersonal');
    });

    test('converts BUSINESS to OcfEmailTypeBusiness', () => {
      expect(emailTypeToDaml('BUSINESS')).toBe('OcfEmailTypeBusiness');
    });

    test('converts OTHER to OcfEmailTypeOther', () => {
      expect(emailTypeToDaml('OTHER')).toBe('OcfEmailTypeOther');
    });
  });

  describe('damlEmailTypeToNative', () => {
    test('converts OcfEmailTypePersonal to PERSONAL', () => {
      expect(damlEmailTypeToNative('OcfEmailTypePersonal')).toBe('PERSONAL');
    });

    test('converts OcfEmailTypeBusiness to BUSINESS', () => {
      expect(damlEmailTypeToNative('OcfEmailTypeBusiness')).toBe('BUSINESS');
    });

    test('converts OcfEmailTypeOther to OTHER', () => {
      expect(damlEmailTypeToNative('OcfEmailTypeOther')).toBe('OTHER');
    });
  });

  describe('phoneTypeToDaml', () => {
    test('converts HOME to OcfPhoneTypeHome', () => {
      expect(phoneTypeToDaml('HOME')).toBe('OcfPhoneTypeHome');
    });

    test('converts MOBILE to OcfPhoneTypeMobile', () => {
      expect(phoneTypeToDaml('MOBILE')).toBe('OcfPhoneTypeMobile');
    });

    test('converts BUSINESS to OcfPhoneTypeBusiness', () => {
      expect(phoneTypeToDaml('BUSINESS')).toBe('OcfPhoneTypeBusiness');
    });

    test('converts OTHER to OcfPhoneTypeOther', () => {
      expect(phoneTypeToDaml('OTHER')).toBe('OcfPhoneTypeOther');
    });
  });

  describe('damlPhoneTypeToNative', () => {
    test('converts OcfPhoneTypeHome to HOME', () => {
      expect(damlPhoneTypeToNative('OcfPhoneTypeHome')).toBe('HOME');
    });

    test('converts OcfPhoneTypeMobile to MOBILE', () => {
      expect(damlPhoneTypeToNative('OcfPhoneTypeMobile')).toBe('MOBILE');
    });

    test('converts OcfPhoneTypeBusiness to BUSINESS', () => {
      expect(damlPhoneTypeToNative('OcfPhoneTypeBusiness')).toBe('BUSINESS');
    });

    test('converts OcfPhoneTypeOther to OTHER', () => {
      expect(damlPhoneTypeToNative('OcfPhoneTypeOther')).toBe('OTHER');
    });
  });

  describe('stakeholderTypeToDaml', () => {
    test('converts INDIVIDUAL to OcfStakeholderTypeIndividual', () => {
      expect(stakeholderTypeToDaml('INDIVIDUAL')).toBe('OcfStakeholderTypeIndividual');
    });

    test('converts INSTITUTION to OcfStakeholderTypeInstitution', () => {
      expect(stakeholderTypeToDaml('INSTITUTION')).toBe('OcfStakeholderTypeInstitution');
    });
  });

  describe('damlStakeholderTypeToNative', () => {
    test('converts OcfStakeholderTypeIndividual to INDIVIDUAL', () => {
      expect(damlStakeholderTypeToNative('OcfStakeholderTypeIndividual')).toBe('INDIVIDUAL');
    });

    test('converts OcfStakeholderTypeInstitution to INSTITUTION', () => {
      expect(damlStakeholderTypeToNative('OcfStakeholderTypeInstitution')).toBe('INSTITUTION');
    });
  });

  describe('stockClassTypeToDaml', () => {
    test('converts COMMON to OcfStockClassTypeCommon', () => {
      expect(stockClassTypeToDaml('COMMON')).toBe('OcfStockClassTypeCommon');
    });

    test('converts PREFERRED to OcfStockClassTypePreferred', () => {
      expect(stockClassTypeToDaml('PREFERRED')).toBe('OcfStockClassTypePreferred');
    });
  });

  describe('damlStockClassTypeToNative', () => {
    test('converts OcfStockClassTypeCommon to COMMON', () => {
      expect(damlStockClassTypeToNative('OcfStockClassTypeCommon')).toBe('COMMON');
    });

    test('converts OcfStockClassTypePreferred to PREFERRED', () => {
      expect(damlStockClassTypeToNative('OcfStockClassTypePreferred')).toBe('PREFERRED');
    });

    test('throws for unknown type', () => {
      expect(() => damlStockClassTypeToNative('InvalidType')).toThrow(
        'Unknown DAML OcfStockClassType constructor: InvalidType'
      );
    });
  });

  describe('stakeholderRelationshipTypeToDaml', () => {
    test('converts EMPLOYEE to OcfStakeholderRelationshipTypeEmployee', () => {
      expect(stakeholderRelationshipTypeToDaml('EMPLOYEE')).toBe('OcfStakeholderRelationshipTypeEmployee');
    });

    test('converts ADVISOR to OcfStakeholderRelationshipTypeAdvisor', () => {
      expect(stakeholderRelationshipTypeToDaml('ADVISOR')).toBe('OcfStakeholderRelationshipTypeAdvisor');
    });

    test('converts INVESTOR to OcfStakeholderRelationshipTypeInvestor', () => {
      expect(stakeholderRelationshipTypeToDaml('INVESTOR')).toBe('OcfStakeholderRelationshipTypeInvestor');
    });

    test('converts FOUNDER to OcfStakeholderRelationshipTypeFounder', () => {
      expect(stakeholderRelationshipTypeToDaml('FOUNDER')).toBe('OcfStakeholderRelationshipTypeFounder');
    });

    test('converts BOARD_MEMBER to OcfStakeholderRelationshipTypeBoardMember', () => {
      expect(stakeholderRelationshipTypeToDaml('BOARD_MEMBER')).toBe('OcfStakeholderRelationshipTypeBoardMember');
    });

    test('converts OFFICER to OcfStakeholderRelationshipTypeOfficer', () => {
      expect(stakeholderRelationshipTypeToDaml('OFFICER')).toBe('OcfStakeholderRelationshipTypeOfficer');
    });

    test('converts OTHER to OcfStakeholderRelationshipTypeOther', () => {
      expect(stakeholderRelationshipTypeToDaml('OTHER')).toBe('OcfStakeholderRelationshipTypeOther');
    });

    test('converts CONSULTANT to OcfStakeholderRelationshipTypeConsultant', () => {
      expect(stakeholderRelationshipTypeToDaml('CONSULTANT')).toBe('OcfStakeholderRelationshipTypeConsultant');
    });

    test('converts EX_ADVISOR to OcfStakeholderRelationshipTypeExAdvisor', () => {
      expect(stakeholderRelationshipTypeToDaml('EX_ADVISOR')).toBe('OcfStakeholderRelationshipTypeExAdvisor');
    });

    test('converts EX_CONSULTANT to OcfStakeholderRelationshipTypeExConsultant', () => {
      expect(stakeholderRelationshipTypeToDaml('EX_CONSULTANT')).toBe('OcfStakeholderRelationshipTypeExConsultant');
    });

    test('converts EX_EMPLOYEE to OcfStakeholderRelationshipTypeExEmployee', () => {
      expect(stakeholderRelationshipTypeToDaml('EX_EMPLOYEE')).toBe('OcfStakeholderRelationshipTypeExEmployee');
    });

    test('converts EXECUTIVE to OcfStakeholderRelationshipTypeExecutive', () => {
      expect(stakeholderRelationshipTypeToDaml('EXECUTIVE')).toBe('OcfStakeholderRelationshipTypeExecutive');
    });

    test('converts NON_US_EMPLOYEE to OcfStakeholderRelationshipTypeNonUsEmployee', () => {
      expect(stakeholderRelationshipTypeToDaml('NON_US_EMPLOYEE')).toBe('OcfStakeholderRelationshipTypeNonUsEmployee');
    });

    test('throws for unknown values', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderRelationshipTypeToDaml('UNKNOWN')).toThrow();
    });
  });

  describe('damlStakeholderRelationshipToNative', () => {
    test('converts OcfStakeholderRelationshipTypeEmployee to EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeEmployee')).toBe('EMPLOYEE');
    });

    test('converts OcfStakeholderRelationshipTypeExEmployee to EX_EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeExEmployee')).toBe('EX_EMPLOYEE');
    });

    test('converts OcfStakeholderRelationshipTypeNonUsEmployee to NON_US_EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeNonUsEmployee')).toBe(
        'NON_US_EMPLOYEE'
      );
    });

    test('converts OcfStakeholderRelationshipTypeAdvisor to ADVISOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeAdvisor')).toBe('ADVISOR');
    });

    test('converts OcfStakeholderRelationshipTypeExAdvisor to EX_ADVISOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeExAdvisor')).toBe('EX_ADVISOR');
    });

    test('converts OcfStakeholderRelationshipTypeInvestor to INVESTOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeInvestor')).toBe('INVESTOR');
    });

    test('converts OcfStakeholderRelationshipTypeFounder to FOUNDER', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeFounder')).toBe('FOUNDER');
    });

    test('converts OcfStakeholderRelationshipTypeBoardMember to BOARD_MEMBER', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeBoardMember')).toBe('BOARD_MEMBER');
    });

    test('converts OcfStakeholderRelationshipTypeOfficer to OFFICER', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeOfficer')).toBe('OFFICER');
    });

    test('converts OcfStakeholderRelationshipTypeExecutive to EXECUTIVE', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeExecutive')).toBe('EXECUTIVE');
    });

    test('converts OcfStakeholderRelationshipTypeConsultant to CONSULTANT', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeConsultant')).toBe('CONSULTANT');
    });

    test('converts OcfStakeholderRelationshipTypeExConsultant to EX_CONSULTANT', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeExConsultant')).toBe('EX_CONSULTANT');
    });

    test('converts OcfStakeholderRelationshipTypeOther to OTHER', () => {
      expect(damlStakeholderRelationshipToNative('OcfStakeholderRelationshipTypeOther')).toBe('OTHER');
    });
  });

  describe('stakeholderStatusToDaml', () => {
    test('converts ACTIVE to OcfStakeholderStatusTypeActive', () => {
      expect(stakeholderStatusToDaml('ACTIVE')).toBe('OcfStakeholderStatusTypeActive');
    });

    test('converts LEAVE_OF_ABSENCE to OcfStakeholderStatusTypeLeaveOfAbsence', () => {
      expect(stakeholderStatusToDaml('LEAVE_OF_ABSENCE')).toBe('OcfStakeholderStatusTypeLeaveOfAbsence');
    });

    test('converts all TERMINATION statuses correctly', () => {
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_OTHER')).toBe(
        'OcfStakeholderStatusTypeTerminationVoluntaryOther'
      );
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_GOOD_CAUSE')).toBe(
        'OcfStakeholderStatusTypeTerminationVoluntaryGoodCause'
      );
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_RETIREMENT')).toBe(
        'OcfStakeholderStatusTypeTerminationVoluntaryRetirement'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_OTHER')).toBe(
        'OcfStakeholderStatusTypeTerminationInvoluntaryOther'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_DEATH')).toBe(
        'OcfStakeholderStatusTypeTerminationInvoluntaryDeath'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_DISABILITY')).toBe(
        'OcfStakeholderStatusTypeTerminationInvoluntaryDisability'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_WITH_CAUSE')).toBe(
        'OcfStakeholderStatusTypeTerminationInvoluntaryWithCause'
      );
    });
  });

  describe('damlStakeholderStatusToNative', () => {
    test('converts OcfStakeholderStatusTypeActive to ACTIVE', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeActive')).toBe('ACTIVE');
    });

    test('converts OcfStakeholderStatusTypeLeaveOfAbsence to LEAVE_OF_ABSENCE', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusTypeLeaveOfAbsence')).toBe('LEAVE_OF_ABSENCE');
    });

    test('converts all TERMINATION statuses correctly', () => {
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

    test('throws for unknown status', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlStakeholderStatusToNative('UnknownStatus')).toThrow(
        'Unknown DAML OcfStakeholderStatusType constructor: UnknownStatus'
      );
    });
  });

  describe('error handling', () => {
    test('emailTypeToDaml throws for invalid email type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => emailTypeToDaml('INVALID')).toThrow('Unknown OcfEmailType value: INVALID');
    });

    test('damlEmailTypeToNative throws for invalid DAML email type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlEmailTypeToNative('InvalidDamlType')).toThrow(
        'Unknown DAML OcfEmailType constructor: InvalidDamlType'
      );
    });

    test('phoneTypeToDaml throws for invalid phone type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => phoneTypeToDaml('INVALID')).toThrow('Unknown OcfPhoneType value: INVALID');
    });

    test('damlPhoneTypeToNative throws for invalid DAML phone type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlPhoneTypeToNative('InvalidDamlType')).toThrow(
        'Unknown DAML OcfPhoneType constructor: InvalidDamlType'
      );
    });

    test('stakeholderTypeToDaml throws for invalid stakeholder type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderTypeToDaml('INVALID')).toThrow('Unknown OcfStakeholderType value: INVALID');
    });

    test('damlStakeholderTypeToNative throws for invalid DAML stakeholder type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlStakeholderTypeToNative('InvalidDamlType')).toThrow(
        'Unknown DAML OcfStakeholderType constructor: InvalidDamlType'
      );
    });

    test('stockClassTypeToDaml throws for invalid stock class type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stockClassTypeToDaml('INVALID')).toThrow('Unknown OcfStockClassType value: INVALID');
    });

    test('stakeholderStatusToDaml throws for invalid status', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderStatusToDaml('INVALID')).toThrow('Unknown OcfStakeholderStatusType value: INVALID');
    });
  });

  describe('bidirectional conversion consistency', () => {
    test('email type conversions are bidirectional', () => {
      const emailTypes = ['PERSONAL', 'BUSINESS', 'OTHER'] as const;
      for (const type of emailTypes) {
        expect(damlEmailTypeToNative(emailTypeToDaml(type))).toBe(type);
      }
    });

    test('phone type conversions are bidirectional', () => {
      const phoneTypes = ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'] as const;
      for (const type of phoneTypes) {
        expect(damlPhoneTypeToNative(phoneTypeToDaml(type))).toBe(type);
      }
    });

    test('stakeholder type conversions are bidirectional', () => {
      const stakeholderTypes = ['INDIVIDUAL', 'INSTITUTION'] as const;
      for (const type of stakeholderTypes) {
        expect(damlStakeholderTypeToNative(stakeholderTypeToDaml(type))).toBe(type);
      }
    });

    test('stock class type conversions are bidirectional', () => {
      const stockClassTypes = ['COMMON', 'PREFERRED'] as const;
      for (const type of stockClassTypes) {
        expect(damlStockClassTypeToNative(stockClassTypeToDaml(type))).toBe(type);
      }
    });

    test('stakeholder status conversions are bidirectional', () => {
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
      for (const status of statuses) {
        expect(damlStakeholderStatusToNative(stakeholderStatusToDaml(status))).toBe(status);
      }
    });
  });
});
