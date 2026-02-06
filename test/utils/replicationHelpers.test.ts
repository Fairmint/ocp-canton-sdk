/**
 * Tests for replication helpers for cap table synchronization.
 */

import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import type { OcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  buildCantonOcfDataMap,
  type CantonOcfDataMap,
  computeReplicationDiff,
  getEntityTypeLabel,
  mapCategorizedTypeToEntityType,
  TRANSACTION_SUBTYPE_MAP,
} from '../../src/utils/replicationHelpers';

// ============================================================================
// TRANSACTION_SUBTYPE_MAP Tests
// ============================================================================

describe('TRANSACTION_SUBTYPE_MAP', () => {
  it('has correct count of transaction types', () => {
    // 9 stock + 8 equity comp + 6 convertible + 6 warrant + 4 stock class adj + 2 stock plan + 3 vesting + 2 stakeholder = 40
    expect(Object.keys(TRANSACTION_SUBTYPE_MAP)).toHaveLength(40);
  });

  describe('Stock Transactions (9 types)', () => {
    const stockTypes: Array<[string, OcfEntityType]> = [
      ['TX_STOCK_ISSUANCE', 'stockIssuance'],
      ['TX_STOCK_CANCELLATION', 'stockCancellation'],
      ['TX_STOCK_TRANSFER', 'stockTransfer'],
      ['TX_STOCK_ACCEPTANCE', 'stockAcceptance'],
      ['TX_STOCK_CONVERSION', 'stockConversion'],
      ['TX_STOCK_REPURCHASE', 'stockRepurchase'],
      ['TX_STOCK_REISSUANCE', 'stockReissuance'],
      ['TX_STOCK_RETRACTION', 'stockRetraction'],
      ['TX_STOCK_CONSOLIDATION', 'stockConsolidation'],
    ];

    it.each(stockTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Equity Compensation Transactions (8 types)', () => {
    const equityCompTypes: Array<[string, OcfEntityType]> = [
      ['TX_EQUITY_COMPENSATION_ISSUANCE', 'equityCompensationIssuance'],
      ['TX_EQUITY_COMPENSATION_CANCELLATION', 'equityCompensationCancellation'],
      ['TX_EQUITY_COMPENSATION_TRANSFER', 'equityCompensationTransfer'],
      ['TX_EQUITY_COMPENSATION_ACCEPTANCE', 'equityCompensationAcceptance'],
      ['TX_EQUITY_COMPENSATION_EXERCISE', 'equityCompensationExercise'],
      ['TX_EQUITY_COMPENSATION_RELEASE', 'equityCompensationRelease'],
      ['TX_EQUITY_COMPENSATION_REPRICING', 'equityCompensationRepricing'],
      ['TX_EQUITY_COMPENSATION_RETRACTION', 'equityCompensationRetraction'],
    ];

    it.each(equityCompTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Convertible Transactions (6 types)', () => {
    const convertibleTypes: Array<[string, OcfEntityType]> = [
      ['TX_CONVERTIBLE_ISSUANCE', 'convertibleIssuance'],
      ['TX_CONVERTIBLE_CANCELLATION', 'convertibleCancellation'],
      ['TX_CONVERTIBLE_TRANSFER', 'convertibleTransfer'],
      ['TX_CONVERTIBLE_ACCEPTANCE', 'convertibleAcceptance'],
      ['TX_CONVERTIBLE_CONVERSION', 'convertibleConversion'],
      ['TX_CONVERTIBLE_RETRACTION', 'convertibleRetraction'],
    ];

    it.each(convertibleTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Warrant Transactions (6 types)', () => {
    const warrantTypes: Array<[string, OcfEntityType]> = [
      ['TX_WARRANT_ISSUANCE', 'warrantIssuance'],
      ['TX_WARRANT_CANCELLATION', 'warrantCancellation'],
      ['TX_WARRANT_TRANSFER', 'warrantTransfer'],
      ['TX_WARRANT_ACCEPTANCE', 'warrantAcceptance'],
      ['TX_WARRANT_EXERCISE', 'warrantExercise'],
      ['TX_WARRANT_RETRACTION', 'warrantRetraction'],
    ];

    it.each(warrantTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Stock Class Adjustments (4 types)', () => {
    const adjustmentTypes: Array<[string, OcfEntityType]> = [
      ['TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT', 'stockClassAuthorizedSharesAdjustment'],
      ['TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT', 'stockClassConversionRatioAdjustment'],
      ['TX_STOCK_CLASS_SPLIT', 'stockClassSplit'],
      ['TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT', 'issuerAuthorizedSharesAdjustment'],
    ];

    it.each(adjustmentTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Stock Plan Events (2 types)', () => {
    const stockPlanTypes: Array<[string, OcfEntityType]> = [
      ['TX_STOCK_PLAN_POOL_ADJUSTMENT', 'stockPlanPoolAdjustment'],
      ['TX_STOCK_PLAN_RETURN_TO_POOL', 'stockPlanReturnToPool'],
    ];

    it.each(stockPlanTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Vesting Events (3 types)', () => {
    const vestingTypes: Array<[string, OcfEntityType]> = [
      ['TX_VESTING_ACCELERATION', 'vestingAcceleration'],
      ['TX_VESTING_EVENT', 'vestingEvent'],
      ['TX_VESTING_START', 'vestingStart'],
    ];

    it.each(vestingTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  describe('Stakeholder Events (2 types)', () => {
    const stakeholderTypes: Array<[string, OcfEntityType]> = [
      ['TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT', 'stakeholderRelationshipChangeEvent'],
      ['TX_STAKEHOLDER_STATUS_CHANGE_EVENT', 'stakeholderStatusChangeEvent'],
    ];

    it.each(stakeholderTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  it('does not include deprecated Plan Security types', () => {
    // Plan Security types were removed after confirming no data exists in dev/prod
    expect(TRANSACTION_SUBTYPE_MAP['TX_PLAN_SECURITY_ISSUANCE']).toBeUndefined();
    expect(TRANSACTION_SUBTYPE_MAP['TX_PLAN_SECURITY_EXERCISE']).toBeUndefined();
    expect(TRANSACTION_SUBTYPE_MAP['TX_PLAN_SECURITY_CANCELLATION']).toBeUndefined();
  });
});

// ============================================================================
// mapCategorizedTypeToEntityType Tests
// ============================================================================

describe('mapCategorizedTypeToEntityType', () => {
  describe('direct type mappings', () => {
    it('maps STAKEHOLDER to stakeholder', () => {
      expect(mapCategorizedTypeToEntityType('STAKEHOLDER', null)).toBe('stakeholder');
    });

    it('maps STOCK_CLASS to stockClass', () => {
      expect(mapCategorizedTypeToEntityType('STOCK_CLASS', null)).toBe('stockClass');
    });

    it('maps STOCK_PLAN to stockPlan', () => {
      expect(mapCategorizedTypeToEntityType('STOCK_PLAN', null)).toBe('stockPlan');
    });

    it('maps DOCUMENT directly (some DBs store this way)', () => {
      expect(mapCategorizedTypeToEntityType('DOCUMENT', null)).toBe('document');
    });

    it('maps VESTING_TERMS directly', () => {
      expect(mapCategorizedTypeToEntityType('VESTING_TERMS', null)).toBe('vestingTerms');
    });

    it('maps VALUATION directly', () => {
      expect(mapCategorizedTypeToEntityType('VALUATION', null)).toBe('valuation');
    });

    it('maps STOCK_LEGEND_TEMPLATE directly', () => {
      expect(mapCategorizedTypeToEntityType('STOCK_LEGEND_TEMPLATE', null)).toBe('stockLegendTemplate');
    });
  });

  describe('OBJECT category subtypes', () => {
    it('maps OBJECT/DOCUMENT to document', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'DOCUMENT')).toBe('document');
    });

    it('maps OBJECT/VESTING_TERMS to vestingTerms', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'VESTING_TERMS')).toBe('vestingTerms');
    });

    it('maps OBJECT/VALUATION to valuation', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'VALUATION')).toBe('valuation');
    });

    it('maps OBJECT/STOCK_LEGEND_TEMPLATE to stockLegendTemplate', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'STOCK_LEGEND_TEMPLATE')).toBe('stockLegendTemplate');
    });

    it('returns null for unknown OBJECT subtype', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'UNKNOWN')).toBeNull();
    });

    it('returns null for OBJECT without subtype', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', null)).toBeNull();
    });
  });

  describe('TRANSACTION category subtypes', () => {
    it('maps TRANSACTION/TX_STOCK_ISSUANCE to stockIssuance', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'TX_STOCK_ISSUANCE')).toBe('stockIssuance');
    });

    it('maps TRANSACTION/TX_EQUITY_COMPENSATION_EXERCISE to equityCompensationExercise', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'TX_EQUITY_COMPENSATION_EXERCISE')).toBe(
        'equityCompensationExercise'
      );
    });

    it('maps TRANSACTION/TX_CONVERTIBLE_ISSUANCE to convertibleIssuance', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'TX_CONVERTIBLE_ISSUANCE')).toBe('convertibleIssuance');
    });

    it('returns null for unknown TRANSACTION subtype', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'TX_UNKNOWN')).toBeNull();
    });

    it('returns null for TRANSACTION without subtype', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', null)).toBeNull();
    });
  });

  describe('unknown types', () => {
    it('returns null for unknown category type', () => {
      expect(mapCategorizedTypeToEntityType('UNKNOWN', null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(mapCategorizedTypeToEntityType('', null)).toBeNull();
    });
  });
});

