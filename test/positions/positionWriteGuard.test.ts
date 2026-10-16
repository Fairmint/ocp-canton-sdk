import type { CapTablePositionFields } from '../../src/functions/OpenCapTable/positions/positionTypes';
import {
  checkPositionRecordVersion,
  checkPositionVestingTermsWrite,
  checkStockClassDelete,
  describePositionWriteRefusal,
  isPositionGuardedEntityType,
  positionRecordRefs,
} from '../../src/functions/OpenCapTable/positions/positionWriteGuard';

const FIELDS: CapTablePositionFields = {
  enabled: true,
  registries: new Map([['CLASS-M', 'registry-cid']]),
  migratedSecurityIds: new Map([['S-MIG', 'SH-1']]),
};
const NO_POSITIONS: CapTablePositionFields = {
  enabled: false,
  registries: new Map(),
  migratedSecurityIds: new Map(),
};

describe('positionRecordRefs (OCP *Refs)', () => {
  it.each([
    ['stockIssuance', { stock_class_id: 'C', security_id: 'S1' }, 'stock issuance R', 'C', ['S1']],
    ['stockClassSplit', { stock_class_id: 'C' }, 'stock class split R', 'C', []],
    [
      'stockClassConversionRatioAdjustment',
      { stock_class_id: 'C' },
      'stock class conversion ratio adjustment R',
      'C',
      [],
    ],
    [
      'stockTransfer',
      { security_id: 'S1', resulting_security_ids: ['S2', 'S3'], balance_security_id: 'S4' },
      'stock transfer R',
      null,
      ['S1', 'S2', 'S3', 'S4'],
    ],
    ['stockCancellation', { security_id: 'S1', balance_security_id: null }, 'stock cancellation R', null, ['S1']],
    ['stockRepurchase', { security_id: 'S1', balance_security_id: 'S2' }, 'stock repurchase R', null, ['S1', 'S2']],
    ['stockRetraction', { security_id: 'S1' }, 'stock retraction R', null, ['S1']],
    [
      'stockReissuance',
      { security_id: 'S1', resulting_security_ids: ['S2'] },
      'stock reissuance R',
      null,
      ['S1', 'S2'],
    ],
    [
      'stockConversion',
      { security_id: 'S1', resulting_security_ids: ['S2'], balance_security_id: 'S3' },
      'stock conversion R',
      null,
      ['S1', 'S2', 'S3'],
    ],
    ['stockAcceptance', { security_id: 'S1' }, 'stock acceptance R', null, ['S1']],
    [
      'stockConsolidation',
      { resulting_security_id: 'S9', security_ids: ['S1', 'S2'] },
      'stock consolidation R',
      null,
      ['S9', 'S1', 'S2'],
    ],
    ['warrantExercise', { security_id: 'W1', resulting_security_ids: ['S1'] }, 'warrant exercise R', null, ['S1']],
    [
      'convertibleConversion',
      { security_id: 'C1', resulting_security_ids: ['S1'] },
      'convertible conversion R',
      null,
      ['S1'],
    ],
    [
      'equityCompensationExercise',
      { security_id: 'E1', resulting_security_ids: ['S1'] },
      'equity compensation exercise R',
      null,
      ['S1'],
    ],
    [
      'equityCompensationRelease',
      { security_id: 'E1', resulting_security_ids: ['S1'] },
      'equity compensation release R',
      null,
      ['S1'],
    ],
    ['vestingStart', { security_id: 'S1' }, 'vesting start R', null, ['S1']],
    ['vestingEvent', { security_id: 'S1' }, 'vesting event R', null, ['S1']],
    ['vestingAcceleration', { security_id: 'S1' }, 'vesting acceleration R', null, ['S1']],
    ['stockPlanReturnToPool', { security_id: 'S1' }, 'stock plan return to pool R', null, ['S1']],
  ] as const)('%s', (entityType, data, label, writesInto, securityIds) => {
    expect(isPositionGuardedEntityType(entityType)).toBe(true);
    expect(positionRecordRefs(entityType, 'R', data)).toEqual({ label, writesInto, securityIds });
  });

  it('ignores entity types the ledger guard does not inspect', () => {
    for (const entityType of ['stakeholder', 'stockClass', 'warrantIssuance', 'warrantTransfer', 'document'] as const) {
      expect(isPositionGuardedEntityType(entityType)).toBe(false);
      expect(positionRecordRefs(entityType, 'R', { security_id: 'S-MIG' })).toBeNull();
    }
  });
});

