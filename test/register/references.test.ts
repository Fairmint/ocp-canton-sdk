import fs from 'fs';
import path from 'path';
import {
  isOcfEditableEntityType,
  mapOcfObjectTypeToEntityType,
  type OcfEditableEntityType,
} from '../../src/functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { requirementsOf } from '../../src/register/inputs';
import {
  checkRecordCaps,
  checkRequirement,
  consumedSecurities,
  polymorphicReferenceCount,
  polymorphicRequirementsOf,
  recordTranches,
  subjectSecurity,
  type RecordData,
  type RequirementLookups,
} from '../../src/register/references';
import type { RegisterRequirement } from '../../src/types/register';
import { loadFixture } from '../utils/productionFixtures';
import {
  document,
  financing,
  stakeholder,
  stockClass,
  stockClassSplit,
  stockIssuance,
  stockPlan,
  vestingTerms,
  warrantIssuance,
} from './bookFixtures';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

function fixturesOf(
  root: string
): Array<{ label: string; entityType: OcfEditableEntityType; ocf: Record<string, unknown> }> {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.json') ? [full] : [];
    });
  return walk(path.join(FIXTURES_DIR, root)).flatMap((file) => {
    const { _source: _marker, ...ocf } = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    const entityType = typeof ocf.object_type === 'string' ? mapOcfObjectTypeToEntityType(ocf.object_type) : null;
    if (entityType === null || !isOcfEditableEntityType(entityType)) return [];
    return [{ label: path.relative(FIXTURES_DIR, file), entityType, ocf }];
  });
}

/** A requirement as `kind | label | target`, the target its IDs. */
function brief(requirement: RegisterRequirement): string {
  const { kind, label, ...target } = requirement;
  const ids = Object.entries(target)
    .filter(([key]) => key !== 'object_types')
    .map(([, value]) => String(value));
  return `${kind} | ${label} | ${ids.join(' ')}`;
}

function record(entityType: OcfEditableEntityType, data: unknown): RecordData {
  return convertToDaml(entityType, data as never);
}

