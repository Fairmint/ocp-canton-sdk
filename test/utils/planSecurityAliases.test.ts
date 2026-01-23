/**
 * Tests for PlanSecurity to EquityCompensation alias functionality.
 */

import {
  isPlanSecurityEntityType,
  isPlanSecurityObjectType,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  PLAN_SECURITY_OBJECT_TYPE_MAP,
  PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP,
} from '../../src/utils/planSecurityAliases';

describe('PlanSecurity alias utilities', () => {
  describe('isPlanSecurityEntityType', () => {
    it('returns true for PlanSecurity entity types', () => {
      expect(isPlanSecurityEntityType('planSecurityIssuance')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityExercise')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityCancellation')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityAcceptance')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityRelease')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityRetraction')).toBe(true);
      expect(isPlanSecurityEntityType('planSecurityTransfer')).toBe(true);
    });

    it('returns false for non-PlanSecurity entity types', () => {
      expect(isPlanSecurityEntityType('equityCompensationIssuance')).toBe(false);
      expect(isPlanSecurityEntityType('stockIssuance')).toBe(false);
      expect(isPlanSecurityEntityType('stakeholder')).toBe(false);
      expect(isPlanSecurityEntityType('document')).toBe(false);
      expect(isPlanSecurityEntityType('invalidType')).toBe(false);
    });
  });

  describe('isPlanSecurityObjectType', () => {
    it('returns true for PlanSecurity object types', () => {
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_ISSUANCE')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_EXERCISE')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_CANCELLATION')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_ACCEPTANCE')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_RELEASE')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_RETRACTION')).toBe(true);
      expect(isPlanSecurityObjectType('TX_PLAN_SECURITY_TRANSFER')).toBe(true);
    });

    it('returns false for non-PlanSecurity object types', () => {
      expect(isPlanSecurityObjectType('TX_EQUITY_COMPENSATION_ISSUANCE')).toBe(false);
      expect(isPlanSecurityObjectType('TX_STOCK_ISSUANCE')).toBe(false);
      expect(isPlanSecurityObjectType('STAKEHOLDER')).toBe(false);
      expect(isPlanSecurityObjectType('INVALID_TYPE')).toBe(false);
    });
  });

  describe('normalizeEntityType', () => {
    it('converts PlanSecurity entity types to EquityCompensation types', () => {
      expect(normalizeEntityType('planSecurityIssuance')).toBe('equityCompensationIssuance');
      expect(normalizeEntityType('planSecurityExercise')).toBe('equityCompensationExercise');
      expect(normalizeEntityType('planSecurityCancellation')).toBe('equityCompensationCancellation');
      expect(normalizeEntityType('planSecurityAcceptance')).toBe('equityCompensationAcceptance');
      expect(normalizeEntityType('planSecurityRelease')).toBe('equityCompensationRelease');
      expect(normalizeEntityType('planSecurityRetraction')).toBe('equityCompensationRetraction');
      expect(normalizeEntityType('planSecurityTransfer')).toBe('equityCompensationTransfer');
    });

    it('returns non-PlanSecurity types unchanged', () => {
      expect(normalizeEntityType('equityCompensationIssuance')).toBe('equityCompensationIssuance');
      expect(normalizeEntityType('stockIssuance')).toBe('stockIssuance');
      expect(normalizeEntityType('stakeholder')).toBe('stakeholder');
      expect(normalizeEntityType('document')).toBe('document');
    });
  });

  describe('normalizeObjectType', () => {
    it('converts PlanSecurity object types to EquityCompensation types', () => {
      expect(normalizeObjectType('TX_PLAN_SECURITY_ISSUANCE')).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
      expect(normalizeObjectType('TX_PLAN_SECURITY_EXERCISE')).toBe('TX_EQUITY_COMPENSATION_EXERCISE');
      expect(normalizeObjectType('TX_PLAN_SECURITY_CANCELLATION')).toBe('TX_EQUITY_COMPENSATION_CANCELLATION');
      expect(normalizeObjectType('TX_PLAN_SECURITY_ACCEPTANCE')).toBe('TX_EQUITY_COMPENSATION_ACCEPTANCE');
      expect(normalizeObjectType('TX_PLAN_SECURITY_RELEASE')).toBe('TX_EQUITY_COMPENSATION_RELEASE');
      expect(normalizeObjectType('TX_PLAN_SECURITY_RETRACTION')).toBe('TX_EQUITY_COMPENSATION_RETRACTION');
      expect(normalizeObjectType('TX_PLAN_SECURITY_TRANSFER')).toBe('TX_EQUITY_COMPENSATION_TRANSFER');
    });

    it('returns non-PlanSecurity object types unchanged', () => {
      expect(normalizeObjectType('TX_EQUITY_COMPENSATION_ISSUANCE')).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
      expect(normalizeObjectType('TX_STOCK_ISSUANCE')).toBe('TX_STOCK_ISSUANCE');
      expect(normalizeObjectType('STAKEHOLDER')).toBe('STAKEHOLDER');
    });
  });

  describe('normalizeOcfData', () => {
    it('converts PlanSecurity object_type to EquityCompensation', () => {
      const input = {
        object_type: 'TX_PLAN_SECURITY_ISSUANCE',
        id: 'test-123',
        date: '2024-01-15',
        security_id: 'sec-001',
      };

      const result = normalizeOcfData(input);

      expect(result.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
      expect(result.id).toBe('test-123');
      expect(result.date).toBe('2024-01-15');
      expect(result.security_id).toBe('sec-001');
    });

    it('returns data unchanged if not a PlanSecurity type', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'test-123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input); // Same reference - no copy made
    });

    it('returns data unchanged if no object_type field', () => {
      const input = {
        id: 'test-123',
        name: 'Test',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });

    it('returns data unchanged if object_type is not a string', () => {
      const input = {
        object_type: 123,
        id: 'test-123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });
  });

  describe('alias mappings', () => {
    it('has correct entity type mappings', () => {
      expect(Object.keys(PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP)).toHaveLength(7);
      expect(PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP).toEqual({
        planSecurityIssuance: 'equityCompensationIssuance',
        planSecurityExercise: 'equityCompensationExercise',
        planSecurityCancellation: 'equityCompensationCancellation',
        planSecurityAcceptance: 'equityCompensationAcceptance',
        planSecurityRelease: 'equityCompensationRelease',
        planSecurityRetraction: 'equityCompensationRetraction',
        planSecurityTransfer: 'equityCompensationTransfer',
      });
    });

    it('has correct object type mappings', () => {
      expect(Object.keys(PLAN_SECURITY_OBJECT_TYPE_MAP)).toHaveLength(7);
      expect(PLAN_SECURITY_OBJECT_TYPE_MAP).toEqual({
        TX_PLAN_SECURITY_ISSUANCE: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        TX_PLAN_SECURITY_EXERCISE: 'TX_EQUITY_COMPENSATION_EXERCISE',
        TX_PLAN_SECURITY_CANCELLATION: 'TX_EQUITY_COMPENSATION_CANCELLATION',
        TX_PLAN_SECURITY_ACCEPTANCE: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
        TX_PLAN_SECURITY_RELEASE: 'TX_EQUITY_COMPENSATION_RELEASE',
        TX_PLAN_SECURITY_RETRACTION: 'TX_EQUITY_COMPENSATION_RETRACTION',
        TX_PLAN_SECURITY_TRANSFER: 'TX_EQUITY_COMPENSATION_TRANSFER',
      });
    });
  });
});