describe('checkPositionRecordVersion', () => {
  const classOf = (securityId: string) => (securityId === 'S-MAN' || securityId === 'S-MIG' ? 'CLASS-M' : 'CLASS-F');

  it('checks a class record against managed classes', () => {
    const refs = positionRecordRefs('stockIssuance', 'I1', { stock_class_id: 'CLASS-M', security_id: 'S-MIG' });
    if (refs === null) throw new Error('expected refs');

    expect(checkPositionRecordVersion(refs, 'stored', FIELDS, classOf)).toEqual([
      {
        reason: 'managed_class_record',
        version: 'stored',
        stockClassId: 'CLASS-M',
        message: 'stock issuance I1 (stored) is in position-managed class CLASS-M',
      },
    ]);
  });

  it('guards a migrated security by the class of its issuance, not by the migrated set', () => {
    const refs = positionRecordRefs('stockTransfer', 'T1', { security_id: 'S-MIG', resulting_security_ids: ['S-F'] });
    if (refs === null) throw new Error('expected refs');

    expect(checkPositionRecordVersion(refs, 'proposed', FIELDS, classOf)).toEqual([
      {
        reason: 'managed_class_security',
        version: 'proposed',
        securityId: 'S-MIG',
        stockClassId: 'CLASS-M',
        message: 'stock transfer T1 (proposed) references security S-MIG of position-managed class CLASS-M',
      },
    ]);
    // The ledger guard reads only position_registries.
    expect(checkPositionRecordVersion(refs, 'proposed', FIELDS, () => 'CLASS-F')).toEqual([]);
  });

  it('checks the class of named securities only for records outside a class', () => {
    const refs = positionRecordRefs('stockIssuance', 'I2', { stock_class_id: 'CLASS-F', security_id: 'S-MAN' });
    if (refs === null) throw new Error('expected refs');
    expect(checkPositionRecordVersion(refs, 'proposed', FIELDS, classOf)).toEqual([]);

    const transfer = positionRecordRefs('stockTransfer', 'T1', { security_id: 'S-MAN', resulting_security_ids: [] });
    if (transfer === null) throw new Error('expected refs');
    expect(checkPositionRecordVersion(transfer, 'proposed', FIELDS, classOf).map((v) => v.reason)).toEqual([
      'managed_class_security',
    ]);
  });

  it('is inactive on a root without positions', () => {
    const refs = positionRecordRefs('stockTransfer', 'T1', { security_id: 'S-MIG', resulting_security_ids: [] });
    if (refs === null) throw new Error('expected refs');
    expect(checkPositionRecordVersion(refs, 'proposed', NO_POSITIONS, () => 'CLASS-M')).toEqual([]);
    expect(checkStockClassDelete('stockClass', 'CLASS-M', NO_POSITIONS)).toEqual([]);
  });

  it('refuses deleting a managed stock class only', () => {
    expect(checkStockClassDelete('stockClass', 'CLASS-M', FIELDS).map((v) => v.message)).toEqual([
      'stock class CLASS-M is position-managed',
    ]);
    expect(checkStockClassDelete('stockClass', 'CLASS-F', FIELDS)).toEqual([]);
    expect(checkStockClassDelete('stakeholder', 'CLASS-M', FIELDS)).toEqual([]);
  });

  it('describes a refusal on one line', () => {
    expect(
      describePositionWriteRefusal({
        operation: 'delete',
        entityType: 'stockClass',
        id: 'CLASS-M',
        violations: checkStockClassDelete('stockClass', 'CLASS-M', FIELDS),
      })
    ).toBe('delete stockClass CLASS-M: stock class CLASS-M is position-managed');
  });
});

describe('checkPositionVestingTermsWrite', () => {
  const issuance = (id: string, securityId: string, stockClassId: string, vestingTermsId: string) => ({
    id,
    security_id: securityId,
    stock_class_id: stockClassId,
    vesting_terms_id: vestingTermsId,
  });

  it('names the managed issuance the ledger reports first, by OCF ID, and counts the others', () => {
    const issuances = [
      issuance('ISS-C', 'S-C', 'CLASS-M', 'VT-STD'),
      issuance('ISS-F', 'S-F', 'CLASS-F', 'VT-STD'),
      issuance('ISS-A', 'S-A', 'CLASS-M', 'VT-STD'),
      issuance('ISS-B', 'S-B', 'CLASS-M', 'VT-OTHER'),
    ];

    expect(checkPositionVestingTermsWrite({ operation: 'delete', id: 'VT-STD' }, FIELDS, issuances, undefined)).toEqual(
      [
        {
          reason: 'managed_vesting_terms',
          stockClassId: 'CLASS-M',
          securityId: 'S-A',
          message:
            'vesting terms VT-STD are named by security S-A of position-managed class CLASS-M (and by security S-C ' +
            'of position-managed classes)',
        },
      ]
    );
    expect(
      checkPositionVestingTermsWrite({ operation: 'delete', id: 'VT-OTHER' }, FIELDS, issuances, undefined)
    ).toEqual([
      {
        reason: 'managed_vesting_terms',
        stockClassId: 'CLASS-M',
        securityId: 'S-B',
        message: 'vesting terms VT-OTHER are named by security S-B of position-managed class CLASS-M',
      },
    ]);
  });

  it('gives one bounded reason however many managed issuances name the terms', () => {
    const issuances = Array.from({ length: 2000 }, (_, index) => {
      const n = String(2000 - index).padStart(4, '0');
      return issuance(`ISS-${n}`, `S-${n}`, 'CLASS-M', 'VT-STD');
    });
    const terms = { id: 'VT-STD', vesting_conditions: [{ id: 'start' }] };

    const violations = checkPositionVestingTermsWrite(
      { operation: 'edit', id: 'VT-STD', data: { ...terms, description: 'Corrected' } },
      FIELDS,
      issuances,
      terms
    );

    expect(violations).toEqual([
      {
        reason: 'managed_vesting_terms',
        stockClassId: 'CLASS-M',
        securityId: 'S-0001',
        message:
          'vesting terms VT-STD are named by security S-0001 of position-managed class CLASS-M (and by securities ' +
          'S-0002, S-0003, S-0004 and 1996 more of position-managed classes)',
      },
    ]);
  });

  it('is inactive on a root without positions', () => {
    expect(
      checkPositionVestingTermsWrite(
        { operation: 'delete', id: 'VT-STD' },
        NO_POSITIONS,
        [issuance('ISS-A', 'S-A', 'CLASS-M', 'VT-STD')],
        undefined
      )
    ).toEqual([]);
  });
});