// ============================================================================
// getEntityTypeLabel Tests
// ============================================================================

describe('getEntityTypeLabel', () => {
  describe('singular labels (count = 1)', () => {
    it('returns singular for stakeholder', () => {
      expect(getEntityTypeLabel('stakeholder', 1)).toBe('1 Stakeholder');
    });

    it('returns singular for stockClass', () => {
      expect(getEntityTypeLabel('stockClass', 1)).toBe('1 Stock Class');
    });

    it('returns singular for stockIssuance', () => {
      expect(getEntityTypeLabel('stockIssuance', 1)).toBe('1 Stock Issuance');
    });
  });

  describe('plural labels (count != 1)', () => {
    it('returns plural for zero', () => {
      expect(getEntityTypeLabel('stakeholder', 0)).toBe('0 Stakeholders');
    });

    it('returns plural for multiple', () => {
      expect(getEntityTypeLabel('stockClass', 3)).toBe('3 Stock Classes');
    });

    it('returns plural for large numbers', () => {
      expect(getEntityTypeLabel('stockIssuance', 100)).toBe('100 Stock Issuances');
    });
  });

  describe('special plural forms', () => {
    it('handles vestingTerms (same singular/plural)', () => {
      expect(getEntityTypeLabel('vestingTerms', 1)).toBe('1 Vesting Terms');
      expect(getEntityTypeLabel('vestingTerms', 3)).toBe('3 Vesting Terms');
    });

    it('handles stockPlanReturnToPool plural', () => {
      expect(getEntityTypeLabel('stockPlanReturnToPool', 1)).toBe('1 Stock Plan Return to Pool');
      expect(getEntityTypeLabel('stockPlanReturnToPool', 3)).toBe('3 Stock Plan Returns to Pool');
    });
  });
});

