/**
 * Tests for replication helpers for cap table synchronization.
 */

import { OcpErrorCodes } from '../../src/errors/codes';
import { OcpValidationError } from '../../src/errors/OcpValidationError';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { CapTableState } from '../../src/functions/OpenCapTable/capTable/getCapTableState';
import type { OcfEquityCompensationExercise, OcfStockCancellation, OcfStockClassSplit } from '../../src/types/native';
import type { OcfManifest } from '../../src/utils/cantonOcfExtractor';
import {
  buildCantonOcfDataMap,
  CantonOcfDataMap,
  computeReplicationDiff,
  getEntityTypeLabel,
  mapCategorizedTypeToEntityType,
  type SourceReplicationItem,
  TRANSACTION_SUBTYPE_MAP,
} from '../../src/utils/replicationHelpers';
import { requireFirst } from '../../src/utils/requireDefined';
import {
  createTestConvertibleIssuanceData,
  createTestDocumentData,
  createTestEquityCompensationIssuanceData,
  createTestIssuerData,
  createTestStakeholderData,
  createTestStockClassData,
  createTestStockIssuanceData,
  createTestStockLegendTemplateData,
  createTestStockPlanData,
  createTestStockTransferData,
  createTestValuationData,
  createTestVestingStartData,
  createTestVestingTermsData,
  createTestWarrantExerciseData,
} from '../integration/utils';
import { validateOcfObject } from './ocfSchemaValidator';

function createTestStockCancellationData(
  overrides: Partial<Omit<OcfStockCancellation, 'object_type'>> = {}
): OcfStockCancellation {
  return {
    id: 'stock-cancellation-1',
    date: '2024-01-15',
    security_id: 'security-1',
    quantity: '100',
    reason_text: 'Cancellation reason',
    ...overrides,
    object_type: 'TX_STOCK_CANCELLATION',
  };
}

function createTestEquityCompensationExerciseData(
  overrides: Partial<Omit<OcfEquityCompensationExercise, 'object_type'>> = {}
): OcfEquityCompensationExercise {
  return {
    id: 'equity-compensation-exercise-1',
    date: '2024-01-15',
    security_id: 'equity-security-1',
    quantity: '100',
    resulting_security_ids: ['resulting-security-1'],
    ...overrides,
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
  };
}

function createTestStockClassSplitData(
  overrides: Partial<Omit<OcfStockClassSplit, 'object_type'>> = {}
): OcfStockClassSplit {
  return {
    id: 'stock-class-split-1',
    date: '2024-01-15',
    stock_class_id: 'stock-class-1',
    split_ratio: { numerator: '2', denominator: '1' },
    ...overrides,
    object_type: 'TX_STOCK_CLASS_SPLIT',
  };
}

// ============================================================================
// TRANSACTION_SUBTYPE_MAP Tests
// ============================================================================

