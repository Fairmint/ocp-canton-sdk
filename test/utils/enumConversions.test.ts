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
    test('converts HOME to OcfPhoneHome', () => {
      expect(phoneTypeToDaml('HOME')).toBe('OcfPhoneHome');
    });

    test('converts MOBILE to OcfPhoneMobile', () => {
      expect(phoneTypeToDaml('MOBILE')).toBe('OcfPhoneMobile');
    });

    test('converts BUSINESS to OcfPhoneBusiness', () => {
      expect(phoneTypeToDaml('BUSINESS')).toBe('OcfPhoneBusiness');
    });

    test('converts OTHER to OcfPhoneOther', () => {
      expect(phoneTypeToDaml('OTHER')).toBe('OcfPhoneOther');
    });
  });

  describe('damlPhoneTypeToNative', () => {
    test('converts OcfPhoneHome to HOME', () => {
      expect(damlPhoneTypeToNative('OcfPhoneHome')).toBe('HOME');
    });

    test('converts OcfPhoneMobile to MOBILE', () => {
      expect(damlPhoneTypeToNative('OcfPhoneMobile')).toBe('MOBILE');
    });

    test('converts OcfPhoneBusiness to BUSINESS', () => {
      expect(damlPhoneTypeToNative('OcfPhoneBusiness')).toBe('BUSINESS');
    });

    test('converts OcfPhoneOther to OTHER', () => {
      expect(damlPhoneTypeToNative('OcfPhoneOther')).toBe('OTHER');
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
      expect(() => damlStockClassTypeToNative('InvalidType')).toThrow('Unknown DAML stock class type: InvalidType');
    });
  });

  describe('stakeholderRelationshipTypeToDaml', () => {
    test('converts EMPLOYEE to OcfRelEmployee', () => {
      expect(stakeholderRelationshipTypeToDaml('EMPLOYEE')).toBe('OcfRelEmployee');
    });

    test('converts ADVISOR to OcfRelAdvisor', () => {
      expect(stakeholderRelationshipTypeToDaml('ADVISOR')).toBe('OcfRelAdvisor');
    });

    test('converts INVESTOR to OcfRelInvestor', () => {
      expect(stakeholderRelationshipTypeToDaml('INVESTOR')).toBe('OcfRelInvestor');
    });

    test('converts FOUNDER to OcfRelFounder', () => {
      expect(stakeholderRelationshipTypeToDaml('FOUNDER')).toBe('OcfRelFounder');
    });

    test('converts BOARD_MEMBER to OcfRelBoardMember', () => {
      expect(stakeholderRelationshipTypeToDaml('BOARD_MEMBER')).toBe('OcfRelBoardMember');
    });

    test('converts OFFICER to OcfRelOfficer', () => {
      expect(stakeholderRelationshipTypeToDaml('OFFICER')).toBe('OcfRelOfficer');
    });

    test('converts OTHER to OcfRelOther', () => {
      expect(stakeholderRelationshipTypeToDaml('OTHER')).toBe('OcfRelOther');
    });

    test('throws for unknown values', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderRelationshipTypeToDaml('UNKNOWN')).toThrow();
    });
  });

  describe('damlStakeholderRelationshipToNative', () => {
    test('converts OcfRelEmployee to EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelEmployee')).toBe('EMPLOYEE');
    });

    test('converts OcfRelExEmployee to EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelExEmployee')).toBe('EMPLOYEE');
    });

    test('converts OcfRelNonUsEmployee to EMPLOYEE', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelNonUsEmployee')).toBe('EMPLOYEE');
    });

    test('converts OcfRelAdvisor to ADVISOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelAdvisor')).toBe('ADVISOR');
    });

    test('converts OcfRelExAdvisor to ADVISOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelExAdvisor')).toBe('ADVISOR');
    });

    test('converts OcfRelInvestor to INVESTOR', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelInvestor')).toBe('INVESTOR');
    });

    test('converts OcfRelFounder to FOUNDER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelFounder')).toBe('FOUNDER');
    });

    test('converts OcfRelBoardMember to BOARD_MEMBER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelBoardMember')).toBe('BOARD_MEMBER');
    });

    test('converts OcfRelOfficer to OFFICER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelOfficer')).toBe('OFFICER');
    });

    test('converts OcfRelExecutive to OFFICER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelExecutive')).toBe('OFFICER');
    });

    test('converts OcfRelConsultant to OTHER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelConsultant')).toBe('OTHER');
    });

    test('converts OcfRelExConsultant to OTHER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelExConsultant')).toBe('OTHER');
    });

    test('converts OcfRelOther to OTHER', () => {
      expect(damlStakeholderRelationshipToNative('OcfRelOther')).toBe('OTHER');
    });
  });

  describe('stakeholderStatusToDaml', () => {
    test('converts ACTIVE to OcfStakeholderStatusActive', () => {
      expect(stakeholderStatusToDaml('ACTIVE')).toBe('OcfStakeholderStatusActive');
    });

    test('converts LEAVE_OF_ABSENCE to OcfStakeholderStatusLeaveOfAbsence', () => {
      expect(stakeholderStatusToDaml('LEAVE_OF_ABSENCE')).toBe('OcfStakeholderStatusLeaveOfAbsence');
    });

    test('converts all TERMINATION statuses correctly', () => {
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_OTHER')).toBe(
        'OcfStakeholderStatusTerminationVoluntaryOther'
      );
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_GOOD_CAUSE')).toBe(
        'OcfStakeholderStatusTerminationVoluntaryGoodCause'
      );
      expect(stakeholderStatusToDaml('TERMINATION_VOLUNTARY_RETIREMENT')).toBe(
        'OcfStakeholderStatusTerminationVoluntaryRetirement'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_OTHER')).toBe(
        'OcfStakeholderStatusTerminationInvoluntaryOther'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_DEATH')).toBe(
        'OcfStakeholderStatusTerminationInvoluntaryDeath'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_DISABILITY')).toBe(
        'OcfStakeholderStatusTerminationInvoluntaryDisability'
      );
      expect(stakeholderStatusToDaml('TERMINATION_INVOLUNTARY_WITH_CAUSE')).toBe(
        'OcfStakeholderStatusTerminationInvoluntaryWithCause'
      );
    });
  });

  describe('damlStakeholderStatusToNative', () => {
    test('converts OcfStakeholderStatusActive to ACTIVE', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusActive')).toBe('ACTIVE');
    });

    test('converts OcfStakeholderStatusLeaveOfAbsence to LEAVE_OF_ABSENCE', () => {
      expect(damlStakeholderStatusToNative('OcfStakeholderStatusLeaveOfAbsence')).toBe('LEAVE_OF_ABSENCE');
    });

    test('converts all TERMINATION statuses correctly', () => {
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

    test('throws for unknown status', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlStakeholderStatusToNative('UnknownStatus')).toThrow(
        'Unknown DAML stakeholder status: UnknownStatus'
      );
    });
  });

  describe('error handling', () => {
    test('emailTypeToDaml throws for invalid email type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => emailTypeToDaml('INVALID')).toThrow('Unknown email type: INVALID');
    });

    test('damlEmailTypeToNative throws for invalid DAML email type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlEmailTypeToNative('InvalidDamlType')).toThrow('Unknown DAML email type: InvalidDamlType');
    });

    test('phoneTypeToDaml throws for invalid phone type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => phoneTypeToDaml('INVALID')).toThrow('Unknown phone type: INVALID');
    });

    test('damlPhoneTypeToNative throws for invalid DAML phone type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlPhoneTypeToNative('InvalidDamlType')).toThrow('Unknown DAML phone type: InvalidDamlType');
    });

    test('stakeholderTypeToDaml throws for invalid stakeholder type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderTypeToDaml('INVALID')).toThrow('Unknown stakeholder type: INVALID');
    });

    test('damlStakeholderTypeToNative throws for invalid DAML stakeholder type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => damlStakeholderTypeToNative('InvalidDamlType')).toThrow(
        'Unknown DAML stakeholder type: InvalidDamlType'
      );
    });

    test('stockClassTypeToDaml throws for invalid stock class type', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stockClassTypeToDaml('INVALID')).toThrow('Unknown stock class type: INVALID');
    });

    test('stakeholderStatusToDaml throws for invalid status', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => stakeholderStatusToDaml('INVALID')).toThrow('Unknown stakeholder status: INVALID');
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