// ============================================================================
// buildCantonOcfDataMap Tests
// ============================================================================

describe('buildCantonOcfDataMap', () => {
  const createEmptyManifest = (): OcfManifest => ({
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    stockLegendTemplates: [],
  });

  describe('issuer handling', () => {
    it('adds issuer to the map when present', () => {
      const manifest = createEmptyManifest();
      manifest.issuer = { id: 'issuer-1', legal_name: 'Test Corp' };

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('issuer')?.get('issuer-1')).toEqual({
        id: 'issuer-1',
        legal_name: 'Test Corp',
      });
    });

    it('skips issuer when null', () => {
      const manifest = createEmptyManifest();
      manifest.issuer = null;

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('issuer')).toBeUndefined();
    });

    it('throws when issuer has no id', () => {
      const manifest = createEmptyManifest();
      manifest.issuer = { legal_name: 'Test Corp' } as Record<string, unknown>;

      expect(() => buildCantonOcfDataMap(manifest)).toThrow("Invalid issuer: missing or invalid 'id' field");
    });
  });

  describe('core objects', () => {
    it('adds stakeholders to the map', () => {
      const manifest = createEmptyManifest();
      manifest.stakeholders = [
        { id: 'sh-1', name: 'Alice' },
        { id: 'sh-2', name: 'Bob' },
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stakeholder')?.size).toBe(2);
      expect(result.get('stakeholder')?.get('sh-1')).toEqual({ id: 'sh-1', name: 'Alice' });
      expect(result.get('stakeholder')?.get('sh-2')).toEqual({ id: 'sh-2', name: 'Bob' });
    });

    it('adds stockClasses to the map', () => {
      const manifest = createEmptyManifest();
      manifest.stockClasses = [{ id: 'sc-1', name: 'Common' }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockClass')?.get('sc-1')).toEqual({ id: 'sc-1', name: 'Common' });
    });

    it('adds stockPlans to the map', () => {
      const manifest = createEmptyManifest();
      manifest.stockPlans = [{ id: 'sp-1', plan_name: '2024 Plan' }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockPlan')?.get('sp-1')).toEqual({ id: 'sp-1', plan_name: '2024 Plan' });
    });

    it('adds vestingTerms to the map', () => {
      const manifest = createEmptyManifest();
      manifest.vestingTerms = [{ id: 'vt-1', name: '4-year cliff' }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('vestingTerms')?.get('vt-1')).toEqual({ id: 'vt-1', name: '4-year cliff' });
    });

    it('adds valuations to the map', () => {
      const manifest = createEmptyManifest();
      manifest.valuations = [{ id: 'val-1', price_per_share: { amount: '10.00', currency: 'USD' } }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('valuation')?.get('val-1')).toBeDefined();
    });

    it('adds documents to the map', () => {
      const manifest = createEmptyManifest();
      manifest.documents = [{ id: 'doc-1', name: 'Stock Purchase Agreement' }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('document')?.get('doc-1')).toEqual({ id: 'doc-1', name: 'Stock Purchase Agreement' });
    });

    it('adds stockLegendTemplates to the map', () => {
      const manifest = createEmptyManifest();
      manifest.stockLegendTemplates = [{ id: 'slt-1', name: 'Rule 144' }];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockLegendTemplate')?.get('slt-1')).toEqual({ id: 'slt-1', name: 'Rule 144' });
    });

    it('throws when core object has no id', () => {
      const manifest = createEmptyManifest();
      manifest.stakeholders = [{ name: 'No ID Stakeholder' } as Record<string, unknown>];

      expect(() => buildCantonOcfDataMap(manifest)).toThrow("Invalid stakeholder: missing or invalid 'id' field");
    });
  });

  describe('transactions', () => {
    it('categorizes stock transactions by object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [
        { id: 'tx-1', object_type: 'TX_STOCK_ISSUANCE', date: '2024-01-01' },
        { id: 'tx-2', object_type: 'TX_STOCK_TRANSFER', date: '2024-02-01' },
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockIssuance')?.get('tx-1')).toEqual({
        id: 'tx-1',
        object_type: 'TX_STOCK_ISSUANCE',
        date: '2024-01-01',
      });
      expect(result.get('stockTransfer')?.get('tx-2')).toEqual({
        id: 'tx-2',
        object_type: 'TX_STOCK_TRANSFER',
        date: '2024-02-01',
      });
    });

    it('categorizes equity compensation transactions', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [
        { id: 'tx-1', object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' },
        { id: 'tx-2', object_type: 'TX_EQUITY_COMPENSATION_EXERCISE' },
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('equityCompensationIssuance')?.get('tx-1')).toBeDefined();
      expect(result.get('equityCompensationExercise')?.get('tx-2')).toBeDefined();
    });

    it('categorizes all transaction types correctly', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [
        { id: 'tx-conv', object_type: 'TX_CONVERTIBLE_ISSUANCE' },
        { id: 'tx-war', object_type: 'TX_WARRANT_EXERCISE' },
        { id: 'tx-vest', object_type: 'TX_VESTING_START' },
        { id: 'tx-adj', object_type: 'TX_STOCK_CLASS_SPLIT' },
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('convertibleIssuance')?.get('tx-conv')).toBeDefined();
      expect(result.get('warrantExercise')?.get('tx-war')).toBeDefined();
      expect(result.get('vestingStart')?.get('tx-vest')).toBeDefined();
      expect(result.get('stockClassSplit')?.get('tx-adj')).toBeDefined();
    });

    it('throws when transaction has no object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [{ id: 'tx-1', date: '2024-01-01' }];

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        "Invalid transaction: missing or invalid 'object_type' field"
      );
    });

    it('throws when transaction has non-string object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [{ id: 'tx-1', object_type: 123 }];

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        "Invalid transaction: missing or invalid 'object_type' field"
      );
    });

    it('throws when transaction has unsupported object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [{ id: 'tx-1', object_type: 'TX_UNKNOWN_TYPE' }];

      expect(() => buildCantonOcfDataMap(manifest)).toThrow('Unsupported transaction object_type: TX_UNKNOWN_TYPE');
    });

    it('throws when transaction has no id', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [{ object_type: 'TX_STOCK_ISSUANCE' }];

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        "Invalid transaction (TX_STOCK_ISSUANCE): missing or invalid 'id' field"
      );
    });
  });

  describe('empty manifest', () => {
    it('returns empty map for empty manifest', () => {
      const manifest = createEmptyManifest();

      const result = buildCantonOcfDataMap(manifest);

      expect(result.size).toBe(0);
    });
  });
});

