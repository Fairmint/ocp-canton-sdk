import {
  OCF_OBJECT_SCHEMA_PATHS,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  getOcfObjectTypeCapability,
  getOcfSchema,
  validateOcfCapTableSnapshot,
  type OcfCapTableSnapshotObject,
} from '../../src';
import orphanedStockIssuanceSnapshot from '../fixtures/synthetic/orphanedStockIssuanceSnapshot.json';

const orphanedSnapshot = orphanedStockIssuanceSnapshot as OcfCapTableSnapshotObject[];

function issueCodes(objects: readonly OcfCapTableSnapshotObject[]): string[] {
  return validateOcfCapTableSnapshot(objects).issues.map((issue) => issue.code);
}

describe('getOcfObjectTypeCapability', () => {
  it('distinguishes ledger-backed, schema-only, compatibility-alias, and unsupported types', () => {
    expect(getOcfObjectTypeCapability('TX_STOCK_ISSUANCE')).toEqual({
      support: 'ledger-backed',
      objectType: 'TX_STOCK_ISSUANCE',
      canonicalObjectType: 'TX_STOCK_ISSUANCE',
      entityType: 'stockIssuance',
    });
    expect(getOcfObjectTypeCapability('TX_PLAN_SECURITY_ISSUANCE')).toEqual({
      support: 'ledger-backed',
      objectType: 'TX_PLAN_SECURITY_ISSUANCE',
      canonicalObjectType: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      entityType: 'equityCompensationIssuance',
    });
    expect(getOcfObjectTypeCapability('FINANCING')).toEqual({
      support: 'schema-only',
      objectType: 'FINANCING',
    });
    expect(getOcfObjectTypeCapability('TX_NOT_REAL')).toEqual({
      support: 'unsupported',
      objectType: 'TX_NOT_REAL',
    });
  });

  it('classifies every source-of-truth OCF schema object type exhaustively', () => {
    const capabilities = Object.keys(OCF_OBJECT_SCHEMA_PATHS).map((objectType) =>
      getOcfObjectTypeCapability(objectType)
    );

    expect(capabilities.filter((capability) => capability.support === 'unsupported')).toEqual([]);
    expect(
      capabilities
        .filter((capability) => capability.support === 'schema-only')
        .map((capability) => capability.objectType)
    ).toEqual(['FINANCING']);
    expect(
      [
        ...new Set(
          capabilities.flatMap((capability) =>
            capability.support === 'ledger-backed' ? [capability.canonicalObjectType] : []
          )
        ),
      ].sort()
    ).toEqual(Object.keys(OCF_OBJECT_TYPE_TO_ENTITY_TYPE).sort());
  });
});

