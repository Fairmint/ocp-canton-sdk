/**
 * Tests for PlanSecurity to EquityCompensation alias functionality.
 */

import {
  isLegacyObjectType,
  isPlanSecurityEntityType,
  isPlanSecurityObjectType,
  LEGACY_OBJECT_TYPE_MAP,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  PLAN_SECURITY_OBJECT_TYPE_MAP,
  PLAN_SECURITY_TO_EQUITY_COMPENSATION_MAP,
} from '../../src/utils/planSecurityAliases';
import { validateOcfObject } from './ocfSchemaValidator';

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

  describe('isLegacyObjectType', () => {
    it('returns true for legacy stakeholder event object types', () => {
      expect(isLegacyObjectType('TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT')).toBe(true);
      expect(isLegacyObjectType('TX_STAKEHOLDER_STATUS_CHANGE_EVENT')).toBe(true);
    });

    it('returns false for canonical object types', () => {
      expect(isLegacyObjectType('CE_STAKEHOLDER_RELATIONSHIP')).toBe(false);
      expect(isLegacyObjectType('CE_STAKEHOLDER_STATUS')).toBe(false);
      expect(isLegacyObjectType('TX_STOCK_ISSUANCE')).toBe(false);
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

    it('converts legacy stakeholder event object types to canonical CE_* values', () => {
      expect(normalizeObjectType('TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT')).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(normalizeObjectType('TX_STAKEHOLDER_STATUS_CHANGE_EVENT')).toBe('CE_STAKEHOLDER_STATUS');
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

    it('strips date field from DOCUMENT objects (not modeled in DAML)', () => {
      const input = {
        object_type: 'DOCUMENT',
        id: 'doc-1',
        md5: 'abc123',
        date: '2024-08-14',
        comments: ['test'],
      };

      const result = normalizeOcfData(input);

      expect(result.id).toBe('doc-1');
      expect(result.md5).toBe('abc123');
      expect(result.comments).toEqual(['test']);
      expect(result).not.toHaveProperty('date');
    });

    it('does not strip date from non-DOCUMENT objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'tx-1',
        date: '2024-01-15',
      };

      const result = normalizeOcfData(input);

      expect(result.date).toBe('2024-01-15');
    });

    it('returns DOCUMENT data unchanged when no non-DAML fields present', () => {
      const input = {
        object_type: 'DOCUMENT',
        id: 'doc-1',
        md5: 'abc123',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input); // Same reference - no copy needed
    });

    it('maps stakeholder current_relationship to current_relationships', async () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'INVESTOR',
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result).toMatchObject({ current_relationships: ['INVESTOR'] });
    });

    it('strips legacy current_relationship after migrating to current_relationships', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Bella Hadid' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'INVESTOR',
      };

      const result = normalizeOcfData(input) as Record<string, unknown>;

      expect(result.current_relationships).toEqual(['INVESTOR']);
      expect(result).not.toHaveProperty('current_relationship');
    });

    it('produces identical output for DB-style and Canton-style stakeholders (Diamond drift)', () => {
      const dbStyle = {
        object_type: 'STAKEHOLDER',
        id: 'stk-001',
        name: { legal_name: 'Victor Mangini' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'INVESTOR',
      };
      const cantonStyle = {
        object_type: 'STAKEHOLDER',
        id: 'stk-001',
        name: { legal_name: 'Victor Mangini' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR'],
      };

      const dbResult = normalizeOcfData(dbStyle);
      const cantonResult = normalizeOcfData(cantonStyle);

      expect(JSON.stringify(dbResult)).toBe(JSON.stringify(cantonResult));
    });

    it('produces identical output for multiple INVESTOR stakeholders (Fairbnb drift)', () => {
      const stakeholders = [
        { name: 'Stakeholder A', rel: 'INVESTOR' },
        { name: 'Stakeholder B', rel: 'INVESTOR' },
        { name: 'Stakeholder C', rel: 'FOUNDER' },
        { name: 'Stakeholder D', rel: 'INVESTOR' },
      ];

      for (const { name, rel } of stakeholders) {
        const dbStyle = {
          object_type: 'STAKEHOLDER' as const,
          id: `stk-${name}`,
          name: { legal_name: name },
          stakeholder_type: 'INDIVIDUAL',
          current_relationship: rel,
        };
        const cantonStyle = {
          object_type: 'STAKEHOLDER' as const,
          id: `stk-${name}`,
          name: { legal_name: name },
          stakeholder_type: 'INDIVIDUAL',
          current_relationships: [rel],
        };

        const dbResult = normalizeOcfData(dbStyle);
        const cantonResult = normalizeOcfData(cantonStyle);

        expect(JSON.stringify(dbResult)).toBe(JSON.stringify(cantonResult));
      }
    });

    it('produces identical output for FOUNDER relationship (Protelicious drift)', () => {
      const dbStyle = {
        object_type: 'STAKEHOLDER',
        id: 'stk-founder',
        name: { legal_name: 'William Strat' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'FOUNDER',
      };
      const cantonStyle = {
        object_type: 'STAKEHOLDER',
        id: 'stk-founder',
        name: { legal_name: 'William Strat' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['FOUNDER'],
      };

      const dbResult = normalizeOcfData(dbStyle);
      const cantonResult = normalizeOcfData(cantonStyle);

      expect(JSON.stringify(dbResult)).toBe(JSON.stringify(cantonResult));
    });

    it('keeps explicit stakeholder current_relationships authoritative over legacy field', async () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 'INVESTOR',
        current_relationships: [],
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result).toBe(input);
      expect(result.current_relationships).toEqual([]);
    });

    it('normalizes stakeholder current_relationships ordering and duplicates', async () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', 'FOUNDER', 'INVESTOR'],
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result.current_relationships).toEqual(['FOUNDER', 'INVESTOR']);
    });

    it('does not map legacy current_relationship for non-stakeholder objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'tx-1',
        current_relationship: 'INVESTOR',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result).not.toHaveProperty('current_relationships');
    });

    it('throws for non-string entries in stakeholder current_relationships', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', 7],
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stakeholder current_relationships entry');
    });

    it('throws for empty-string entries in stakeholder current_relationships', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', '   '],
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stakeholder current_relationships entry');
    });

    it('throws when stakeholder current_relationships is not an array', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: 'INVESTOR',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stakeholder current_relationships: expected array');
    });

    it('throws when stakeholder current_relationship is not a string', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: 9,
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stakeholder current_relationship: expected string');
    });

    it('throws when stakeholder current_relationship is an empty string', () => {
      const input = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationship: '   ',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stakeholder current_relationship: empty string');
    });

    it('maps stock plan stock_class_id to stock_class_ids and removes deprecated field', async () => {
      const input: Record<string, unknown> = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: 'sc-1',
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result);

      expect(result.stock_class_ids).toEqual(['sc-1']);
      expect(result).not.toHaveProperty('stock_class_id');
    });

    it('keeps explicit stock plan stock_class_ids authoritative over legacy field', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1', 'sc-2'],
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result.stock_class_ids).toEqual(['sc-1', 'sc-2']);
    });

    it('returns stock plan unchanged when stock_class_ids already present', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1'],
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
    });

    it('does not map legacy stock_class_id for non-stock-plan objects', () => {
      const input = {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'tx-1',
        stock_class_id: 'sc-1',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result).not.toHaveProperty('stock_class_ids');
    });

    it('throws when stock plan stock_class_ids is not an array', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: 'sc-1',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_ids: expected array');
    });

    it('throws when stock plan stock_class_ids is null', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: null,
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_ids: expected array');
    });

    it('throws when stock plan stock_class_id is not a string', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: 9,
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_id: expected string');
    });

    it('throws when stock plan stock_class_id is an empty string', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: '   ',
      };

      expect(() => normalizeOcfData(input)).toThrow('Invalid stock plan stock_class_id: empty string');
    });

    it('canonicalizes deprecated option_grant_type to compensation_type', async () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        custom_id: 'custom-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        exercise_price: { amount: '1.00', currency: 'USD' },
        expiration_date: null,
        termination_exercise_windows: [],
        security_law_exemptions: [],
        compensation_type: 'OPTION',
        option_grant_type: 'NSO',
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result as Record<string, unknown>);

      expect(result.compensation_type).toBe('OPTION_NSO');
      expect(result).not.toHaveProperty('option_grant_type');
    });

    it('canonicalizes deprecated plan_security_type to compensation_type', async () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        custom_id: 'custom-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        exercise_price: { amount: '1.00', currency: 'USD' },
        expiration_date: null,
        termination_exercise_windows: [],
        security_law_exemptions: [],
        plan_security_type: 'OPTION',
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.compensation_type).toBe('OPTION');
      expect(resultRecord).not.toHaveProperty('plan_security_type');
    });

    it('throws a clear error when legacy plan_security_type is OTHER', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        custom_id: 'custom-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        expiration_date: null,
        termination_exercise_windows: [],
        security_law_exemptions: [],
        plan_security_type: 'OTHER',
      };

      expect(() => normalizeOcfData(input)).toThrow("plan_security_type 'OTHER' is not supported");
    });

    it('throws when option_grant_type conflicts with compensation_type', () => {
      const input = {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'eq-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'sc-1',
        quantity: '100',
        compensation_type: 'RSU',
        option_grant_type: 'ISO',
      };

      expect(() => normalizeOcfData(input)).toThrow('conflicts with compensation_type');
    });

    it('canonicalizes legacy stakeholder relationship change event fields', async () => {
      const input = {
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        id: 'event-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_relationships: ['INVESTOR'],
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(resultRecord.relationship_started).toBe('INVESTOR');
      expect(resultRecord).not.toHaveProperty('new_relationships');
    });

    it('rejects stakeholder relationship change events with ambiguous legacy multi-value relationships', () => {
      const input = {
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        id: 'event-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_relationships: ['INVESTOR', 'FOUNDER'],
      };

      expect(() => normalizeOcfData(input)).toThrow('legacy new_relationships with multiple entries is ambiguous');
    });

    it('rejects unknown stakeholder relationship values', () => {
      const input = {
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        id: 'event-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_relationships: ['UNKNOWN_RELATIONSHIP'],
      };

      expect(() => normalizeOcfData(input)).toThrow('unknown relationship');
    });

    it('canonicalizes legacy stakeholder status change event reason_text into comments', async () => {
      const input = {
        object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
        id: 'event-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_status: 'ACTIVE',
        reason_text: 'legacy reason',
        comments: ['existing'],
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result as Record<string, unknown>);

      expect(result.object_type).toBe('CE_STAKEHOLDER_STATUS');
      expect(result.comments).toEqual(['existing', 'legacy reason']);
      expect(result).not.toHaveProperty('reason_text');
    });

    it('canonicalizes stock consolidation resulting_security_ids to resulting_security_id', async () => {
      const input = {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'stock-consolidation-1',
        date: '2024-01-15',
        security_ids: ['sec-1', 'sec-2'],
        resulting_security_ids: ['sec-new-1'],
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.resulting_security_id).toBe('sec-new-1');
      expect(resultRecord).not.toHaveProperty('resulting_security_ids');
    });

    it('rejects conflicting stock consolidation legacy and canonical resulting security IDs', () => {
      const input = {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'stock-consolidation-1',
        date: '2024-01-15',
        security_ids: ['sec-1', 'sec-2'],
        resulting_security_id: 'sec-canonical',
        resulting_security_ids: ['sec-legacy'],
      };

      expect(() => normalizeOcfData(input)).toThrow('Conflicting stock consolidation resulting security IDs');
    });

    it('canonicalizes stock conversion quantity to quantity_converted', async () => {
      const input = {
        object_type: 'TX_STOCK_CONVERSION',
        id: 'stock-conversion-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        quantity: '100',
        resulting_security_ids: ['sec-new-1'],
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.quantity_converted).toBe('100');
      expect(resultRecord).not.toHaveProperty('quantity');
    });

    it('canonicalizes stock class split legacy ratio fields to split_ratio', async () => {
      const input = {
        object_type: 'TX_STOCK_CLASS_SPLIT',
        id: 'stock-class-split-1',
        date: '2024-01-15',
        stock_class_id: 'sc-1',
        split_ratio_numerator: '3',
        split_ratio_denominator: '2',
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.split_ratio).toEqual({
        numerator: '3',
        denominator: '2',
      });
      expect(resultRecord).not.toHaveProperty('split_ratio_numerator');
      expect(resultRecord).not.toHaveProperty('split_ratio_denominator');
    });

    it('canonicalizes stock class conversion ratio legacy fields to conversion mechanism', async () => {
      const input = {
        object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
        id: 'stock-class-ratio-adj-1',
        date: '2024-01-15',
        stock_class_id: 'sc-1',
        new_ratio_numerator: '11',
        new_ratio_denominator: '10',
      };

      const result = normalizeOcfData(input);
      const resultRecord = result as Record<string, unknown>;
      await validateOcfObject(resultRecord);

      expect(resultRecord.new_ratio_conversion_mechanism).toEqual({
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '0', currency: 'USD' },
        ratio: { numerator: '11', denominator: '10' },
        rounding_type: 'NORMAL',
      });
      expect(resultRecord).not.toHaveProperty('new_ratio_numerator');
      expect(resultRecord).not.toHaveProperty('new_ratio_denominator');
    });

    it('strips null split_transaction_id from stock reissuance', async () => {
      const input = {
        object_type: 'TX_STOCK_REISSUANCE',
        id: 'stock-reissuance-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        resulting_security_ids: ['sec-new-1'],
        split_transaction_id: null,
      };

      const result = normalizeOcfData(input);
      await validateOcfObject(result as Record<string, unknown>);

      expect(result).not.toHaveProperty('split_transaction_id');
    });

    describe('normalizeOcfData - numeric string normalization', () => {
      describe('trailing zero stripping', () => {
        it('strips trailing zeros from nested monetary amount', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            investment_amount: { amount: '100000.00', currency: 'USD' },
          } as Record<string, unknown>);
          expect((result.investment_amount as Record<string, unknown>).amount).toBe('100000');
        });

        it('normalizes "0.00" to "0"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            some_rate: '0.00',
          } as Record<string, unknown>);
          expect(result.some_rate).toBe('0');
        });

        it('normalizes "0.10" to "0.1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            some_rate: '0.10',
          } as Record<string, unknown>);
          expect(result.some_rate).toBe('0.1');
        });

        it('normalizes "1.00" to "1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '1.00',
          } as Record<string, unknown>);
          expect(result.value).toBe('1');
        });

        it('normalizes "123.4500" to "123.45"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '123.4500',
          } as Record<string, unknown>);
          expect(result.value).toBe('123.45');
        });

        it('normalizes negative decimal "-100.00" to "-100"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '-100.00',
          } as Record<string, unknown>);
          expect(result.value).toBe('-100');
        });

        it('normalizes negative decimal "-0.10" to "-0.1"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '-0.10',
          } as Record<string, unknown>);
          expect(result.value).toBe('-0.1');
        });

        it('normalizes "0.0" to "0"', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            value: '0.0',
          } as Record<string, unknown>);
          expect(result.value).toBe('0');
        });
      });

      describe('already-normalized values unchanged', () => {
        it('leaves integer string "100000" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            quantity: '100000',
          } as Record<string, unknown>);
          expect(result.quantity).toBe('100000');
        });

        it('leaves "0.1" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            rate: '0.1',
          } as Record<string, unknown>);
          expect(result.rate).toBe('0.1');
        });

        it('leaves "123.456" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            amount: '123.456',
          } as Record<string, unknown>);
          expect(result.amount).toBe('123.456');
        });

        it('leaves "0" unchanged', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            value: '0',
          } as Record<string, unknown>);
          expect(result.value).toBe('0');
        });
      });

      describe('non-numeric strings not touched', () => {
        it('does not touch IDs or names', () => {
          const result = normalizeOcfData({
            object_type: 'STAKEHOLDER',
            id: 'stk_000001',
            name: { legal_name: 'Alice Doe' },
            stakeholder_type: 'INDIVIDUAL',
          } as Record<string, unknown>);
          expect(result.id).toBe('stk_000001');
          expect((result.name as Record<string, unknown>).legal_name).toBe('Alice Doe');
        });

        it('does not touch date strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            date: '2024-01-15',
          } as Record<string, unknown>);
          expect(result.date).toBe('2024-01-15');
        });

        it('does not touch enum strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            status: 'ACTIVE',
          } as Record<string, unknown>);
          expect(result.status).toBe('ACTIVE');
        });

        it('does not touch IDs or empty strings', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'abc-123-def',
            custom_id: '',
          } as Record<string, unknown>);
          expect(result.id).toBe('abc-123-def');
          expect(result.custom_id).toBe('');
        });
      });

      describe('nested object and array normalization', () => {
        it('normalizes nested monetary amount but leaves currency', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            investment_amount: { amount: '100000.00', currency: 'USD' },
          } as Record<string, unknown>);
          const investmentAmount = result.investment_amount as Record<string, unknown>;
          expect(investmentAmount.amount).toBe('100000');
          expect(investmentAmount.currency).toBe('USD');
        });

        it('normalizes values inside arrays of objects', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            items: [{ rate: '0.10' }, { rate: '5.00' }],
          } as Record<string, unknown>);
          const items = result.items as Array<Record<string, unknown>>;
          expect(items[0].rate).toBe('0.1');
          expect(items[1].rate).toBe('5');
        });

        it('normalizes values three levels deep', () => {
          const result = normalizeOcfData({
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'x',
            conversion_triggers: [
              {
                conversion_right: {
                  conversion_mechanism: {
                    interest_rates: [{ rate: '0.10' }],
                  },
                },
              },
            ],
          } as Record<string, unknown>);
          const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
          const right = triggers[0].conversion_right as Record<string, unknown>;
          const mechanism = right.conversion_mechanism as Record<string, unknown>;
          const rates = mechanism.interest_rates as Array<Record<string, unknown>>;
          expect(rates[0].rate).toBe('0.1');
        });
      });

      describe('real-world OCF object scenarios', () => {
        it('normalizes a convertible issuance with nested interest rates', () => {
          const input = {
            object_type: 'TX_CONVERTIBLE_ISSUANCE',
            id: 'ci-001',
            date: '2024-01-15',
            security_id: 'sec-001',
            stakeholder_id: 'stk-001',
            investment_amount: { amount: '100000.00', currency: 'USD' },
            conversion_triggers: [
              {
                trigger_id: 'trig-1',
                conversion_right: {
                  conversion_mechanism: {
                    type: 'CONVERTIBLE_NOTE_CONVERSION',
                    interest_rates: [
                      { rate: '0.00', accrual_start_date: '2024-01-15' },
                      { rate: '0.10', accrual_start_date: '2024-06-15' },
                    ],
                  },
                },
              },
            ],
          } as Record<string, unknown>;

          const result = normalizeOcfData(input);

          expect((result.investment_amount as Record<string, unknown>).amount).toBe('100000');
          const triggers = result.conversion_triggers as Array<Record<string, unknown>>;
          const right = triggers[0].conversion_right as Record<string, unknown>;
          const mechanism = right.conversion_mechanism as Record<string, unknown>;
          const rates = mechanism.interest_rates as Array<Record<string, unknown>>;
          expect(rates[0].rate).toBe('0');
          expect(rates[0].accrual_start_date).toBe('2024-01-15');
          expect(rates[1].rate).toBe('0.1');
          expect(rates[1].accrual_start_date).toBe('2024-06-15');
          expect(result.date).toBe('2024-01-15');
          expect(result.id).toBe('ci-001');
          expect(result.security_id).toBe('sec-001');
          expect(result.stakeholder_id).toBe('stk-001');
        });

        it('applies relationship normalization without touching non-numeric fields', () => {
          const input = {
            object_type: 'STAKEHOLDER',
            id: 'stk_000001',
            name: { legal_name: 'Alice Doe' },
            stakeholder_type: 'INDIVIDUAL',
            current_relationship: 'INVESTOR',
          } as Record<string, unknown>;

          const result = normalizeOcfData(input);

          expect(result.id).toBe('stk_000001');
          expect((result.name as Record<string, unknown>).legal_name).toBe('Alice Doe');
          expect(result.current_relationships).toEqual(['INVESTOR']);
          expect(result.stakeholder_type).toBe('INDIVIDUAL');
        });
      });

      describe('edge cases', () => {
        it('preserves null values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            optional_field: null,
          } as Record<string, unknown>);
          expect(result.optional_field).toBeNull();
        });

        it('does not touch boolean values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            flag: true,
          } as Record<string, unknown>);
          expect(result.flag).toBe(true);
        });

        it('does not touch number values', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            count: 42,
          } as Record<string, unknown>);
          expect(result.count).toBe(42);
        });

        it('passes through empty objects', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            metadata: {},
          } as Record<string, unknown>);
          expect(result.metadata).toEqual({});
        });

        it('passes through empty arrays', () => {
          const result = normalizeOcfData({
            object_type: 'TX_STOCK_ISSUANCE',
            id: 'x',
            items: [],
          } as Record<string, unknown>);
          expect(result.items).toEqual([]);
        });
      });
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

    it('has correct legacy event object_type mappings', () => {
      expect(LEGACY_OBJECT_TYPE_MAP).toEqual({
        TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT: 'CE_STAKEHOLDER_RELATIONSHIP',
        TX_STAKEHOLDER_STATUS_CHANGE_EVENT: 'CE_STAKEHOLDER_STATUS',
      });
    });
  });

  describe('vesting terms defaults', () => {
    const makeVestingTerms = (overrides: Record<string, unknown> = {}) => ({
      object_type: 'VESTING_TERMS',
      id: 'vt-001',
      name: 'Standard Vesting',
      description: '4-year vesting with cliff',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'start',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['cliff'],
        },
        {
          id: 'cliff',
          portion: { numerator: '12', denominator: '48', remainder: false },
          trigger: { type: 'VESTING_SCHEDULE_RELATIVE' },
          next_condition_ids: ['monthly'],
        },
        {
          id: 'monthly',
          portion: { numerator: '1', denominator: '48', remainder: false },
          trigger: { type: 'VESTING_SCHEDULE_RELATIVE' },
          next_condition_ids: [],
        },
      ],
      comments: [],
      ...overrides,
    });

    it('strips remainder: false from vesting condition portions', () => {
      const result = normalizeOcfData(makeVestingTerms());
      const conditions = result.vesting_conditions as Array<{ portion?: Record<string, unknown> }>;
      expect(conditions[1].portion).toBeDefined();
      expect('remainder' in conditions[1].portion!).toBe(false);
      expect(conditions[2].portion).toBeDefined();
      expect('remainder' in conditions[2].portion!).toBe(false);
    });

    it('preserves remainder: true', () => {
      const input = makeVestingTerms({
        vesting_conditions: [
          {
            id: 'vc-1',
            portion: { numerator: '1', denominator: '4', remainder: true },
            trigger: { type: 'VESTING_START_DATE' },
            next_condition_ids: [],
          },
        ],
      });
      const result = normalizeOcfData(input);
      const conditions = result.vesting_conditions as Array<{ portion?: Record<string, unknown> }>;
      expect(conditions[0].portion!.remainder).toBe(true);
    });

    it('strips empty comments array', () => {
      const result = normalizeOcfData(makeVestingTerms({ comments: [] }));
      expect('comments' in result).toBe(false);
    });

    it('preserves non-empty comments', () => {
      const result = normalizeOcfData(makeVestingTerms({ comments: ['Board note'] }));
      expect(result.comments).toEqual(['Board note']);
    });

    it('does not affect non-VESTING_TERMS objects', () => {
      const stakeholder = {
        object_type: 'STAKEHOLDER',
        id: 'sh-1',
        comments: [],
      };
      const result = normalizeOcfData(stakeholder);
      expect(result.comments).toEqual([]);
    });
  });
});