describe('TRANSACTION_SUBTYPE_MAP', () => {
  it('has correct count of transaction types', () => {
    // 9 stock + 8 equity comp + 6 convertible + 6 warrant + 4 stock class adj + 2 stock plan + 3 vesting + 2 stakeholder
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

  describe('Stakeholder Events', () => {
    const stakeholderTypes: Array<[string, OcfEntityType]> = [
      ['CE_STAKEHOLDER_RELATIONSHIP', 'stakeholderRelationshipChangeEvent'],
      ['CE_STAKEHOLDER_STATUS', 'stakeholderStatusChangeEvent'],
    ];

    it.each(stakeholderTypes)('maps %s to %s', (objectType, entityType) => {
      expect(TRANSACTION_SUBTYPE_MAP[objectType]).toBe(entityType);
    });
  });

  it('does not map non-schema stakeholder event names', () => {
    expect(TRANSACTION_SUBTYPE_MAP['TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT']).toBeUndefined();
    expect(TRANSACTION_SUBTYPE_MAP['TX_STAKEHOLDER_STATUS_CHANGE_EVENT']).toBeUndefined();
  });

  it('does not expose retired PlanSecurity discriminators in the canonical lookup map', () => {
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

    it('does not treat inherited object properties as OBJECT subtypes', () => {
      expect(mapCategorizedTypeToEntityType('OBJECT', 'toString')).toBeNull();
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

    it('maps TRANSACTION/CE_STAKEHOLDER_STATUS to stakeholderStatusChangeEvent', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'CE_STAKEHOLDER_STATUS')).toBe(
        'stakeholderStatusChangeEvent'
      );
    });

    it('returns null for unknown TRANSACTION subtype', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'TX_UNKNOWN')).toBeNull();
    });

    it('does not treat inherited object properties as TRANSACTION subtypes', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', 'toString')).toBeNull();
    });

    it('returns null for TRANSACTION without subtype', () => {
      expect(mapCategorizedTypeToEntityType('TRANSACTION', null)).toBeNull();
    });
  });

  describe('unknown types', () => {
    it('returns null for unknown category type', () => {
      expect(mapCategorizedTypeToEntityType('UNKNOWN', null)).toBeNull();
    });

    it('does not treat inherited object properties as direct types', () => {
      expect(mapCategorizedTypeToEntityType('toString', null)).toBeNull();
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

  const asInvalidManifestValue = <T>(value: object): T => value as unknown as T;

  describe('issuer handling', () => {
    it('adds issuer to the map when present', () => {
      const manifest = createEmptyManifest();
      const issuer = createTestIssuerData({ id: 'issuer-1', legal_name: 'Test Corp' });
      manifest.issuer = issuer;

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('issuer')?.get('issuer-1')).toEqual(issuer);
    });

    it('skips issuer when null', () => {
      const manifest = createEmptyManifest();
      manifest.issuer = null;

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('issuer')).toBeUndefined();
    });

    it('throws when issuer has no id', () => {
      const manifest = createEmptyManifest();
      manifest.issuer = asInvalidManifestValue<OcfManifest['issuer']>({ legal_name: 'Test Corp' });

      expect(() => buildCantonOcfDataMap(manifest)).toThrow("Invalid issuer: missing or invalid 'id' field");
    });
  });

  describe('core objects', () => {
    it('adds stakeholders to the map', () => {
      const manifest = createEmptyManifest();
      const alice = createTestStakeholderData({ id: 'sh-1', name: { legal_name: 'Alice' } });
      const bob = createTestStakeholderData({ id: 'sh-2', name: { legal_name: 'Bob' } });
      manifest.stakeholders = [alice, bob];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stakeholder')?.size).toBe(2);
      expect(result.get('stakeholder')?.get('sh-1')).toEqual(alice);
      expect(result.get('stakeholder')?.get('sh-2')).toEqual(bob);
    });

    it('adds stockClasses to the map', () => {
      const manifest = createEmptyManifest();
      const stockClass = createTestStockClassData({ id: 'sc-1', name: 'Common' });
      manifest.stockClasses = [stockClass];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockClass')?.get('sc-1')).toEqual(stockClass);
    });

    it('adds stockPlans to the map', () => {
      const manifest = createEmptyManifest();
      const stockPlan = createTestStockPlanData({ id: 'sp-1', plan_name: '2024 Plan', stock_class_ids: ['sc-1'] });
      manifest.stockPlans = [stockPlan];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockPlan')?.get('sp-1')).toEqual(stockPlan);
    });

    it('adds vestingTerms to the map', () => {
      const manifest = createEmptyManifest();
      const vestingTerms = createTestVestingTermsData({ id: 'vt-1', name: '4-year cliff' });
      manifest.vestingTerms = [vestingTerms];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('vestingTerms')?.get('vt-1')).toEqual(vestingTerms);
    });

    it('adds valuations to the map', () => {
      const manifest = createEmptyManifest();
      manifest.valuations = [
        createTestValuationData({
          id: 'val-1',
          stock_class_id: 'sc-1',
          price_per_share: { amount: '10.00', currency: 'USD' },
        }),
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('valuation')?.get('val-1')).toBeDefined();
    });

    it('adds documents to the map', () => {
      const manifest = createEmptyManifest();
      const document = createTestDocumentData({ id: 'doc-1', comments: ['Stock Purchase Agreement'] });
      manifest.documents = [document];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('document')?.get('doc-1')).toEqual(document);
    });

    it('adds stockLegendTemplates to the map', () => {
      const manifest = createEmptyManifest();
      const stockLegendTemplate = createTestStockLegendTemplateData({ id: 'slt-1', name: 'Rule 144' });
      manifest.stockLegendTemplates = [stockLegendTemplate];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockLegendTemplate')?.get('slt-1')).toEqual(stockLegendTemplate);
    });

    it('throws when core object has no id', () => {
      const manifest = createEmptyManifest();
      manifest.stakeholders = asInvalidManifestValue<OcfManifest['stakeholders']>([
        { name: { legal_name: 'No ID Stakeholder' } },
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow("Invalid stakeholder: missing or invalid 'id' field");
    });

    it('rejects a core object placed in the wrong manifest category', () => {
      const manifest = createEmptyManifest();
      manifest.stakeholders = asInvalidManifestValue<OcfManifest['stakeholders']>([
        createTestStockClassData({ id: 'stock-class-in-stakeholders' }),
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        'Invalid stakeholder: object_type "STOCK_CLASS" maps to "stockClass", not "stakeholder"'
      );
    });
  });

  describe('transactions', () => {
    it('categorizes stock transactions by object_type', () => {
      const manifest = createEmptyManifest();
      const stockIssuance = createTestStockIssuanceData({
        id: 'tx-1',
        date: '2024-01-01',
        stakeholder_id: 'sh-1',
        stock_class_id: 'sc-1',
      });
      const stockTransfer = createTestStockTransferData({
        id: 'tx-2',
        date: '2024-02-01',
        security_id: 'security-1',
      });
      manifest.transactions = [stockIssuance, stockTransfer];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('stockIssuance')?.get('tx-1')).toEqual(stockIssuance);
      expect(result.get('stockTransfer')?.get('tx-2')).toEqual(stockTransfer);
    });

    it('categorizes equity compensation transactions', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [
        createTestEquityCompensationIssuanceData({ id: 'tx-1', stakeholder_id: 'sh-1' }),
        createTestEquityCompensationExerciseData({ id: 'tx-2' }),
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('equityCompensationIssuance')?.get('tx-1')).toBeDefined();
      expect(result.get('equityCompensationExercise')?.get('tx-2')).toBeDefined();
    });

    it('categorizes all transaction types correctly', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = [
        createTestConvertibleIssuanceData({ id: 'tx-conv', stakeholder_id: 'sh-1' }),
        createTestWarrantExerciseData({
          id: 'tx-war',
          security_id: 'warrant-security-1',
          resulting_security_ids: ['resulting-security-1'],
        }),
        createTestVestingStartData({
          id: 'tx-vest',
          security_id: 'security-1',
          vesting_condition_id: 'vesting-condition-1',
        }),
        createTestStockClassSplitData({ id: 'tx-adj' }),
      ];

      const result = buildCantonOcfDataMap(manifest);

      expect(result.get('convertibleIssuance')?.get('tx-conv')).toBeDefined();
      expect(result.get('warrantExercise')?.get('tx-war')).toBeDefined();
      expect(result.get('vestingStart')?.get('tx-vest')).toBeDefined();
      expect(result.get('stockClassSplit')?.get('tx-adj')).toBeDefined();
    });

    it('throws when transaction has no object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([{ id: 'tx-1', date: '2024-01-01' }]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        "Invalid transaction: missing or invalid 'object_type' field"
      );
    });

    it('throws when transaction has non-string object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([{ id: 'tx-1', object_type: 123 }]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(
        "Invalid transaction: missing or invalid 'object_type' field"
      );
    });

    it('bounds an oversized unsupported object_type diagnostic', () => {
      const manifest = createEmptyManifest();
      const objectType = `TX_${'x'.repeat(20_000)}`;
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { id: 'tx-long-type', object_type: objectType },
      ]);

      try {
        buildCantonOcfDataMap(manifest);
        throw new Error('Expected the oversized object type to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        const validationError = error as OcpValidationError;
        expect(validationError.code).toBe(OcpErrorCodes.UNKNOWN_ENTITY_TYPE);
        expect(validationError.fieldPath).toBe('transaction.object_type');
        expect(validationError.message.length).toBeLessThan(700);
        expect(validationError.message).not.toContain(objectType);
        expect(validationError.receivedValue).not.toBe(objectType);
      }
    });

    it('does not invoke proxy traps while diagnosing an invalid object_type', () => {
      let trapCalls = 0;
      const hostileObjectType = new Proxy(Object.create(null) as object, {
        get() {
          trapCalls += 1;
          throw new Error('proxy get trap must not run');
        },
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error('proxy getPrototypeOf trap must not run');
        },
        ownKeys() {
          trapCalls += 1;
          throw new Error('proxy ownKeys trap must not run');
        },
      });
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { id: 'tx-hostile-type', object_type: hostileObjectType },
      ]);

      try {
        buildCantonOcfDataMap(manifest);
        throw new Error('Expected the hostile object type to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(OcpValidationError);
        expect(error).toMatchObject({
          code: OcpErrorCodes.INVALID_TYPE,
          fieldPath: 'transaction.object_type',
          receivedValue: { containerType: 'proxy' },
        });
        expect((error as Error).message.length).toBeLessThan(700);
      }

      expect(trapCalls).toBe(0);
    });

    it('throws when transaction has unsupported object_type', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { id: 'tx-1', object_type: 'TX_UNKNOWN_TYPE' },
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow('Unsupported transaction object_type: TX_UNKNOWN_TYPE');
    });

    it('rejects a canonical core object discriminator in the transaction category', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        createTestStakeholderData({ id: 'sh-in-transactions' }),
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow('Unsupported transaction object_type: STAKEHOLDER');
    });

    it.each([
      'TX_PLAN_SECURITY_ACCEPTANCE',
      'TX_PLAN_SECURITY_CANCELLATION',
      'TX_PLAN_SECURITY_EXERCISE',
      'TX_PLAN_SECURITY_ISSUANCE',
      'TX_PLAN_SECURITY_RELEASE',
      'TX_PLAN_SECURITY_RETRACTION',
      'TX_PLAN_SECURITY_TRANSFER',
    ])('rejects retired PlanSecurity transaction input %s', (objectType) => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { id: 'legacy-plan-security', object_type: objectType },
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow(`Unsupported transaction object_type: ${objectType}`);
    });

    it('throws when transaction object_type is an inherited object property', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { id: 'tx-1', object_type: 'toString' },
      ]);

      expect(() => buildCantonOcfDataMap(manifest)).toThrow('Unsupported transaction object_type: toString');
    });

    it('throws when transaction has no id', () => {
      const manifest = createEmptyManifest();
      manifest.transactions = asInvalidManifestValue<OcfManifest['transactions']>([
        { object_type: 'TX_STOCK_ISSUANCE' },
      ]);

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
      const stakeholder = createTestStakeholderData({ id: 'sh-1', name: { legal_name: 'Alice' } });
      const stockClass = createTestStockClassData({ id: 'sc-1', name: 'Common' });
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: stakeholder },
        { entityType: 'stockClass', data: stockClass },
      ];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(2);
      expect(diff.creates[0]).toEqual({
        id: 'sh-1',
        entityType: 'stakeholder',
        operation: 'create',
        data: stakeholder,
      });
      expect(diff.edits).toHaveLength(0);
      expect(diff.deletes).toHaveLength(0);
      expect(diff.total).toBe(2);
    });

    it('skips items that already exist in Canton (no cantonOcfData)', () => {
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1' }) },
      ];
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
      const sourceStakeholder = createTestStakeholderData({
        id: 'sh-1',
        name: { legal_name: 'Alice Updated' },
      });
      const cantonStakeholder = createTestStakeholderData({
        id: 'sh-1',
        name: { legal_name: 'Alice Original' },
      });
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: sourceStakeholder }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set('stakeholder', new Map([['sh-1', cantonStakeholder]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(1);
      expect(diff.edits[0]).toEqual({
        id: 'sh-1',
        entityType: 'stakeholder',
        operation: 'edit',
        data: sourceStakeholder,
      });
    });

    it('skips items when data is equal', () => {
      const stakeholder = createTestStakeholderData({ id: 'sh-1', name: { legal_name: 'Alice' } });
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: stakeholder }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set('stakeholder', new Map([['sh-1', stakeholder]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(0);
      expect(diff.total).toBe(0);
    });

    it('handles semantic equality (numeric precision with trailing zeros)', () => {
      const sourceValuation = createTestValuationData({
        id: 'val-1',
        stock_class_id: 'sc-1',
        price_per_share: { amount: '10.00', currency: 'USD' },
      });
      const cantonValuation = createTestValuationData({
        id: 'val-1',
        stock_class_id: 'sc-1',
        price_per_share: { amount: '10', currency: 'USD' },
      });
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'valuation', data: sourceValuation }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('valuation', new Set(['val-1']));

      // Same semantically - ocfDeepEqual normalizes numeric strings (10.00 == 10)
      const cantonOcfData = new CantonOcfDataMap().set('valuation', new Map([['val-1', cantonValuation]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      // ocfDeepEqual considers "10.00" and "10" equal
      expect(diff.edits).toHaveLength(0);
    });

    it('detects reason_text changes for non-deprecated entities', async () => {
      const sourceData = createTestStockCancellationData({
        id: 'tx-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        quantity: '100',
        reason_text: 'Corrected reason',
        comments: [],
      });
      const cantonData = createTestStockCancellationData({
        id: 'tx-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        quantity: '100',
        reason_text: 'Original reason',
        comments: [],
      });
      await validateOcfObject({ ...sourceData });
      await validateOcfObject({ ...cantonData });

      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stockCancellation', data: sourceData }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stockCancellation', new Set(['tx-1']));

      const cantonOcfData = new CantonOcfDataMap().set('stockCancellation', new Map([['tx-1', cantonData]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.edits).toHaveLength(1);
      expect(requireFirst(diff.edits, 'replication edit').id).toBe('tx-1');
    });

    it('treats stakeholder current_relationships with different order as equivalent', async () => {
      const sourceStakeholder = createTestStakeholderData({
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['INVESTOR', 'FOUNDER'],
      });
      const cantonStakeholder = createTestStakeholderData({
        id: 'sh-1',
        name: { legal_name: 'Alice Doe' },
        stakeholder_type: 'INDIVIDUAL',
        current_relationships: ['FOUNDER', 'INVESTOR'],
      });
      await validateOcfObject({ ...sourceStakeholder });
      await validateOcfObject({ ...cantonStakeholder });

      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: sourceStakeholder }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set('stakeholder', new Map([['sh-1', cantonStakeholder]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(0);
      expect(diff.total).toBe(0);
    });

    it('throws when cantonOcfData is incomplete', () => {
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1' }) },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      // cantonOcfData provided but missing the stakeholder type
      const cantonOcfData = new CantonOcfDataMap();

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Inconsistent cantonOcfData: missing OCF data for entityType="stakeholder"'
      );
    });

    it('throws when cantonOcfData is missing specific item', () => {
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1' }) },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      // cantonOcfData has stakeholder type but missing sh-1
      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([['sh-other', createTestStakeholderData({ id: 'sh-other' })]])
      );

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Inconsistent cantonOcfData: missing OCF data for entityType="stakeholder", id="sh-1"'
      );
    });

    it('throws when source item data is null', () => {
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: null }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([['sh-1', createTestStakeholderData({ id: 'sh-1' })]])
      );

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder": expected object, got null'
      );
    });

    it('throws when source item data is undefined', () => {
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: undefined }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([['sh-1', createTestStakeholderData({ id: 'sh-1' })]])
      );

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder": expected object, got undefined'
      );
    });

    it('throws when source item data is an array', () => {
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: [] }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([['sh-1', createTestStakeholderData({ id: 'sh-1' })]])
      );

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder": expected object, got array'
      );
    });

    it('throws when source item data is a primitive', () => {
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: 'string' }];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([['sh-1', createTestStakeholderData({ id: 'sh-1' })]])
      );

      expect(() => computeReplicationDiff(sourceItems, cantonState, { cantonOcfData })).toThrow(
        'Invalid source data for entityType="stakeholder": expected object, got string'
      );
    });

    it('throws when source data.id is missing', () => {
      const sourceItems: SourceReplicationItem[] = [{ entityType: 'stakeholder', data: { name: 'Alice' } }];
      const cantonState = createEmptyCantonState();

      expect(() => computeReplicationDiff(sourceItems, cantonState)).toThrow(
        'Invalid source data for entityType="stakeholder": missing or invalid canonical object id at "data.id"'
      );
    });
  });

  describe('delete detection', () => {
    it('detects items in Canton but not in source as deletes', () => {
      const sourceItems: SourceReplicationItem[] = [];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1', 'sh-2']));

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.deletes).toHaveLength(2);
      expect(diff.deletes).toContainEqual({
        id: 'sh-1',
        entityType: 'stakeholder',
        operation: 'delete',
      });
      expect(diff.deletes).toContainEqual({
        id: 'sh-2',
        entityType: 'stakeholder',
        operation: 'delete',
      });
    });

    it('only deletes items not in source', () => {
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1' }) },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-1', 'sh-2']));

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.deletes).toHaveLength(1);
      expect(requireFirst(diff.deletes, 'replication delete').id).toBe('sh-2');
    });
  });

  describe('duplicate handling', () => {
    it('skips duplicate source items', () => {
      const firstStakeholder = createTestStakeholderData({ id: 'sh-1', comments: ['version 1'] });
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: firstStakeholder },
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1', comments: ['version 2'] }) },
      ];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.creates).toHaveLength(1);
      expect(requireFirst(diff.creates, 'replication create').data).toEqual(firstStakeholder); // First occurrence wins
    });
  });

  describe('equity compensation entity kinds', () => {
    it('uses the canonical equityCompensation type for Canton lookup', () => {
      const equityCompensation = createTestEquityCompensationIssuanceData({
        id: 'eq-1',
        date: '2024-01-01',
        stakeholder_id: 'sh-1',
      });
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'equityCompensationIssuance', data: equityCompensation },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('equityCompensationIssuance', new Set(['eq-1']));

      // Canton has same data - should not trigger edit
      const cantonOcfData = new CantonOcfDataMap().set(
        'equityCompensationIssuance',
        new Map([['eq-1', equityCompensation]])
      );

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      // Should NOT create (exists in Canton under the canonical type)
      expect(diff.creates).toHaveLength(0);
      // Should NOT edit (data is identical)
      expect(diff.edits).toHaveLength(0);
    });

    it('detects edits for canonical equityCompensation items with data changes', () => {
      const sourceEquityCompensation = createTestEquityCompensationIssuanceData({
        id: 'eq-1',
        date: '2024-02-01',
        stakeholder_id: 'sh-1',
      });
      const cantonEquityCompensation = createTestEquityCompensationIssuanceData({
        id: 'eq-1',
        date: '2024-01-01',
        stakeholder_id: 'sh-1',
      });
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'equityCompensationIssuance', data: sourceEquityCompensation }, // Updated date
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('equityCompensationIssuance', new Set(['eq-1']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'equityCompensationIssuance',
        new Map([['eq-1', cantonEquityCompensation]])
      );

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(0);
      expect(diff.edits).toHaveLength(1);
      const edit = requireFirst(diff.edits, 'replication edit');
      expect(edit.id).toBe('eq-1');
      expect(edit.entityType).toBe('equityCompensationIssuance');
    });
  });

  describe('security_id conflict detection', () => {
    it('detects conflict when issuance create has security_id already on Canton', () => {
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'stockIssuance',
          data: createTestStockIssuanceData({
            id: 'tx-new',
            security_id: 'sec-existing',
            stakeholder_id: 'sh-1',
            stock_class_id: 'sc-1',
          }),
        },
      ];
      const cantonState = createEmptyCantonState();
      // Canton already has a different StockIssuance with the same security_id
      cantonState.securityIds.set('stockIssuance', new Set(['sec-existing']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      // Item still appears in creates (the canonical object ID is missing from Canton)
      expect(diff.creates).toHaveLength(1);
      expect(requireFirst(diff.creates, 'replication create').id).toBe('tx-new');
      // But conflict is flagged
      expect(diff.conflicts).toHaveLength(1);
      const conflict = requireFirst(diff.conflicts, 'replication conflict');
      expect(conflict.id).toBe('tx-new');
      expect(conflict.securityId).toBe('sec-existing');
      expect(conflict.entityType).toBe('stockIssuance');
      expect(conflict.message).toContain('security_id="sec-existing"');
      expect(conflict.message).toContain('already exists on Canton');
    });

    it('detects conflict for convertibleIssuance', () => {
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'convertibleIssuance',
          data: createTestConvertibleIssuanceData({
            id: 'tx-conv',
            security_id: 'sec-dup',
            stakeholder_id: 'sh-1',
          }),
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.securityIds.set('convertibleIssuance', new Set(['sec-dup']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      expect(diff.conflicts).toHaveLength(1);
      expect(requireFirst(diff.conflicts, 'replication conflict').entityType).toBe('convertibleIssuance');
    });

    it('detects conflict for equityCompensationIssuance', () => {
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'equityCompensationIssuance',
          data: createTestEquityCompensationIssuanceData({
            id: 'eq-dup',
            security_id: 'sec-dup',
            stakeholder_id: 'sh-1',
          }),
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.securityIds.set('equityCompensationIssuance', new Set(['sec-dup']));

      const diff = computeReplicationDiff(sourceItems, cantonState, {
        securityIds: cantonState.securityIds,
      });

      expect(diff.conflicts).toHaveLength(1);
      const conflict = requireFirst(diff.conflicts, 'replication conflict');
      expect(conflict.entityType).toBe('equityCompensationIssuance');
      expect(conflict.message).toContain('Equity Compensation Issuance');
    });

    it('no conflict when security_id is new', () => {
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'stockIssuance',
          data: createTestStockIssuanceData({
            id: 'tx-new',
            security_id: 'sec-new',
            stakeholder_id: 'sh-1',
            stock_class_id: 'sc-1',
          }),
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
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'stockTransfer',
          data: createTestStockTransferData({ id: 'tx-transfer', security_id: 'sec-existing' }),
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
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'stockIssuance',
          data: createTestStockIssuanceData({
            id: 'tx-new',
            security_id: 'sec-existing',
            stakeholder_id: 'sh-1',
            stock_class_id: 'sc-1',
          }),
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
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: createTestStakeholderData({ id: 'sh-1' }) },
      ];
      const cantonState = createEmptyCantonState();

      const diff = computeReplicationDiff(sourceItems, cantonState);

      expect(diff.conflicts).toEqual([]);
    });
  });

  describe('date normalization in edits (regression: phantom document edits)', () => {
    it('does not emit edit when document has date field in DB but not in Canton', () => {
      // Reproduces: DB stores OCF Document with `date` field, but DAML Document
      // contract has no `date` field. Canton readback omits `date`, causing a
      // persistent diff on every replication run.
      const sourceDocument = {
        ...createTestDocumentData({
          id: 'doc-1',
          md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          uri: 's3://bucket/path',
          comments: ['filename: test.pdf'],
          related_objects: [],
        }),
        date: '2024-08-14',
      };
      const cantonDocument = createTestDocumentData({
        id: 'doc-1',
        md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        uri: 's3://bucket/path',
        comments: ['filename: test.pdf'],
        related_objects: [],
      });
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'document',
          data: sourceDocument,
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('document', new Set(['doc-1']));

      // Canton readback has no `date` field
      const cantonOcfData = new CantonOcfDataMap().set('document', new Map([['doc-1', cantonDocument]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.edits).toHaveLength(0);
      expect(diff.creates).toHaveLength(0);
      expect(diff.deletes).toHaveLength(0);
      expect(diff.total).toBe(0);
    });

    it('does not emit edit when transaction dates differ only by ISO format', () => {
      // DB may store full ISO timestamps while Canton returns date-only strings.
      const sourceStockIssuance = createTestStockIssuanceData({
        id: 'tx-1',
        date: '2024-01-15T00:00:00.000Z',
        security_id: 'sec-1',
        stakeholder_id: 'sh-1',
        stock_class_id: 'sc-1',
        quantity: '1000',
      });
      const cantonStockIssuance = createTestStockIssuanceData({
        id: 'tx-1',
        date: '2024-01-15',
        security_id: 'sec-1',
        stakeholder_id: 'sh-1',
        stock_class_id: 'sc-1',
        quantity: '1000',
      });
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'stockIssuance',
          data: sourceStockIssuance,
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stockIssuance', new Set(['tx-1']));

      const cantonOcfData = new CantonOcfDataMap().set('stockIssuance', new Map([['tx-1', cantonStockIssuance]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.edits).toHaveLength(0);
      expect(diff.total).toBe(0);
    });

    it('still detects real edits on document fields other than date', () => {
      const sourceDocument = {
        ...createTestDocumentData({
          id: 'doc-1',
          md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          uri: 's3://bucket/path',
          comments: [],
          related_objects: [],
        }),
        date: '2024-08-14',
      };
      const cantonDocument = createTestDocumentData({
        id: 'doc-1',
        md5: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        uri: 's3://bucket/path',
        comments: [],
        related_objects: [],
      });
      const sourceItems: SourceReplicationItem[] = [
        {
          entityType: 'document',
          data: sourceDocument,
        },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('document', new Set(['doc-1']));

      const cantonOcfData = new CantonOcfDataMap().set('document', new Map([['doc-1', cantonDocument]]));

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      // md5 actually changed → should detect an edit
      expect(diff.edits).toHaveLength(1);
      expect(requireFirst(diff.edits, 'replication edit').id).toBe('doc-1');
    });
  });

  describe('total calculation', () => {
    it('calculates total correctly', () => {
      const newStakeholder = createTestStakeholderData({ id: 'sh-1', name: { legal_name: 'New' } });
      const updatedStakeholder = createTestStakeholderData({ id: 'sh-2', name: { legal_name: 'Updated' } });
      const sourceItems: SourceReplicationItem[] = [
        { entityType: 'stakeholder', data: newStakeholder },
        { entityType: 'stakeholder', data: updatedStakeholder },
      ];
      const cantonState = createEmptyCantonState();
      cantonState.entities.set('stakeholder', new Set(['sh-2', 'sh-3']));

      const cantonOcfData = new CantonOcfDataMap().set(
        'stakeholder',
        new Map([
          ['sh-2', createTestStakeholderData({ id: 'sh-2', name: { legal_name: 'Original' } })],
          ['sh-3', createTestStakeholderData({ id: 'sh-3', name: { legal_name: 'To Delete' } })],
        ])
      );

      const diff = computeReplicationDiff(sourceItems, cantonState, { cantonOcfData });

      expect(diff.creates).toHaveLength(1); // sh-1
      expect(diff.edits).toHaveLength(1); // sh-2
      expect(diff.deletes).toHaveLength(1); // sh-3
      expect(diff.total).toBe(3);
    });
  });
});