describe('validateOcfCapTableSnapshot', () => {
  it('reports a zero-issuer snapshot explicitly', () => {
    expect(validateOcfCapTableSnapshot([])).toEqual({
      valid: false,
      issues: [
        {
          code: 'ISSUER_CARDINALITY',
          message: 'Expected exactly one ISSUER, found 0',
          objectType: 'ISSUER',
          count: 0,
        },
      ],
    });
  });

  it('reproduces the sanitized orphaned stock-issuance incident', () => {
    for (const object of orphanedSnapshot) {
      expect(getOcfSchema(object.object_type).safeParse(object).success).toBe(true);
    }

    const result = validateOcfCapTableSnapshot(orphanedSnapshot);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectType: 'TX_STOCK_ISSUANCE',
        objectId: 'stock-issuance-orphaned',
        path: 'stakeholder_id',
        referenceId: 'stakeholder-moved-to-another-portal',
        targetObjectTypes: ['STAKEHOLDER'],
      }),
    ]);
  });

  it('accepts deleting a stakeholder and all dependents in the same final snapshot', () => {
    const completeSnapshot: OcfCapTableSnapshotObject[] = [
      ...orphanedSnapshot,
      {
        object_type: 'STAKEHOLDER',
        id: 'stakeholder-moved-to-another-portal',
        name: { legal_name: 'Synthetic Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    ];

    expect(validateOcfCapTableSnapshot(completeSnapshot).valid).toBe(true);
    expect(
      validateOcfCapTableSnapshot(
        completeSnapshot.filter((object) => !['STAKEHOLDER', 'TX_STOCK_ISSUANCE'].includes(object.object_type))
      )
    ).toEqual({ valid: true, issues: [] });
  });

  it('does not fail ledger graph validation for schema-only FINANCING references', () => {
    expect(
      validateOcfCapTableSnapshot([
        { object_type: 'ISSUER', id: 'issuer-1' },
        {
          object_type: 'FINANCING',
          id: 'financing-1',
          issuance_ids: ['historical-issuance-not-materialized-on-ledger'],
        },
      ])
    ).toEqual({ valid: true, issues: [] });
  });

  it('ignores empty strings only for optional references', () => {
    const optionalEmptyReferences: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'stock-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: '',
        vesting_terms_id: '',
        stock_legend_ids: [],
      },
      {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'equity-1',
        security_id: 'equity-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: '',
        stock_plan_id: '',
        vesting_terms_id: '',
      },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        security_id: 'warrant-security-1',
        stakeholder_id: 'stakeholder-1',
        vesting_terms_id: '',
        exercise_triggers: [{ conversion_right: { converts_to_stock_class_id: '' } }],
      },
      {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'convertible-1',
        security_id: 'convertible-security-1',
        stakeholder_id: 'stakeholder-1',
        conversion_triggers: [{ conversion_right: { converts_to_stock_class_id: '' } }],
      },
      {
        object_type: 'TX_STOCK_REISSUANCE',
        id: 'reissuance-1',
        security_id: 'stock-security-1',
        split_transaction_id: '',
      },
    ];

    expect(validateOcfCapTableSnapshot(optionalEmptyReferences)).toEqual({ valid: true, issues: [] });

    const requiredEmptyReference = optionalEmptyReferences.map((object) =>
      object.id === 'stock-1' ? { ...object, stakeholder_id: '' } : object
    );
    expect(validateOcfCapTableSnapshot(requiredEmptyReference).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectId: 'stock-1',
        path: 'stakeholder_id',
        referenceId: '',
      }),
    ]);
  });

  it('resolves stock-plan returns to stock or equity-compensation issuances and enforces plan identity', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_PLAN', id: 'plan-1', stock_class_ids: ['class-1'] },
      { object_type: 'STOCK_PLAN', id: 'plan-2', stock_class_ids: ['class-1'] },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'stock-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: 'plan-1',
        stock_legend_ids: [],
      },
      {
        object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
        id: 'equity-1',
        security_id: 'equity-security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-1',
        stock_plan_id: 'plan-1',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-valid',
        security_id: 'equity-security-1',
        stock_plan_id: 'plan-1',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-wrong-plan',
        security_id: 'stock-security-1',
        stock_plan_id: 'plan-2',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-missing-security',
        security_id: 'missing-security',
        stock_plan_id: 'plan-1',
      },
    ];

    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectId: 'return-missing-security',
        path: 'security_id',
        referenceId: 'missing-security',
        targetObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
      }),
      expect.objectContaining({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        objectId: 'return-wrong-plan',
        path: 'security_id.stock_plan_id',
        referenceId: 'plan-2',
        actualReferenceId: 'plan-1',
      }),
    ]);
  });

  it('rejects document references to schema-only FINANCING objects', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'FINANCING', id: 'financing-1' },
      {
        object_type: 'DOCUMENT',
        id: 'document-1',
        related_objects: [{ object_type: 'FINANCING', object_id: 'financing-1' }],
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'SCHEMA_ONLY_REFERENCE',
        objectId: 'document-1',
        path: 'related_objects[0].object_type',
        referenceId: 'financing-1',
        targetObjectTypes: ['FINANCING'],
      }),
    ]);
  });

  it('validates core object, security, plan-membership, and trigger references', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_CLASS', id: 'class-2' },
      { object_type: 'STOCK_PLAN', id: 'plan-1', stock_class_ids: ['class-1'] },
      { object_type: 'VESTING_TERMS', id: 'vesting-1', vesting_conditions: [] },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-warrant-1',
        vesting_terms_id: 'vesting-1',
        exercise_triggers: [{ trigger_id: 'exercise-1' }],
      },
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-transaction-1',
        security_id: 'security-warrant-1',
        trigger_id: 'missing-trigger',
      },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        stakeholder_id: 'missing-stakeholder',
        stock_class_id: 'class-2',
        stock_plan_id: 'plan-1',
        stock_legend_ids: [],
        security_id: 'duplicate-security',
      },
      {
        object_type: 'TX_CONVERTIBLE_ISSUANCE',
        id: 'convertible-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'duplicate-security',
        conversion_triggers: [],
      },
    ];

    expect(issueCodes(objects)).toEqual([
      'DUPLICATE_SECURITY_ID',
      'MISSING_REFERENCE',
      'MISSING_TRIGGER',
      'STOCK_PLAN_CLASS_MISMATCH',
    ]);
  });

  it('validates vesting condition identity and trigger kind from the referenced issuance', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      {
        object_type: 'VESTING_TERMS',
        id: 'vesting-1',
        vesting_conditions: [{ id: 'condition-1', trigger: { type: 'VESTING_EVENT' } }],
      },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-1',
        vesting_terms_id: 'vesting-1',
        exercise_triggers: [],
      },
      {
        object_type: 'TX_VESTING_START',
        id: 'vesting-start-1',
        security_id: 'security-1',
        vesting_condition_id: 'condition-1',
      },
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'vesting-event-1',
        security_id: 'security-1',
        vesting_condition_id: 'missing-condition',
      },
    ];

    expect(issueCodes(objects)).toEqual(['MISSING_VESTING_CONDITION', 'VESTING_TRIGGER_MISMATCH']);
  });

  it('treats an empty issuance vesting_terms_id as absent for a vesting transaction', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      {
        object_type: 'TX_WARRANT_ISSUANCE',
        id: 'warrant-1',
        stakeholder_id: 'stakeholder-1',
        security_id: 'security-1',
        vesting_terms_id: '',
        exercise_triggers: [],
      },
      {
        object_type: 'TX_VESTING_START',
        id: 'vesting-start-1',
        security_id: 'security-1',
        vesting_condition_id: 'condition-1',
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        objectId: 'vesting-start-1',
        path: 'security_id.vesting_terms_id',
        targetObjectTypes: ['VESTING_TERMS'],
      }),
    ]);
  });

  it('returns the same issue ordering regardless of input order', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'TX_NOT_REAL', id: 'unsupported-1' },
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'security-1',
        stakeholder_id: 'missing-stakeholder',
        stock_class_id: 'missing-class',
        stock_legend_ids: [],
      },
    ];

    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.issues.map((issue) => issue.code)).toEqual([
      'DUPLICATE_OBJECT_ID',
      'ISSUER_CARDINALITY',
      'MISSING_REFERENCE',
      'MISSING_REFERENCE',
      'UNSUPPORTED_OBJECT_TYPE',
    ]);
  });

  it('does not select an arbitrary duplicate stock plan when validating membership', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'STAKEHOLDER', id: 'stakeholder-1' },
      { object_type: 'STOCK_CLASS', id: 'class-1' },
      { object_type: 'STOCK_CLASS', id: 'class-2' },
      { object_type: 'STOCK_PLAN', id: 'duplicate-plan', stock_class_ids: ['class-1'] },
      { object_type: 'STOCK_PLAN', id: 'duplicate-plan', stock_class_ids: ['class-2'] },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'stock-1',
        security_id: 'security-1',
        stakeholder_id: 'stakeholder-1',
        stock_class_id: 'class-2',
        stock_plan_id: 'duplicate-plan',
        stock_legend_ids: [],
      },
    ];

    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_OBJECT_ID',
        objectType: 'STOCK_PLAN',
        objectId: 'duplicate-plan',
      }),
    ]);
  });
});
