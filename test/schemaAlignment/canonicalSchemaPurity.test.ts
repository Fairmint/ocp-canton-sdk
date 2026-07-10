import { OcpValidationError } from '../../src/errors';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlEquityCompensationReleaseToNative } from '../../src/functions/OpenCapTable/equityCompensationRelease/damlToOcf';
import { damlEquityCompensationRepricingToNative } from '../../src/functions/OpenCapTable/equityCompensationRepricing/damlToOcf';
import { damlStakeholderDataToNative } from '../../src/functions/OpenCapTable/stakeholder/getStakeholderAsOcf';
import { damlStakeholderStatusChangeEventToNative } from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/damlToOcf';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { damlStockConsolidationToNative } from '../../src/functions/OpenCapTable/stockConsolidation/damlToStockConsolidation';
import { damlStockConversionToNative } from '../../src/functions/OpenCapTable/stockConversion/damlToOcf';
import { damlWarrantExerciseToNative } from '../../src/functions/OpenCapTable/warrantExercise/damlToOcf';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { parseOcfEntityInput, parseOcfObject } from '../../src/utils/ocfZodSchemas';

const canonicalCases = [
  {
    entityType: 'stakeholder',
    canonical: {
      object_type: 'STAKEHOLDER',
      id: 'stakeholder-1',
      name: { legal_name: 'Canonical Stakeholder' },
      stakeholder_type: 'INDIVIDUAL',
      current_relationships: ['INVESTOR'],
    },
    forbiddenFields: [['current_relationship', 'INVESTOR']],
  },
  {
    entityType: 'stockConversion',
    canonical: {
      object_type: 'TX_STOCK_CONVERSION',
      id: 'conversion-1',
      date: '2026-01-01',
      security_id: 'security-1',
      quantity_converted: '100',
      resulting_security_ids: ['security-2'],
    },
    forbiddenFields: [['quantity', '100']],
  },
  {
    entityType: 'equityCompensationRelease',
    canonical: {
      object_type: 'TX_EQUITY_COMPENSATION_RELEASE',
      id: 'release-1',
      date: '2026-01-01',
      security_id: 'security-1',
      quantity: '100',
      release_price: { amount: '1', currency: 'USD' },
      settlement_date: '2026-01-02',
      resulting_security_ids: ['security-2'],
    },
    forbiddenFields: [['balance_security_id', 'security-balance']],
  },
  {
    entityType: 'stockClassSplit',
    canonical: {
      object_type: 'TX_STOCK_CLASS_SPLIT',
      id: 'split-1',
      date: '2026-01-01',
      stock_class_id: 'class-1',
      split_ratio: { numerator: '2', denominator: '1' },
    },
    forbiddenFields: [
      ['split_ratio_numerator', '2'],
      ['split_ratio_denominator', '1'],
      ['board_approval_date', '2025-12-01'],
      ['stockholder_approval_date', '2025-12-15'],
    ],
  },
  {
    entityType: 'stockClassConversionRatioAdjustment',
    canonical: {
      object_type: 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      id: 'ratio-adjustment-1',
      date: '2026-01-01',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        conversion_price: { amount: '1', currency: 'USD' },
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'NORMAL',
      },
    },
    forbiddenFields: [
      ['board_approval_date', '2025-12-01'],
      ['stockholder_approval_date', '2025-12-15'],
    ],
  },
  {
    entityType: 'stockConsolidation',
    canonical: {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'consolidation-1',
      date: '2026-01-01',
      security_ids: ['security-1', 'security-2'],
      resulting_security_id: 'security-3',
    },
    forbiddenFields: [['resulting_security_ids', ['security-3']]],
  },
  {
    entityType: 'equityCompensationRepricing',
    canonical: {
      object_type: 'TX_EQUITY_COMPENSATION_REPRICING',
      id: 'repricing-1',
      date: '2026-01-01',
      security_id: 'security-1',
      new_exercise_price: { amount: '1', currency: 'USD' },
    },
    forbiddenFields: [['resulting_security_ids', ['security-2']]],
  },
  {
    entityType: 'stakeholderStatusChangeEvent',
    canonical: {
      object_type: 'CE_STAKEHOLDER_STATUS',
      id: 'status-1',
      date: '2026-01-01',
      stakeholder_id: 'stakeholder-1',
      new_status: 'ACTIVE',
      comments: ['Status changed'],
    },
    forbiddenFields: [['reason_text', 'Status changed']],
  },
  {
    entityType: 'warrantIssuance',
    canonical: {
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-01-01',
      security_id: 'warrant-1',
      custom_id: 'W-1',
      stakeholder_id: 'stakeholder-1',
      security_law_exemptions: [],
      quantity: '100',
      quantity_source: 'UNSPECIFIED',
      purchase_price: { amount: '1', currency: 'USD' },
      exercise_triggers: [],
    },
    forbiddenFields: [
      ['ratio_numerator', '1'],
      ['ratio_denominator', '1'],
      ['percent_of_outstanding', '10'],
      ['conversion_triggers', []],
    ],
  },
  {
    entityType: 'warrantExercise',
    canonical: {
      object_type: 'TX_WARRANT_EXERCISE',
      id: 'warrant-exercise-1',
      date: '2026-01-01',
      security_id: 'warrant-1',
      trigger_id: 'trigger-1',
      resulting_security_ids: ['security-1'],
    },
    forbiddenFields: [
      ['quantity', '100'],
      ['balance_security_id', 'warrant-balance'],
    ],
  },
] as const;

