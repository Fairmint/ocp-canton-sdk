import {
  OCF_OBJECT_SCHEMA_PATHS,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  OCF_SCHEMA_ONLY_OBJECT_TYPES,
  getOcfObjectTypeCapability,
  getOcfSchema,
  validateOcfCapTableSnapshot,
  type OcfCapTableSnapshotObject,
  type OcfSecurityFamily,
} from '../../src';
import convertibleIssuanceFixture from '../fixtures/createOcf/TX_CONVERTIBLE_ISSUANCE-fb3ddea3-2642-41d7-abae-8c5dc63a4103.json';
import warrantIssuanceFixture from '../fixtures/createOcf/TX_WARRANT_ISSUANCE-22b896cb-92df-4fd8-9e52-d0d4112b3f98.json';
import equityCompensationIssuanceFixture from '../fixtures/production/equityCompensationIssuance/rsu.json';
import orphanedStockIssuanceSnapshot from '../fixtures/synthetic/orphanedStockIssuanceSnapshot.json';

const orphanedSnapshot = orphanedStockIssuanceSnapshot as OcfCapTableSnapshotObject[];

function issueCodes(objects: readonly OcfCapTableSnapshotObject[]): string[] {
  return validateOcfCapTableSnapshot(objects).issues.map((issue) => issue.code);
}

function completeStockSnapshot(): OcfCapTableSnapshotObject[] {
  return [
    ...orphanedSnapshot,
    {
      object_type: 'STAKEHOLDER',
      id: 'stakeholder-moved-to-another-portal',
      name: { legal_name: 'Synthetic Holder' },
      stakeholder_type: 'INDIVIDUAL',
    },
  ];
}

function expectSchemaValid(objects: readonly OcfCapTableSnapshotObject[]): void {
  for (const object of objects) {
    expect(getOcfSchema(object.object_type).safeParse(object).success).toBe(true);
  }
}

function schemaValidWarrantRoot(): OcfCapTableSnapshotObject {
  return {
    ...warrantIssuanceFixture.db,
    id: 'warrant-root',
    security_id: 'warrant-security-root',
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    exercise_triggers: warrantIssuanceFixture.db.exercise_triggers.map((trigger) => ({
      ...trigger,
      conversion_right: {
        ...trigger.conversion_right,
        converts_to_stock_class_id: 'stock-class-common',
      },
    })),
  };
}

function schemaValidConvertibleRoot(): OcfCapTableSnapshotObject {
  return {
    ...convertibleIssuanceFixture.db,
    id: 'convertible-root',
    security_id: 'convertible-security-root',
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    conversion_triggers: convertibleIssuanceFixture.db.conversion_triggers.map((trigger) => ({
      ...trigger,
      conversion_right: {
        ...trigger.conversion_right,
        converts_to_stock_class_id: 'stock-class-common',
      },
    })),
  };
}