describe('requirementsOf', () => {
  it('lists every reference of every fixture record as References.daml does, in its order', () => {
    const listed = new Map(
      [...fixturesOf('production'), ...fixturesOf('synthetic')].map(({ label, entityType, ocf }) => [
        label,
        requirementsOf(entityType, ocf as never).map(brief),
      ])
    );
    expect(listed.get('synthetic/convertibleConversionCapitalizationDefinition.json')).toEqual([
      'security | Convertible conversion | test-security-convertible-safe-001',
      'trigger | Convertible conversion | test-security-convertible-safe-001 safe-trigger',
      'security | Convertible conversion resulting security | test-security-stock-series-a-001',
      'security | Convertible conversion balance | test-security-convertible-safe-balance-001',
      'security | Convertible conversion capitalization definition included security | test-security-convertible-other-001',
      'security | Convertible conversion capitalization definition excluded security | test-security-treasury-001',
      'object | Convertible conversion capitalization definition stock class | test-stock-class-common-001',
      'object | Convertible conversion capitalization definition stock class | test-stock-class-preferred-001',
      'object | Convertible conversion capitalization definition stock plan | test-stock-plan-001',
    ]);
    expect(listed.get('production/equityCompensationIssuance/option-iso.json')).toEqual([
      'object | Equity compensation stakeholder | test-stakeholder-individual-001',
      'object | Equity compensation stock class | test-stock-class-common-001',
      'object | Equity compensation vesting terms | test-vesting-terms-001',
      'plan_includes_class | Equity compensation stock plan | test-stock-plan-001 test-stock-class-common-001',
    ]);
    expect(listed.get('synthetic/warrantIssuanceMechanisms.json')).toEqual([
      'object | Warrant issuance stakeholder | test-stakeholder-institution-001',
      'object | Warrant exercise trigger conversion target | test-stock-class-common-001',
      'object | Warrant exercise trigger conversion target | test-stock-class-preferred-001',
    ]);
    expect(listed.get('synthetic/convertibleIssuanceFixedAmount.json')).toEqual([
      'object | Convertible issuance stakeholder | test-stakeholder-institution-001',
      'object | Convertible conversion trigger conversion target | test-stock-class-common-001',
    ]);
    expect(listed.get('synthetic/stockClassRatioConversion.json')).toEqual([
      'object | Stock class test-stock-class-ratio-001 conversion target | test-stock-class-common-001',
    ]);
    expect(listed.get('synthetic/warrantExercise.json')).toEqual([
      'security | Warrant exercise | test-security-warrant-exercise-001',
      'trigger | Warrant exercise | test-security-warrant-exercise-001 test-warrant-trigger-001',
      'security | Warrant exercise resulting security | test-security-warrant-shares-001',
    ]);
    expect(listed.get('synthetic/stockClassConversionRatioAdjustment.json')).toEqual([
      'ratio_conversion_right | Stock class conversion ratio adjustment test-stock-class-conv-ratio-adj-001 | test-stock-class-preferred-001',
    ]);
    expect(listed.get('synthetic/vestingEvent.json')).toEqual([
      'vesting_condition | Vesting event test-vesting-event-001 | test-security-milestone-vest-001 milestone-revenue-target false',
    ]);
    expect(listed.get('production/issuerAuthorizedSharesAdjustment.json')).toEqual([
      'object | Issuer authorized shares adjustment issuer | test-issuer-001',
    ]);
    // Stock events on a state, definitions with no references and the issuer make none.
    for (const label of [
      'production/stockTransfer.json',
      'production/stockCancellation.json',
      'production/stockRepurchase.json',
      'synthetic/stockConsolidation.json',
      'synthetic/stockConversion.json',
      'synthetic/stockReissuance.json',
      'synthetic/stockRetraction.json',
      'synthetic/stockAcceptance.json',
      'synthetic/vestingAcceleration.json',
      'production/vestingTerms/time-based-cliff.json',
      'production/stockLegendTemplate/rule-144.json',
      'production/stakeholder/individual.json',
      'production/issuer/basic.json',
    ]) {
      expect(listed.get(label)).toEqual([]);
    }
    for (const requirements of listed.values()) {
      expect(new Set(requirements).size).toBe(requirements.length);
    }
  });

  it('names the stock plan alone when an equity compensation names no class', () => {
    const grant = loadFixture<Record<string, unknown>>('production/equityCompensationIssuance/rsu.json');
    const { stock_class_id: _class, ...withoutClass } = grant;
    expect(requirementsOf('equityCompensationIssuance', withoutClass as never).map(brief)).toContain(
      'object | Equity compensation stock plan | test-stock-plan-001'
    );
  });
});