const convertUnknownToDaml = convertToDaml as unknown as (
  entityType: string,
  input: Record<string, unknown>
) => Record<string, unknown>;

describe('canonical public DTO field purity', () => {
  it.each(canonicalCases)('accepts canonical $entityType inputs', ({ entityType, canonical }) => {
    expect(parseOcfObject(canonical)).toEqual(canonical);
    expect(parseOcfEntityInput(entityType, canonical)).toEqual(canonical);
    expect(() => convertUnknownToDaml(entityType, canonical)).not.toThrow();
  });

  for (const { entityType, canonical, forbiddenFields } of canonicalCases) {
    for (const [field, value] of forbiddenFields) {
      it(`rejects ${canonical.object_type}.${field} at parser and writer boundaries`, () => {
        const input = { ...canonical, [field]: value };

        const parseRaw = () => parseOcfObject(input);
        expect(parseRaw).toThrow(OcpValidationError);
        expect(parseRaw).toThrow(field);

        const parseTyped = () => parseOcfEntityInput(entityType, input);
        expect(parseTyped).toThrow(OcpValidationError);
        expect(parseTyped).toThrow(field);

        const write = () => convertUnknownToDaml(entityType, input);
        expect(write).toThrow(OcpValidationError);
        expect(write).toThrow(field);
      });
    }
  }

  it('rejects forbidden own-properties even when their value is undefined', () => {
    expect(() =>
      parseOcfObject({
        ...canonicalCases[0].canonical,
        current_relationship: undefined,
      })
    ).toThrow('current_relationship');
  });
});