function schemaValidEquityCompensationRoot(): OcfCapTableSnapshotObject {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'equity-compensation-root',
    date: equityCompensationIssuanceFixture.date,
    security_id: 'equity-compensation-security-root',
    custom_id: equityCompensationIssuanceFixture.custom_id,
    stakeholder_id: 'stakeholder-moved-to-another-portal',
    compensation_type: equityCompensationIssuanceFixture.compensation_type,
    quantity: equityCompensationIssuanceFixture.quantity,
    expiration_date: null,
    termination_exercise_windows: equityCompensationIssuanceFixture.termination_exercise_windows,
    security_law_exemptions: equityCompensationIssuanceFixture.security_law_exemptions,
    comments: equityCompensationIssuanceFixture.comments,
  };
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
    for (const capability of capabilities) {
      if (capability.support !== 'ledger-backed') continue;
      expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE[capability.canonicalObjectType]).toBe(capability.entityType);
    }
  });

  it('publishes immutable object-type capability registries', () => {
    expect(Object.isFrozen(OCF_OBJECT_TYPE_TO_ENTITY_TYPE)).toBe(true);
    expect(Object.isFrozen(OCF_SCHEMA_ONLY_OBJECT_TYPES)).toBe(true);

    expect(() => {
      (OCF_OBJECT_TYPE_TO_ENTITY_TYPE as Record<string, string>).TX_STOCK_ISSUANCE = 'stakeholder';
    }).toThrow(TypeError);
    expect(() => {
      (OCF_SCHEMA_ONLY_OBJECT_TYPES as unknown as string[]).push('NOT_REAL');
    }).toThrow(TypeError);

    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE.TX_STOCK_ISSUANCE).toBe('stockIssuance');
    expect(getOcfObjectTypeCapability('FINANCING').support).toBe('schema-only');
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

  it('returns deeply immutable diagnostics without leaking mutable rule arrays', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'missing-security-retraction',
        security_id: 'missing-security',
      },
    ];
    const result = validateOcfCapTableSnapshot(objects);

    expect(result.valid).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
    const issue = result.issues[0];
    expect(Object.isFrozen(issue)).toBe(true);
    if (issue?.code !== 'MISSING_SECURITY_REFERENCE') {
      throw new Error('Expected a missing security diagnostic');
    }
    expect(Object.isFrozen(issue.expectedSecurityFamilies)).toBe(true);
    expect(() => {
      (issue.expectedSecurityFamilies as unknown as OcfSecurityFamily[]).push('warrant');
    }).toThrow(TypeError);

    expect(validateOcfCapTableSnapshot(objects)).toEqual(result);
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
        resulting_security_ids: ['stock-security-2'],
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

  it('resolves stock-plan returns and permits plan rollovers', () => {
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
        code: 'MISSING_SECURITY_REFERENCE',
        objectId: 'return-missing-security',
        path: 'security_id',
        referenceId: 'missing-security',
        expectedSecurityFamilies: ['stock', 'equity-compensation'],
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
        resulting_security_ids: ['resulting-stock-1'],
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
      'DUPLICATE_SECURITY_PRODUCER',
      'MISSING_REFERENCE',
      'MISSING_TRIGGER',
      'STOCK_PLAN_CLASS_MISMATCH',
    ]);
  });

  it('tracks transition-produced security nodes without requiring duplicate issuance producers', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'transfer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '40',
        balance_security_id: 'stock-balance-1',
        resulting_security_ids: ['stock-result-1'],
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-result',
        date: '2025-01-02',
        security_id: 'stock-result-1',
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-balance',
        date: '2025-01-02',
        security_id: 'stock-balance-1',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['TX_CONVERTIBLE_CANCELLATION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', undefined],
    ['TX_CONVERTIBLE_CONVERSION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_CONVERTIBLE_RETRACTION', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', undefined],
    ['TX_CONVERTIBLE_TRANSFER', 'TX_CONVERTIBLE_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_CANCELLATION', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', undefined],
    ['TX_EQUITY_COMPENSATION_EXERCISE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_RELEASE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_EQUITY_COMPENSATION_RETRACTION', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', undefined],
    ['TX_EQUITY_COMPENSATION_TRANSFER', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_CANCELLATION', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_CONSOLIDATION', 'TX_STOCK_ISSUANCE', 'security_ids', 'resulting_security_id'],
    ['TX_STOCK_CONVERSION', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_REISSUANCE', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_STOCK_REPURCHASE', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_RETRACTION', 'TX_STOCK_ISSUANCE', 'security_id', undefined],
    ['TX_STOCK_TRANSFER', 'TX_STOCK_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_WARRANT_CANCELLATION', 'TX_WARRANT_ISSUANCE', 'security_id', undefined],
    ['TX_WARRANT_EXERCISE', 'TX_WARRANT_ISSUANCE', 'security_id', 'resulting_security_ids'],
    ['TX_WARRANT_RETRACTION', 'TX_WARRANT_ISSUANCE', 'security_id', undefined],
    ['TX_WARRANT_TRANSFER', 'TX_WARRANT_ISSUANCE', 'security_id', 'resulting_security_ids'],
  ] as const)(
    'covers terminal transition semantics for %s',
    (transactionType, issuanceType, inputField, outputField) => {
      const rootSecurityId = `${transactionType}-root`;
      const issuance: OcfCapTableSnapshotObject = {
        object_type: issuanceType,
        id: `${transactionType}-issuance`,
        security_id: rootSecurityId,
        ...(issuanceType === 'TX_CONVERTIBLE_ISSUANCE' ? { conversion_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
        ...(issuanceType === 'TX_WARRANT_ISSUANCE' ? { exercise_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
      };
      const transaction: OcfCapTableSnapshotObject = {
        object_type: transactionType,
        id: `${transactionType}-transaction`,
        ...(inputField === 'security_ids' ? { security_ids: [rootSecurityId] } : { security_id: rootSecurityId }),
        ...(outputField === 'resulting_security_ids'
          ? { resulting_security_ids: [`${transactionType}-output`] }
          : outputField === 'resulting_security_id'
            ? { resulting_security_id: `${transactionType}-output` }
            : {}),
        ...(transactionType === 'TX_CONVERTIBLE_CONVERSION' || transactionType === 'TX_WARRANT_EXERCISE'
          ? { trigger_id: 'trigger-1' }
          : {}),
      };

      expect(validateOcfCapTableSnapshot([{ object_type: 'ISSUER', id: 'issuer-1' }, issuance, transaction])).toEqual({
        valid: true,
        issues: [],
      });
    }
  );

  it('tracks cross-family exercise outputs as stock security nodes', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-warrant',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['exercise-stock-result'],
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'accept-exercise-result',
        date: '2025-01-02',
        security_id: 'exercise-stock-result',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('accepts the official schema-valid empty release output representation', () => {
    const release: OcfCapTableSnapshotObject = {
      object_type: 'TX_EQUITY_COMPENSATION_RELEASE',
      id: 'official-empty-release',
      security_id: 'equity-compensation-security-root',
      date: '2017-07-22',
      settlement_date: '2017-07-22',
      quantity: '9000',
      release_price: { amount: '9.00', currency: 'CAD' },
      resulting_security_ids: [],
    };
    const objects = [...completeStockSnapshot(), schemaValidEquityCompensationRoot(), release];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['TX_CONVERTIBLE_CONVERSION', 'TX_CONVERTIBLE_ISSUANCE', { reason_text: 'Conversion', trigger_id: 'trigger-1' }],
    ['TX_STOCK_CONVERSION', 'TX_STOCK_ISSUANCE', { quantity_converted: '1' }],
    ['TX_EQUITY_COMPENSATION_EXERCISE', 'TX_EQUITY_COMPENSATION_ISSUANCE', { quantity: '1' }],
    [
      'TX_EQUITY_COMPENSATION_RELEASE',
      'TX_EQUITY_COMPENSATION_ISSUANCE',
      {
        settlement_date: '2025-01-01',
        release_price: { amount: '1', currency: 'USD' },
        quantity: '1',
      },
    ],
    ['TX_WARRANT_EXERCISE', 'TX_WARRANT_ISSUANCE', { trigger_id: 'trigger-1' }],
    ['TX_STOCK_REISSUANCE', 'TX_STOCK_ISSUANCE', {}],
  ] as const)('accepts schema-valid empty resulting_security_ids for %s', (transactionType, issuanceType, extra) => {
    const transaction: OcfCapTableSnapshotObject = {
      object_type: transactionType,
      id: `${transactionType}-empty-output`,
      date: '2025-01-01',
      security_id: 'root-security',
      resulting_security_ids: [],
      ...extra,
    };
    const issuance: OcfCapTableSnapshotObject = {
      object_type: issuanceType,
      id: `${issuanceType}-root`,
      security_id: 'root-security',
      ...(issuanceType === 'TX_CONVERTIBLE_ISSUANCE' ? { conversion_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
      ...(issuanceType === 'TX_WARRANT_ISSUANCE' ? { exercise_triggers: [{ trigger_id: 'trigger-1' }] } : {}),
    };

    expectSchemaValid([transaction]);
    expect(validateOcfCapTableSnapshot([{ object_type: 'ISSUER', id: 'issuer-1' }, issuance, transaction])).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('treats an empty optional balance_security_id as omitted', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'empty-balance-transfer',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        balance_security_id: '',
        resulting_security_ids: ['stock-result'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('retains schema minItems rules for transfer outputs and consolidation inputs', () => {
    const emptyTransfer: OcfCapTableSnapshotObject = {
      object_type: 'TX_STOCK_TRANSFER',
      id: 'empty-transfer-output',
      date: '2025-01-01',
      security_id: 'security-orphaned',
      quantity: '1',
      resulting_security_ids: [],
    };
    const emptyConsolidation: OcfCapTableSnapshotObject = {
      object_type: 'TX_STOCK_CONSOLIDATION',
      id: 'empty-consolidation-input',
      date: '2025-01-01',
      security_ids: [],
      resulting_security_id: 'consolidated-output',
      reason_text: 'Nothing to consolidate',
    };

    expect(getOcfSchema(emptyTransfer.object_type).safeParse(emptyTransfer).success).toBe(false);
    expect(getOcfSchema(emptyConsolidation.object_type).safeParse(emptyConsolidation).success).toBe(false);
    expect(issueCodes([...completeStockSnapshot(), emptyTransfer, emptyConsolidation])).toEqual([
      'MALFORMED_SECURITY_FIELD',
      'MALFORMED_SECURITY_FIELD',
    ]);
  });

  it('rejects duplicate transition output IDs from schema-valid arrays', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-duplicate-output',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['duplicate-stock-output', 'duplicate-stock-output'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_SECURITY_PRODUCER',
        path: 'resulting_security_ids[0]',
        referenceId: 'duplicate-stock-output',
        producerObjectTypes: ['TX_WARRANT_EXERCISE'],
        count: 2,
      }),
    ]);
  });

  it('rejects duplicate trigger IDs and ambiguous trigger references', () => {
    const warrant = schemaValidWarrantRoot();
    const triggers = warrant.exercise_triggers;
    if (!Array.isArray(triggers) || triggers.length !== 1) throw new Error('Expected one warrant trigger');
    const firstTrigger = triggers[0];
    if (typeof firstTrigger !== 'object' || firstTrigger === null) throw new Error('Expected a warrant trigger object');
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        ...warrant,
        exercise_triggers: [firstTrigger, { ...firstTrigger, nickname: 'Duplicate trigger id' }],
      },
      {
        object_type: 'TX_WARRANT_EXERCISE',
        id: 'exercise-ambiguous-trigger',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        trigger_id: 'warrant1_trigger',
        resulting_security_ids: ['exercise-stock-result'],
      },
    ];

    expectSchemaValid(objects);
    expect(issueCodes(objects)).toEqual(['AMBIGUOUS_TRIGGER', 'DUPLICATE_TRIGGER_ID']);
  });

  it('permits stock-plan rollovers through produced security lineage', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot().map((object) =>
        object.object_type === 'TX_STOCK_ISSUANCE' ? { ...object, stock_plan_id: 'plan-1' } : object
      ),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Original Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-2',
        plan_name: 'Rollover Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'plan-transfer',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        resulting_security_ids: ['plan-stock-result'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-produced-security',
        date: '2025-01-02',
        security_id: 'plan-stock-result',
        stock_plan_id: 'plan-2',
        quantity: '10',
        reason_text: 'Return transferred plan stock',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('allows cancellation and return-to-pool accounting for the same security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot().map((object) =>
        object.object_type === 'TX_STOCK_ISSUANCE' ? { ...object, stock_plan_id: 'plan-1' } : object
      ),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Original Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-2',
        plan_name: 'Rollover Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_CANCELLATION',
        id: 'cancel-plan-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        reason_text: 'Cancelled into rollover',
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-cancelled-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        stock_plan_id: 'plan-2',
        quantity: '10',
        reason_text: 'Return to rollover plan',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('rejects returning a lineage that contains a non-plan issuance', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Synthetic Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'return-non-plan-security',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        stock_plan_id: 'plan-1',
        quantity: '10',
        reason_text: 'Invalid non-plan return',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        objectId: 'return-non-plan-security',
        stockPlanId: 'plan-1',
        securityId: 'security-orphaned',
      }),
    ]);
  });

  it('rejects missing and wrong-family transition inputs while preserving observers', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'observer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
      },
      {
        object_type: 'TX_STOCK_ACCEPTANCE',
        id: 'observer-2',
        date: '2025-01-02',
        security_id: 'security-orphaned',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'missing-input',
        date: '2025-01-03',
        security_id: 'security-missing',
        reason_text: 'Missing source',
      },
      {
        object_type: 'TX_WARRANT_RETRACTION',
        id: 'wrong-family-input',
        date: '2025-01-04',
        security_id: 'security-orphaned',
        reason_text: 'Wrong family',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_SECURITY_REFERENCE',
        objectId: 'missing-input',
        path: 'security_id',
        referenceId: 'security-missing',
      }),
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-input',
        path: 'security_id',
        expectedSecurityFamilies: ['warrant'],
        actualSecurityFamily: 'stock',
      }),
    ]);
  });

  it('does not cascade missing or wrong-family inputs into consumer or cycle diagnostics', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      ...['missing-a', 'missing-b'].map((id) => ({
        object_type: 'TX_STOCK_TRANSFER',
        id,
        date: '2025-01-01',
        security_id: 'missing-security',
        quantity: '1',
        resulting_security_ids: [`${id}-output`],
      })),
      ...['wrong-family-a', 'wrong-family-b'].map((id) => ({
        object_type: 'TX_WARRANT_TRANSFER',
        id,
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '1',
        resulting_security_ids: [`${id}-output`],
      })),
    ];

    expectSchemaValid(objects);
    expect(issueCodes(objects)).toEqual([
      'MISSING_SECURITY_REFERENCE',
      'MISSING_SECURITY_REFERENCE',
      'SECURITY_FAMILY_MISMATCH',
      'SECURITY_FAMILY_MISMATCH',
    ]);
  });

  it('does not run stock-plan semantics for a wrong-family observed security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidWarrantRoot(),
      {
        object_type: 'STOCK_PLAN',
        id: 'plan-1',
        plan_name: 'Synthetic Plan',
        initial_shares_reserved: '1000',
        stock_class_ids: ['stock-class-common'],
      },
      {
        object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
        id: 'wrong-family-return',
        date: '2025-01-01',
        security_id: 'warrant-security-root',
        stock_plan_id: 'plan-1',
        quantity: '1',
        reason_text: 'Invalid warrant return',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-return',
        expectedSecurityFamilies: ['stock', 'equity-compensation'],
        actualSecurityFamily: 'warrant',
      }),
    ]);
  });

  it('does not run vesting semantics for a wrong-family observed security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      schemaValidConvertibleRoot(),
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'wrong-family-vesting-event',
        date: '2025-01-01',
        security_id: 'convertible-security-root',
        vesting_condition_id: 'condition-1',
        comments: [],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-vesting-event',
        expectedSecurityFamilies: ['stock', 'warrant', 'equity-compensation'],
        actualSecurityFamily: 'convertible',
      }),
    ]);
  });

  it('does not validate triggers after a cross-family transition input mismatch', () => {
    const convertible = schemaValidConvertibleRoot();
    const trigger = convertible.conversion_triggers;
    if (!Array.isArray(trigger) || typeof trigger[0] !== 'object' || trigger[0] === null) {
      throw new Error('Expected a convertible trigger fixture');
    }
    const triggerId = trigger[0].trigger_id;
    if (typeof triggerId !== 'string') throw new Error('Expected a convertible trigger id');
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      convertible,
      {
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        id: 'valid-conversion',
        date: '2025-01-01',
        security_id: 'convertible-security-root',
        trigger_id: triggerId,
        reason_text: 'Valid first conversion',
        resulting_security_ids: ['converted-stock'],
      },
      {
        object_type: 'TX_CONVERTIBLE_CONVERSION',
        id: 'wrong-family-conversion',
        date: '2025-01-02',
        security_id: 'converted-stock',
        trigger_id: 'missing-trigger-that-must-not-be-checked',
        reason_text: 'Invalid second conversion',
        resulting_security_ids: ['invalid-output'],
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_FAMILY_MISMATCH',
        objectId: 'wrong-family-conversion',
        expectedSecurityFamilies: ['convertible'],
        actualSecurityFamily: 'stock',
      }),
    ]);
  });

  it('does not consume a valid item from a malformed many-input container', () => {
    const result = validateOcfCapTableSnapshot([
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'mixed-consolidation',
        security_ids: ['security-orphaned', 42],
        resulting_security_id: 'mixed-output',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'valid-consumer',
        security_id: 'security-orphaned',
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MALFORMED_SECURITY_FIELD',
        objectId: 'mixed-consolidation',
        path: 'security_ids[1]',
      }),
    ]);
  });

  it('rejects duplicate producers without cascading consumer diagnostics', () => {
    const originalIssuance = orphanedSnapshot.find((object) => object.object_type === 'TX_STOCK_ISSUANCE');
    expect(originalIssuance).toBeDefined();
    if (originalIssuance === undefined) throw new Error('Synthetic stock issuance fixture is missing');
    const secondIssuance = {
      ...originalIssuance,
      id: 'stock-issuance-second',
      security_id: 'security-second',
    };
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      secondIssuance,
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'producer-1',
        date: '2025-01-01',
        security_id: 'security-orphaned',
        quantity: '10',
        resulting_security_ids: ['duplicate-output'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'producer-2',
        date: '2025-01-01',
        security_id: 'security-second',
        quantity: '10',
        resulting_security_ids: ['duplicate-output'],
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-1',
        date: '2025-01-02',
        security_id: 'duplicate-output',
        reason_text: 'First terminal consumer',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-2',
        date: '2025-01-03',
        security_id: 'duplicate-output',
        reason_text: 'Second terminal consumer',
      },
    ];

    expectSchemaValid(objects);
    const result = validateOcfCapTableSnapshot(objects);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'AMBIGUOUS_SECURITY_REFERENCE',
      'AMBIGUOUS_SECURITY_REFERENCE',
      'DUPLICATE_SECURITY_PRODUCER',
    ]);
    expect(result.issues.filter((issue) => issue.code === 'AMBIGUOUS_SECURITY_REFERENCE')).toEqual([
      expect.objectContaining({
        expectedSecurityFamilies: ['stock'],
        producerObjectTypes: ['TX_STOCK_TRANSFER'],
      }),
      expect.objectContaining({
        expectedSecurityFamilies: ['stock'],
        producerObjectTypes: ['TX_STOCK_TRANSFER'],
      }),
    ]);
  });

  it('rejects multiple terminal consumers of one uniquely produced security', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-1',
        date: '2025-01-02',
        security_id: 'security-orphaned',
        reason_text: 'First terminal consumer',
      },
      {
        object_type: 'TX_STOCK_RETRACTION',
        id: 'consumer-2',
        date: '2025-01-03',
        security_id: 'security-orphaned',
        reason_text: 'Second terminal consumer',
      },
    ];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MULTIPLE_SECURITY_CONSUMERS',
        referenceId: 'security-orphaned',
        consumerObjectTypes: ['TX_STOCK_RETRACTION'],
        count: 2,
      }),
    ]);
  });

  it('rejects self-contained security-lineage cycles deterministically', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const objects: OcfCapTableSnapshotObject[] = [
      issuer as OcfCapTableSnapshotObject,
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'cycle-a',
        date: '2025-01-01',
        security_id: 'security-a',
        quantity: '1',
        resulting_security_ids: ['security-b'],
      },
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'cycle-b',
        date: '2025-01-02',
        security_id: 'security-b',
        quantity: '1',
        resulting_security_ids: ['security-a'],
      },
    ];

    expectSchemaValid(objects);
    const forward = validateOcfCapTableSnapshot(objects);
    const reverse = validateOcfCapTableSnapshot([...objects].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.issues).toEqual([
      expect.objectContaining({
        code: 'SECURITY_LINEAGE_CYCLE',
        referenceId: 'security-a',
        cycleIds: ['security-a', 'security-b'],
      }),
    ]);
  });

  it('validates long security lineages with repeated root-dependent observers', () => {
    const transitionCount = 15_000;
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      {
        object_type: 'VESTING_TERMS',
        id: 'vesting-terms',
        vesting_conditions: [{ id: 'condition', trigger: { type: 'VESTING_EVENT' } }],
      },
      {
        object_type: 'TX_STOCK_ISSUANCE',
        id: 'root-issuance',
        security_id: 'security-0',
        vesting_terms_id: 'vesting-terms',
      },
      ...Array.from({ length: transitionCount }, (_, index) => ({
        object_type: 'TX_STOCK_TRANSFER',
        id: `transfer-${String(index).padStart(5, '0')}`,
        security_id: `security-${index}`,
        resulting_security_ids: [`security-${index + 1}`],
      })),
      ...Array.from({ length: transitionCount + 1 }, (_, index) => ({
        object_type: 'TX_VESTING_EVENT',
        id: `vesting-event-${String(index).padStart(5, '0')}`,
        security_id: `security-${index}`,
        vesting_condition_id: 'condition',
      })),
    ];

    expect(validateOcfCapTableSnapshot(objects)).toEqual({ valid: true, issues: [] });
  });

  it('validates cumulative consolidation lineage without materializing every root list', () => {
    const rootCount = 8_000;
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      ...Array.from({ length: rootCount }, (_, index) => ({
        object_type: 'VESTING_TERMS',
        id: `vesting-${String(index).padStart(5, '0')}`,
        vesting_conditions: [],
      })),
      ...Array.from({ length: rootCount }, (_, index) => ({
        object_type: 'TX_STOCK_ISSUANCE',
        id: `issuance-${String(index).padStart(5, '0')}`,
        security_id: `root-security-${index}`,
        vesting_terms_id: `vesting-${String(index).padStart(5, '0')}`,
      })),
      ...Array.from({ length: rootCount - 1 }, (_, offset) => {
        const index = offset + 1;
        return {
          object_type: 'TX_STOCK_CONSOLIDATION',
          id: `consolidation-${String(index).padStart(5, '0')}`,
          security_ids: [index === 1 ? 'root-security-0' : `consolidated-${index - 1}`, `root-security-${index}`],
          resulting_security_id: `consolidated-${index}`,
        };
      }),
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'final-vesting-event',
        security_id: `consolidated-${rootCount - 1}`,
        vesting_condition_id: 'condition',
      },
    ];

    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_VESTING_TERMS',
        witnessVestingTermsIds: ['vesting-00000', 'vesting-00001'],
      }),
    ]);
  });

  it('reports deterministic exemplar vesting terms for a lineage with three roots', () => {
    const objects: OcfCapTableSnapshotObject[] = [
      { object_type: 'ISSUER', id: 'issuer-1' },
      ...['vesting-c', 'vesting-a', 'vesting-b'].map((id) => ({
        object_type: 'VESTING_TERMS',
        id,
        vesting_conditions: [],
      })),
      ...[
        ['security-c', 'vesting-c'],
        ['security-a', 'vesting-a'],
        ['security-b', 'vesting-b'],
      ].map(([securityId, vestingTermsId]) => ({
        object_type: 'TX_STOCK_ISSUANCE',
        id: `issuance-${securityId}`,
        security_id: securityId,
        vesting_terms_id: vestingTermsId,
      })),
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'consolidation-ca',
        security_ids: ['security-c', 'security-a'],
        resulting_security_id: 'security-ca',
      },
      {
        object_type: 'TX_STOCK_CONSOLIDATION',
        id: 'consolidation-cab',
        security_ids: ['security-ca', 'security-b'],
        resulting_security_id: 'security-cab',
      },
      {
        object_type: 'TX_VESTING_EVENT',
        id: 'ambiguous-vesting-event',
        security_id: 'security-cab',
        vesting_condition_id: 'condition',
      },
    ];

    const result = validateOcfCapTableSnapshot(objects);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_VESTING_TERMS',
        securityId: 'security-cab',
        witnessVestingTermsIds: ['vesting-a', 'vesting-b'],
      }),
    ]);
    const issue = result.issues[0];
    expect(issue).not.toHaveProperty('count');
    expect(Object.isFrozen(issue)).toBe(true);
    if (issue?.code === 'AMBIGUOUS_VESTING_TERMS') {
      expect(Object.isFrozen(issue.witnessVestingTermsIds)).toBe(true);
    }
  });

  it('reports malformed transition output containers with exact paths', () => {
    const result = validateOcfCapTableSnapshot([
      ...completeStockSnapshot(),
      {
        object_type: 'TX_STOCK_TRANSFER',
        id: 'malformed-output',
        security_id: 'security-orphaned',
        resulting_security_ids: ['valid-output', 42, ''],
        balance_security_id: null,
      },
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MALFORMED_SECURITY_FIELD',
        objectId: 'malformed-output',
        path: 'balance_security_id',
      }),
      expect.objectContaining({
        code: 'MALFORMED_SECURITY_FIELD',
        objectId: 'malformed-output',
        path: 'resulting_security_ids[1]',
      }),
      expect.objectContaining({
        code: 'MALFORMED_SECURITY_FIELD',
        objectId: 'malformed-output',
        path: 'resulting_security_ids[2]',
      }),
    ]);
  });

  it('reports each canonical object type once for a duplicate security id', () => {
    const result = validateOcfCapTableSnapshot([
      { object_type: 'ISSUER', id: 'issuer-1' },
      { object_type: 'TX_STOCK_ISSUANCE', id: 'stock-1', security_id: 'duplicate-security' },
      { object_type: 'TX_STOCK_ISSUANCE', id: 'stock-2', security_id: 'duplicate-security' },
    ]);

    expect(result.issues.find((issue) => issue.code === 'DUPLICATE_SECURITY_PRODUCER')).toEqual(
      expect.objectContaining({
        producerObjectTypes: ['TX_STOCK_ISSUANCE'],
        count: 2,
      })
    );
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
        code: 'MISSING_VESTING_TERMS',
        objectId: 'vesting-start-1',
        path: 'security_id.vesting_terms_id',
        targetObjectTypes: ['VESTING_TERMS'],
      }),
    ]);
  });

  it('rejects duplicate, dangling, and self-referencing vesting conditions after schema validation', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-graph-invalid',
      name: 'Invalid graph',
      description: 'Schema-valid but structurally invalid',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'duplicate-condition',
          quantity: '1',
          trigger: { type: 'VESTING_START_DATE' },
          next_condition_ids: ['duplicate-condition', 'missing-condition'],
        },
        {
          id: 'duplicate-condition',
          quantity: '1',
          trigger: { type: 'VESTING_EVENT' },
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_VESTING_CONDITION_ID',
        objectId: 'vesting-graph-invalid',
        referenceId: 'duplicate-condition',
        count: 2,
      }),
      expect.objectContaining({
        code: 'MISSING_VESTING_CONDITION',
        path: 'vesting_conditions[0].next_condition_ids[1]',
        referenceId: 'missing-condition',
      }),
      expect.objectContaining({
        code: 'SELF_VESTING_CONDITION_REFERENCE',
        path: 'vesting_conditions[0].next_condition_ids[0]',
        referenceId: 'duplicate-condition',
      }),
    ]);
  });

  it('detects cycles across next-condition and relative-trigger dependency edges', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-graph-cycle',
      name: 'Cyclic graph',
      description: 'Mixed dependency cycle',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition-a',
          quantity: '1',
          trigger: {
            type: 'VESTING_SCHEDULE_RELATIVE',
            period: { type: 'DAYS', length: 30, occurrences: 1 },
            relative_to_condition_id: 'condition-b',
          },
          next_condition_ids: ['condition-b'],
        },
        {
          id: 'condition-b',
          quantity: '1',
          trigger: { type: 'VESTING_EVENT' },
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'VESTING_CONDITION_CYCLE',
        objectId: 'vesting-graph-cycle',
        referenceId: 'condition-a',
        cycleIds: ['condition-a', 'condition-b'],
      }),
    ]);
  });

  it('rejects dangling and self-relative vesting trigger references', () => {
    const issuer = orphanedSnapshot.find((object) => object.object_type === 'ISSUER');
    expect(issuer).toBeDefined();
    const relativeTrigger = (relativeToConditionId: string) => ({
      type: 'VESTING_SCHEDULE_RELATIVE',
      period: { type: 'DAYS', length: 30, occurrences: 1 },
      relative_to_condition_id: relativeToConditionId,
    });
    const vestingTerms: OcfCapTableSnapshotObject = {
      object_type: 'VESTING_TERMS',
      id: 'vesting-relative-invalid',
      name: 'Invalid relative graph',
      description: 'Bad relative references',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [
        {
          id: 'condition-self',
          quantity: '1',
          trigger: relativeTrigger('condition-self'),
          next_condition_ids: [],
        },
        {
          id: 'condition-missing',
          quantity: '1',
          trigger: relativeTrigger('not-present'),
          next_condition_ids: [],
        },
      ],
    };
    const objects = [issuer as OcfCapTableSnapshotObject, vestingTerms];

    expectSchemaValid(objects);
    expect(validateOcfCapTableSnapshot(objects).issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_VESTING_CONDITION',
        path: 'vesting_conditions[1].trigger.relative_to_condition_id',
        referenceId: 'not-present',
      }),
      expect.objectContaining({
        code: 'SELF_VESTING_CONDITION_REFERENCE',
        path: 'vesting_conditions[0].trigger.relative_to_condition_id',
        referenceId: 'condition-self',
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