// ============================================================================
// computeReplicationDiff Tests
// ============================================================================

describe('computeReplicationDiff', () => {
  const createEmptyCantonState = (): CapTableState => ({
    capTableContractId: 'captable::test',
    issuerContractId: 'issuer::test',
    entities: new Map(),
    contractIds: new Map(),
    securityIds: new Map(),
  });

  describe('create detection', () => {
    it('detects items in source but not in Canton as creates', () => {
      const sourceItems = [
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', name: 'Alice' } },
        { ocfId: 'sc-1', entityType: 'stockClass' as OcfEntityType, data: { id: 'sc-1', name: 'Common' } },
      ];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(2);
      expect(diff.creates[0]).toEqual({
        ocfId: 'sh-1',
        entityType: 'stakeholder',
        operation: 'create',
        data: { id: 'sh-1', name: 'Alice' },
      });
      expect(diff.edits).toHaveLength(0);
      expect(diff.deletes).toHaveLength(0);
      expect(diff.total).toBe(2);
    });

    it('skips items that already exist in Canton (no cantonOcfData)', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1' } }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(0);
      expect(diff.total).toBe(0);
    });
  });

  describe('edit detection with cantonOcfData', () => {
    it('detects edits when data differs', () => {
      const sourceItems = [
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', name: 'Alice Updated' } },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([
        ['stakeholder', new Map([['sh-1', { id: 'sh-1', name: 'Alice Original' }]])],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(1);
      expect(diff.edits[0]).toEqual({
        ocfId: 'sh-1',
        entityType: 'stakeholder',
        operation: 'edit',
        data: { id: 'sh-1', name: 'Alice Updated' },
      });
    });

    it('skips items when data is equal', () => {
      const sourceItems = [
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', name: 'Alice' } },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([
        ['stakeholder', new Map([['sh-1', { id: 'sh-1', name: 'Alice' }]])],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(0);
      expect(diff.total).toBe(0);
    });

    it('handles semantic equality (numeric precision with trailing zeros)', () => {
      const sourceItems = [
        {
          ocfId: 'val-1',
          entityType: 'valuation' as OcfEntityType,
          data: { id: 'val-1', price: '10.00' },
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('valuation', new Set(['val-1']));

      // Same semantically - ocfDeepEqual normalizes numeric strings (10.00 == 10)
      const cantonOcfData: CantonOcfDataMap = new Map([
        ['valuation', new Map([['val-1', { id: 'val-1', price: '10' }]])],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      // ocfDeepEqual considers "10.00" and "10" equal
      expect(diff.edits).toHaveLength(0);
    });

    it('throws when cantonOcfData is incomplete', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1' } }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      // cantonOcfData provided but missing the stakeholder type
      const cantonOcfData: CantonOcfDataMap = new Map();

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Inconsistent cantonOcfData: missing OCF data for entityType="stakeholder"'
      );
    });

    it('throws when cantonOcfData is missing specific item', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1' } }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      // cantonOcfData has stakeholder type but missing sh-1
      const cantonOcfData: CantonOcfDataMap = new Map([['stakeholder', new Map([['sh-other', { id: 'sh-other' }]])]]);

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Inconsistent cantonOcfData: missing OCF data for entityType="stakeholder", ocfId="sh-1"'
      );
    });

    it('throws when source item data is null', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: null as unknown }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([['stakeholder', new Map([['sh-1', { id: 'sh-1' }]])]]);

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder", ocfId="sh-1": expected object, got null'
      );
    });

    it('throws when source item data is undefined', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: undefined as unknown }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([['stakeholder', new Map([['sh-1', { id: 'sh-1' }]])]]);

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder", ocfId="sh-1": expected object, got undefined'
      );
    });

    it('throws when source item data is an array', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: [] as unknown }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([['stakeholder', new Map([['sh-1', { id: 'sh-1' }]])]]);

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder", ocfId="sh-1": expected object, got array'
      );
    });

    it('throws when source item data is a primitive', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: 'string' as unknown }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([['stakeholder', new Map([['sh-1', { id: 'sh-1' }]])]]);

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder", ocfId="sh-1": expected object, got string'
      );
    });
  });

  describe('delete detection', () => {
    it('detects items in Canton but not in source as deletes', () => {
      const sourceItems: Array<{ ocfId: string; entityType: OcfEntityType; data: unknown }> = [];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1', 'sh-2']));

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.deletes).toHaveLength(2);
      expect(diff.deletes).toContainEqual({
        ocfId: 'sh-1',
        entityType: 'stakeholder',
        operation: 'delete',
      });
      expect(diff.deletes).toContainEqual({
        ocfId: 'sh-2',
        entityType: 'stakeholder',
        operation: 'delete',
      });
    });

    it('only deletes items not in source', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1' } }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1', 'sh-2']));

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.deletes).toHaveLength(1);
      expect(diff.deletes[0].ocfId).toBe('sh-2');
    });
  });

  describe('duplicate handling', () => {
    it('skips duplicate source items', () => {
      const sourceItems = [
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', version: 1 } },
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', version: 2 } },
      ];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(1);
      expect(diff.creates[0].data).toEqual({ id: 'sh-1', version: 1 }); // First occurrence wins
    });
  });

  describe('planSecurity normalization', () => {
    it('normalizes planSecurity types to equityCompensation for Canton lookup', () => {
      const sourceItems = [
        {
          ocfId: 'ps-1',
          entityType: 'planSecurityIssuance' as OcfEntityType,
          data: { id: 'ps-1', date: '2024-01-01' },
        },
      ];
      const cantonState = createEmptyCantonState();
      // Canton stores under equityCompensation (normalized name)
      cantonState.entities.set('equityCompensationIssuance', new Set(['ps-1']));

      // Canton has same data - should not trigger edit
      const cantonOcfData: CantonOcfDataMap = new Map([
        ['equityCompensationIssuance', new Map([['ps-1', { id: 'ps-1', date: '2024-01-01' }]])],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      // Should NOT create (exists in Canton under normalized type)
      expect(diff.creates).toHaveLength(0);
      // Should NOT edit (data is identical)
      expect(diff.edits).toHaveLength(0);
    });

    it('detects edits for planSecurity items with data changes', () => {
      const sourceItems = [
        {
          ocfId: 'ps-1',
          entityType: 'planSecurityIssuance' as OcfEntityType,
          data: { id: 'ps-1', date: '2024-02-01' }, // Updated date
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('equityCompensationIssuance', new Set(['ps-1']));

      const cantonOcfData: CantonOcfDataMap = new Map([
        ['equityCompensationIssuance', new Map([['ps-1', { id: 'ps-1', date: '2024-01-01' }]])],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(1);
      expect(diff.edits[0].ocfId).toBe('ps-1');
      expect(diff.edits[0].entityType).toBe('planSecurityIssuance'); // Original type preserved
    });
  });

  describe('security_id conflict detection', () => {
    it('detects conflict when issuance create has security_id already on Canton', () => {
      const sourceItems = [
        {
          ocfId: 'tx-new',
          entityType: 'stockIssuance' as OcfEntityType,
          data: { id: 'tx-new', security_id: 'sec-existing', stakeholder_id: 'sh-1' },
        },
      ];
      const cantonState = createEmptyCantonState();
      // Canton already has a different StockIssuance with the same security_id
      cantonState.securityIds.set('stockIssuance', new Set(['sec-existing']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      // Item still appears in creates (the ocfId IS missing from Canton)
      expect(diff.creates).toHaveLength(1);
      expect(diff.creates[0].ocfId).toBe('tx-new');
      // But conflict is flagged
      expect(diff.conflicts).toHaveLength(1);
      expect(diff.conflicts[0].ocfId).toBe('tx-new');
      expect(diff.conflicts[0].securityId).toBe('sec-existing');
      expect(diff.conflicts[0].entityType).toBe('stockIssuance');
      expect(diff.conflicts[0].message).toContain('security_id="sec-existing"');
      expect(diff.conflicts[0].message).toContain('already exists on Canton');
    });

    it('detects conflict for convertibleIssuance', () => {
      const sourceItems = [
        {
          ocfId: 'tx-conv',
          entityType: 'convertibleIssuance' as OcfEntityType,
          data: { id: 'tx-conv', security_id: 'sec-dup' },
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.securityIds.set('convertibleIssuance', new Set(['sec-dup']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      expect(diff.conflicts).toHaveLength(1);
      expect(diff.conflicts[0].entityType).toBe('convertibleIssuance');
    });

    it('no conflict when security_id is new', () => {
      const sourceItems = [
        {
          ocfId: 'tx-new',
          entityType: 'stockIssuance' as OcfEntityType,
          data: { id: 'tx-new', security_id: 'sec-new' },
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.securityIds.set('stockIssuance', new Set(['sec-other']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      expect(diff.creates).toHaveLength(1);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('no conflict check for non-issuance types', () => {
      const sourceItems = [
        {
          ocfId: 'tx-transfer',
          entityType: 'stockTransfer' as OcfEntityType,
          data: { id: 'tx-transfer', security_id: 'sec-existing' },
        },
      ];
      const cantonState = createEmptyCantonState();
      // Even if securityIds has this value, transfers don't enforce uniqueness
      cantonState.securityIds.set('stockIssuance', new Set(['sec-existing']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      expect(diff.creates).toHaveLength(1);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('no conflict check when securityIds option not provided', () => {
      const sourceItems = [
        {
          ocfId: 'tx-new',
          entityType: 'stockIssuance' as OcfEntityType,
          data: { id: 'tx-new', security_id: 'sec-existing' },
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.securityIds.set('stockIssuance', new Set(['sec-existing']));

      // No securityIds in options -> no conflict detection
      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(1);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('returns empty conflicts array when no conflicts exist', () => {
      const sourceItems = [{ ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1' } }];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.conflicts).toEqual([]);
    });
  });

  describe('total calculation', () => {
    it('calculates total correctly', () => {
      const sourceItems = [
        { ocfId: 'sh-1', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-1', name: 'New' } },
        { ocfId: 'sh-2', entityType: 'stakeholder' as OcfEntityType, data: { id: 'sh-2', name: 'Updated' } },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-2', 'sh-3']));

      const cantonOcfData: CantonOcfDataMap = new Map([
        [
          'stakeholder',
          new Map([
            ['sh-2', { id: 'sh-2', name: 'Original' }],
            ['sh-3', { id: 'sh-3', name: 'To Delete' }],
          ]),
        ],
      ]);

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(1); // sh-1
      expect(diff.edits).toHaveLength(1); // sh-2
      expect(diff.deletes).toHaveLength(1); // sh-3
      expect(diff.total).toBe(3);
    });
  });
});