describe('the per-record caps and counts', () => {
  it('refuses a record over its stored-reference, plan-class or tranche cap with the ledger message', () => {
    const ids = (count: number): string[] => Array.from({ length: count }, (_, n) => `ID-${n}`);
    expect(checkRecordCaps(record('financing', financing('FIN-1', ids(1000))))).toBeNull();
    expect(checkRecordCaps(record('financing', financing('FIN-1', ids(1001))))).toBe(
      'OcfObjectTypeFinancing has 1001 financing issuance IDs; at most 1000'
    );
    expect(checkRecordCaps(record('document', document('DOC-1', ids(1001))))).toBe(
      'OcfObjectTypeDocument has 1001 document related objects; at most 1000'
    );
    const conversion = loadFixture<Record<string, unknown>>(
      'synthetic/convertibleConversionCapitalizationDefinition.json'
    );
    const { _source: _marker, ...conversionData } = conversion;
    const capitalized = record('convertibleConversion', {
      ...conversionData,
      capitalization_definition: {
        include_stock_class_ids: ids(500),
        include_stock_plans_ids: ids(300),
        include_security_ids: ids(150),
        exclude_security_ids: ids(51),
      },
    });
    expect(polymorphicReferenceCount(capitalized)).toBe(1001);
    expect(checkRecordCaps(capitalized)).toBe(
      'OcfObjectTypeTxConvertibleConversion has 1001 capitalization definition references; at most 1000'
    );
    expect(checkRecordCaps(record('stockPlan', stockPlan('PLAN-1', ['C-0', ...ids(16)])))).toBe(
      'OcfObjectTypeStockPlan has 17 stock plan classes; at most 16'
    );
    const tranches = Array.from({ length: 1501 }, () => ({ date: '2025-01-01', amount: '1' }));
    expect(checkRecordCaps(record('warrantIssuance', warrantIssuance('WI-1', 'W-1', { vestings: tranches })))).toBe(
      'OcfObjectTypeTxWarrantIssuance has 1501 vesting tranches; at most 1500'
    );
    expect(recordTranches(record('warrantIssuance', warrantIssuance('WI-1', 'W-1', { vestings: tranches })))).toBe(
      1501
    );
    expect(checkRecordCaps(record('stakeholder', stakeholder('SH-1')))).toBeNull();
  });

  it('dedups the polymorphic requirements an edit is charged for, and reads what a stock record consumed', () => {
    expect(polymorphicRequirementsOf(record('document', document('DOC-1', ['SH-A', 'SH-A', 'SH-B'])))).toHaveLength(2);
    expect(polymorphicRequirementsOf(record('financing', financing('FIN-1', ['ISS-1', 'ISS-1'])))).toHaveLength(1);
    expect(polymorphicRequirementsOf(record('stakeholder', stakeholder('SH-1')))).toEqual([]);
    const consolidation = loadFixture<Record<string, unknown>>('synthetic/stockConsolidation.json');
    const { _source: _marker, ...consolidationData } = consolidation;
    expect(consumedSecurities(record('stockConsolidation', consolidationData))).toEqual([
      'test-security-consolidated-001',
      'test-security-consolidated-002',
      'test-security-consolidated-003',
    ]);
    expect(consumedSecurities(record('stakeholder', stakeholder('SH-1')))).toEqual([]);
    expect(subjectSecurity(record('stakeholder', stakeholder('SH-1')))).toBeNull();
  });
});

