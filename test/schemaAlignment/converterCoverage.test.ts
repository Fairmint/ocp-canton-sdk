/**
 * Converter coverage tests: verify all OCF enum values have converter mappings
 * in both directions (OCF→DAML and DAML→OCF).
 *
 * For each enum converter, we call it with every possible input value and verify
 * it doesn't throw. This ensures no values are missing from switch statements.
 */

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

import { mapDamlTriggerTypeToOcf } from '../../src/utils/typeConversions';

describe('converterCoverage', () => {
  describe('emailTypeToDaml', () => {
    const values = ['PERSONAL', 'BUSINESS', 'OTHER'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => emailTypeToDaml(value)).not.toThrow();
      const result = emailTypeToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlEmailTypeToNative', () => {
    const values = ['OcfEmailTypePersonal', 'OcfEmailTypeBusiness', 'OcfEmailTypeOther'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlEmailTypeToNative(value)).not.toThrow();
      const result = damlEmailTypeToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('phoneTypeToDaml', () => {
    const values = ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => phoneTypeToDaml(value)).not.toThrow();
      const result = phoneTypeToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlPhoneTypeToNative', () => {
    const values = ['OcfPhoneHome', 'OcfPhoneMobile', 'OcfPhoneBusiness', 'OcfPhoneOther'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlPhoneTypeToNative(value)).not.toThrow();
      const result = damlPhoneTypeToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('stakeholderTypeToDaml', () => {
    const values = ['INDIVIDUAL', 'INSTITUTION'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => stakeholderTypeToDaml(value)).not.toThrow();
      const result = stakeholderTypeToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlStakeholderTypeToNative', () => {
    const values = ['OcfStakeholderTypeIndividual', 'OcfStakeholderTypeInstitution'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlStakeholderTypeToNative(value)).not.toThrow();
      const result = damlStakeholderTypeToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('stockClassTypeToDaml', () => {
    const values = ['PREFERRED', 'COMMON'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => stockClassTypeToDaml(value)).not.toThrow();
      const result = stockClassTypeToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlStockClassTypeToNative', () => {
    const values = ['OcfStockClassTypePreferred', 'OcfStockClassTypeCommon'] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlStockClassTypeToNative(value)).not.toThrow();
      const result = damlStockClassTypeToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('stakeholderRelationshipTypeToDaml', () => {
    const values = [
      'ADVISOR',
      'BOARD_MEMBER',
      'CONSULTANT',
      'EMPLOYEE',
      'EX_ADVISOR',
      'EX_CONSULTANT',
      'EX_EMPLOYEE',
      'EXECUTIVE',
      'FOUNDER',
      'INVESTOR',
      'NON_US_EMPLOYEE',
      'OFFICER',
      'OTHER',
    ] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => stakeholderRelationshipTypeToDaml(value)).not.toThrow();
      const result = stakeholderRelationshipTypeToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlStakeholderRelationshipToNative', () => {
    const values = [
      'OcfRelAdvisor',
      'OcfRelBoardMember',
      'OcfRelConsultant',
      'OcfRelEmployee',
      'OcfRelExAdvisor',
      'OcfRelExConsultant',
      'OcfRelExEmployee',
      'OcfRelExecutive',
      'OcfRelFounder',
      'OcfRelInvestor',
      'OcfRelNonUsEmployee',
      'OcfRelOfficer',
      'OcfRelOther',
    ] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlStakeholderRelationshipToNative(value)).not.toThrow();
      const result = damlStakeholderRelationshipToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('stakeholderStatusToDaml', () => {
    const values = [
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
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => stakeholderStatusToDaml(value)).not.toThrow();
      const result = stakeholderStatusToDaml(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('damlStakeholderStatusToNative', () => {
    const values = [
      'OcfStakeholderStatusActive',
      'OcfStakeholderStatusLeaveOfAbsence',
      'OcfStakeholderStatusTerminationVoluntaryOther',
      'OcfStakeholderStatusTerminationVoluntaryGoodCause',
      'OcfStakeholderStatusTerminationVoluntaryRetirement',
      'OcfStakeholderStatusTerminationInvoluntaryOther',
      'OcfStakeholderStatusTerminationInvoluntaryDeath',
      'OcfStakeholderStatusTerminationInvoluntaryDisability',
      'OcfStakeholderStatusTerminationInvoluntaryWithCause',
    ] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => damlStakeholderStatusToNative(value)).not.toThrow();
      const result = damlStakeholderStatusToNative(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('mapDamlTriggerTypeToOcf', () => {
    const values = [
      'OcfTriggerTypeTypeAutomaticOnDate',
      'OcfTriggerTypeTypeElectiveInRange',
      'OcfTriggerTypeTypeElectiveOnCondition',
      'OcfTriggerTypeTypeElectiveAtWill',
      'OcfTriggerTypeTypeUnspecified',
      'OcfTriggerTypeTypeAutomaticOnCondition',
    ] as const;
    test.each(values)('converts %s without throwing', (value) => {
      expect(() => mapDamlTriggerTypeToOcf(value)).not.toThrow();
      const result = mapDamlTriggerTypeToOcf(value);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ===== Round-trip consistency tests =====

  describe('round-trip: email type', () => {
    const values = ['PERSONAL', 'BUSINESS', 'OTHER'] as const;
    test.each(values)('%s survives round-trip', (value) => {
      const daml = emailTypeToDaml(value);
      const native = damlEmailTypeToNative(daml);
      expect(native).toBe(value);
    });
  });

  describe('round-trip: phone type', () => {
    const values = ['HOME', 'MOBILE', 'BUSINESS', 'OTHER'] as const;
    test.each(values)('%s survives round-trip', (value) => {
      const daml = phoneTypeToDaml(value);
      const native = damlPhoneTypeToNative(daml);
      expect(native).toBe(value);
    });
  });

  describe('round-trip: stakeholder type', () => {
    const values = ['INDIVIDUAL', 'INSTITUTION'] as const;
    test.each(values)('%s survives round-trip', (value) => {
      const daml = stakeholderTypeToDaml(value);
      const native = damlStakeholderTypeToNative(daml);
      expect(native).toBe(value);
    });
  });

  describe('round-trip: stock class type', () => {
    const values = ['PREFERRED', 'COMMON'] as const;
    test.each(values)('%s survives round-trip', (value) => {
      const daml = stockClassTypeToDaml(value);
      const native = damlStockClassTypeToNative(daml);
      expect(native).toBe(value);
    });
  });

  describe('round-trip: stakeholder relationship type', () => {
    const values = [
      'ADVISOR',
      'BOARD_MEMBER',
      'CONSULTANT',
      'EMPLOYEE',
      'EX_ADVISOR',
      'EX_CONSULTANT',
      'EX_EMPLOYEE',
      'EXECUTIVE',
      'FOUNDER',
      'INVESTOR',
      'NON_US_EMPLOYEE',
      'OFFICER',
      'OTHER',
    ] as const;
    test.each(values)('%s survives round-trip', (value) => {
      const daml = stakeholderRelationshipTypeToDaml(value);
      const native = damlStakeholderRelationshipToNative(daml);
      expect(native).toBe(value);
    });
  });

  describe('round-trip: stakeholder status', () => {
    const values = [
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
    test.each(values)('%s survives round-trip', (value) => {
      const daml = stakeholderStatusToDaml(value);
      const native = damlStakeholderStatusToNative(daml);
      expect(native).toBe(value);
    });
  });
});
