import {
  checkPositionRecordVersion,
  checkStockClassDelete,
  describePositionWriteRefusal,
  isPositionGuardedEntityType,
  positionRecordRefs,
  type CapTablePositionFields,
} from '../../src/functions/OpenCapTable/positions';

const FIELDS: CapTablePositionFields = {
  enabled: true,
  registries: new Map([['CLASS-M', 'registry-cid']]),
  migratedSecurityIds: new Map([['S-MIG', 'SH-1']]),
  ancestorSecurityIds: new Map([['S-ANC', 'S-MIG']]),
};
const NO_POSITIONS: CapTablePositionFields = {
  enabled: false,
  registries: new Map(),
  migratedSecurityIds: new Map(),
  ancestorSecurityIds: new Map(),
};

describe('positionRecordRefs (OCP *Refs)', () => {
  it.each([
    ['stockIssuance', { stock_class_id: 'C', security_id: 'S1' }, 'stock issuance R', 'C', ['S1']],
    ['stockClassSplit', { stock_class_id: 'C' }, 'stock class split R', 'C', []],
    ['stockClassConversionRatioAdjustment', { stock_class_id: 'C' }, 'conversion ratio adjustment R', 'C', []],
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
  const classOf = (securityId: string) => (securityId === 'S-MAN' ? 'CLASS-M' : 'CLASS-F');

  it('checks a class record against managed classes and the security it issues', () => {
    const refs = positionRecordRefs('stockIssuance', 'I1', { stock_class_id: 'CLASS-M', security_id: 'S-MIG' });
    if (refs === null) throw new Error('expected refs');

    expect(checkPositionRecordVersion(refs, 'stored', FIELDS, classOf)).toEqual([
      {
        reason: 'managed_class_record',
        version: 'stored',
        stockClassId: 'CLASS-M',
        message: 'stock issuance I1 (stored) is in position-managed class CLASS-M',
      },
      {
        reason: 'migrated_security',
        version: 'stored',
        securityId: 'S-MIG',
        message: 'stock issuance I1 (stored) references migrated security S-MIG',
      },
    ]);
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