describe('checkRequirement', () => {
  const records = new Map<string, RecordData>([
    ['SH-A', record('stakeholder', stakeholder('SH-A'))],
    ['CLS-A', record('stockClass', stockClass('CLS-A'))],
    ['PLAN-1', record('stockPlan', stockPlan('PLAN-1', ['CLS-A']))],
    ['VT-1', record('vestingTerms', vestingTerms('VT-1'))],
    ['SPLIT-1', record('stockClassSplit', stockClassSplit('SPLIT-1', 'CLS-A', '2024-06-01'))],
    ['SPLIT-B', record('stockClassSplit', stockClassSplit('SPLIT-B', 'CLS-B', '2024-06-01'))],
  ]);
  const securities = new Map<string, RecordData>([
    ['S-1', record('stockIssuance', stockIssuance({ security_id: 'S-1', vesting_terms_id: 'VT-1' }))],
    ['S-2', record('stockIssuance', stockIssuance({ security_id: 'S-2' }))],
    ['S-3', record('stockIssuance', stockIssuance({ security_id: 'S-3', vesting_terms_id: 'VT-X' }))],
    ['W-1', record('warrantIssuance', warrantIssuance('WI-1', 'W-1'))],
    ['F-1', record('financing', financing('FIN-1', ['ISS-1']))],
  ]);
  const lookups: RequirementLookups = {
    record: (id) => records.get(id) ?? null,
    security: (id) => securities.get(id) ?? null,
    epochSplits: (id) =>
      id === 'CLS-A'
        ? [{ split_id: 'SPLIT-1', date: '2024-06-01', ratio: { numerator: '2', denominator: '1' } }]
        : null,
  };
  const check = (requirement: RegisterRequirement): string | null => checkRequirement(lookups, requirement);

  it('holds for satisfied requirements of every kind', () => {
    expect(check({ kind: 'object', label: 'L', object_id: 'SH-A', object_types: ['STAKEHOLDER'] })).toBeNull();
    expect(
      check({ kind: 'security', label: 'L', security_id: 'W-1', object_types: ['TX_WARRANT_ISSUANCE'] })
    ).toBeNull();
    expect(
      check({ kind: 'plan_includes_class', label: 'L', stock_plan_id: 'PLAN-1', stock_class_id: 'CLS-A' })
    ).toBeNull();
    expect(
      check({
        kind: 'vesting_condition',
        label: 'L',
        security_id: 'S-1',
        vesting_condition_id: 'milestone',
        start: false,
      })
    ).toBeNull();
    expect(
      check({
        kind: 'split_of_class',
        label: 'L',
        split_id: 'SPLIT-1',
        stock_class_id: 'CLS-A',
        on_or_before: '2024-06-01',
      })
    ).toBeNull();
  });

  it("refuses each failure with the ledger's message", () => {
    expect(check({ kind: 'security', label: 'L', security_id: 'S-X', object_types: ['TX_STOCK_ISSUANCE'] })).toBe(
      'L security not found: S-X'
    );
    expect(check({ kind: 'security', label: 'L', security_id: 'W-1', object_types: ['TX_STOCK_ISSUANCE'] })).toBe(
      'L security W-1 is carried by a OcfObjectTypeTxWarrantIssuance'
    );
    expect(check({ kind: 'plan_includes_class', label: 'L', stock_plan_id: 'PLAN-X', stock_class_id: 'CLS-A' })).toBe(
      'L not found: PLAN-X'
    );
    expect(check({ kind: 'ratio_conversion_right', label: 'L', stock_class_id: 'CLS-A' })).toBe(
      'L targets a stock class without a ratio conversion right: CLS-A'
    );
    expect(check({ kind: 'ratio_conversion_right', label: 'L', stock_class_id: 'SH-A' })).toBe(
      'L target not found: SH-A'
    );
    const condition = (securityId: string, conditionId = 'start'): RegisterRequirement => ({
      kind: 'vesting_condition',
      label: 'L',
      security_id: securityId,
      vesting_condition_id: conditionId,
      start: true,
    });
    expect(check(condition('S-X'))).toBe('L: security not found: S-X');
    expect(check(condition('F-1'))).toBe('L: security F-1 cannot vest');
    expect(check(condition('S-2'))).toBe('L: security S-2 has no vesting terms');
    expect(check(condition('S-3'))).toBe('L: vesting terms not found: VT-X');
    expect(check(condition('S-1', 'nope'))).toBe('L references missing vesting condition nope for security S-1');
    expect(check(condition('S-1', 'milestone'))).toBe(
      'L references vesting condition milestone with the wrong trigger type'
    );
    expect(check({ kind: 'trigger', label: 'L', security_id: 'W-1', trigger_id: 'T-1' })).toBe(
      'L trigger not found: T-1'
    );
    expect(check({ kind: 'trigger', label: 'L', security_id: 'S-1', trigger_id: 'T-1' })).toBe(
      'L security not found: S-1'
    );
    const split = (splitId: string, stockClassId = 'CLS-A', onOrBefore = '2024-07-01'): RegisterRequirement => ({
      kind: 'split_of_class',
      label: 'L',
      split_id: splitId,
      stock_class_id: stockClassId,
      on_or_before: onOrBefore,
    });
    expect(check(split('SPLIT-X'))).toBe('L split transaction not found: SPLIT-X');
    expect(check(split('SPLIT-B'))).toBe('L split SPLIT-B is of stock class CLS-B, not CLS-A');
    expect(check(split('SPLIT-1', 'CLS-A', '2024-05-01'))).toBe('L split SPLIT-1 is dated after the reissuance');
    expect(check(split('SPLIT-B', 'CLS-B'))).toBe("L split SPLIT-B is not recorded on its class's epoch");
  });
});
