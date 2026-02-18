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

    it('maps stock plan stock_class_id to stock_class_ids', () => {
      const input: Record<string, unknown> = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_id: 'sc-1',
      };

      const result = normalizeOcfData(input);

      // Adds modern field; keeps deprecated field (ignored by comparison via DEFAULT_DEPRECATED_FIELDS)
      expect(result.stock_class_ids).toEqual(['sc-1']);
      expect(result.stock_class_id).toBe('sc-1');
    });

    it('keeps explicit stock plan stock_class_ids authoritative over legacy field', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1', 'sc-2'],
        stock_class_id: 'legacy-sc',
      };

      const result = normalizeOcfData(input);

      expect(result).toBe(input);
      expect(result.stock_class_ids).toEqual(['sc-1', 'sc-2']);
      expect(result.stock_class_id).toBe('legacy-sc');
    });

    it('returns stock plan unchanged when stock_class_ids already present', () => {
      const input = {
        object_type: 'STOCK_PLAN',
        id: 'sp-1',
        plan_name: 'Stock Option Plan',
        initial_shares_reserved: '1000000',
        stock_class_ids: ['sc-1'],
        stock_class_id: 'sc-1',
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
});