describe('DAML readers emit canonical public DTO fields only', () => {
  it('emits current_relationships for stakeholders', () => {
    const result = damlStakeholderDataToNative({
      id: 'stakeholder-1',
      name: { legal_name: 'Canonical Stakeholder', first_name: null, last_name: null },
      stakeholder_type: 'OcfStakeholderTypeIndividual',
      addresses: [],
      comments: [],
      current_relationships: ['OcfRelInvestor'],
      tax_ids: [],
      contact_info: null,
      current_status: null,
      issuer_assigned_id: null,
      primary_contact: null,
    });

    expect(result.current_relationships).toEqual(['INVESTOR']);
    expect(result).not.toHaveProperty('current_relationship');
  });

  it('emits quantity_converted for stock conversions', () => {
    const result = damlStockConversionToNative({
      id: 'conversion-1',
      date: '2026-01-01T00:00:00.000Z',
      security_id: 'security-1',
      quantity_converted: '100.0000000000',
      resulting_security_ids: ['security-2'],
      balance_security_id: null,
      comments: [],
    });

    expect(result.quantity_converted).toBe('100');
    expect(result).not.toHaveProperty('quantity');
  });

  it('does not emit balance_security_id for equity compensation releases', () => {
    const result = damlEquityCompensationReleaseToNative({
      id: 'release-1',
      date: '2026-01-01T00:00:00.000Z',
      security_id: 'security-1',
      quantity: '100.0000000000',
      release_price: { amount: '1.0000000000', currency: 'USD' },
      resulting_security_ids: ['security-2'],
      settlement_date: '2026-01-02T00:00:00.000Z',
      consideration_text: null,
      comments: [],
    });

    expect(result).not.toHaveProperty('balance_security_id');
  });

  it('emits only the nested ratio for stock class splits', () => {
    const result = damlStockClassSplitToNative({
      id: 'split-1',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'class-1',
      split_ratio: { numerator: '2.0000000000', denominator: '1.0000000000' },
      comments: [],
    });

    expect(result.split_ratio).toEqual({ numerator: '2', denominator: '1' });
    expect(result).not.toHaveProperty('split_ratio_numerator');
    expect(result).not.toHaveProperty('split_ratio_denominator');
    expect(result).not.toHaveProperty('board_approval_date');
    expect(result).not.toHaveProperty('stockholder_approval_date');
  });

  it('does not emit approval dates for conversion ratio adjustments', () => {
    const result = damlStockClassConversionRatioAdjustmentToNative({
      id: 'ratio-adjustment-1',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'class-1',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1.0000000000', currency: 'USD' },
        ratio: { numerator: '2.0000000000', denominator: '1.0000000000' },
        rounding_type: 'OcfRoundingNormal',
      },
      comments: [],
    });

    expect(result).not.toHaveProperty('board_approval_date');
    expect(result).not.toHaveProperty('stockholder_approval_date');
  });

  it('emits the singular resulting security for stock consolidations', () => {
    const result = damlStockConsolidationToNative({
      id: 'consolidation-1',
      date: '2026-01-01T00:00:00.000Z',
      security_ids: ['security-1', 'security-2'],
      resulting_security_id: 'security-3',
      reason_text: null,
      comments: [],
    });

    expect(result.resulting_security_id).toBe('security-3');
    expect(result).not.toHaveProperty('resulting_security_ids');
  });

  it('does not emit resulting security IDs for equity compensation repricings', () => {
    const result = damlEquityCompensationRepricingToNative({
      id: 'repricing-1',
      date: '2026-01-01T00:00:00.000Z',
      security_id: 'security-1',
      new_exercise_price: { amount: '1.0000000000', currency: 'USD' },
      comments: [],
    });

    expect(result).not.toHaveProperty('resulting_security_ids');
  });

  it('does not emit reason_text for stakeholder status changes', () => {
    const result = damlStakeholderStatusChangeEventToNative({
      id: 'status-1',
      date: '2026-01-01T00:00:00.000Z',
      stakeholder_id: 'stakeholder-1',
      new_status: 'OcfStakeholderStatusActive',
      comments: ['Status changed'],
    });

    expect(result.comments).toEqual(['Status changed']);
    expect(result).not.toHaveProperty('reason_text');
  });

  it('does not emit non-schema aliases for warrant issuances', () => {
    const result = damlWarrantIssuanceDataToNative({
      id: 'warrant-issuance-1',
      custom_id: 'W-1',
      date: '2026-01-01T00:00:00.000Z',
      purchase_price: { amount: '1.0000000000', currency: 'USD' },
      security_id: 'warrant-1',
      stakeholder_id: 'stakeholder-1',
      comments: [],
      exercise_triggers: [],
      security_law_exemptions: [],
      vestings: [],
      board_approval_date: null,
      consideration_text: null,
      exercise_price: null,
      quantity: '100.0000000000',
      quantity_source: 'OcfQuantityUnspecified',
      stockholder_approval_date: null,
      vesting_terms_id: null,
      warrant_expiration_date: null,
    });

    expect(result.quantity).toBe('100');
    expect(result).not.toHaveProperty('ratio_numerator');
    expect(result).not.toHaveProperty('ratio_denominator');
    expect(result).not.toHaveProperty('percent_of_outstanding');
    expect(result).not.toHaveProperty('conversion_triggers');
  });

  it('does not emit ledger-only warrant exercise fields', () => {
    const result = damlWarrantExerciseToNative({
      id: 'warrant-exercise-1',
      date: '2026-01-01T00:00:00.000Z',
      security_id: 'warrant-1',
      trigger_id: 'trigger-1',
      quantity: '100.0000000000',
      resulting_security_ids: ['security-1'],
      consideration_text: null,
      comments: [],
    });

    expect(result).not.toHaveProperty('quantity');
    expect(result).not.toHaveProperty('balance_security_id');
  });
});
