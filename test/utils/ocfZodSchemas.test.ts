import { OcpValidationError } from '../../src/errors';
import {
  ENTITY_OBJECT_TYPE_MAP,
  ENTITY_REGISTRY,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { parseOcfEntityInput, parseOcfObject, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';
import { requireDefined } from '../../src/utils/requireDefined';
import { loadProductionFixture, loadSyntheticFixture, stripSourceMetadata } from './productionFixtures';

const schemaAvailabilityError = (() => {
  try {
    resolveOcfSchemaDir();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
})();

function toRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function captureValidationError(parse: () => unknown): OcpValidationError {
  try {
    parse();
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    return error as OcpValidationError;
  }

  throw new Error('Expected parsing to throw OcpValidationError');
}

function defineEnumerableOwnProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): Record<string, unknown> {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  return target;
}

const entityTypes = Object.keys(ENTITY_REGISTRY) as OcfEntityType[];
const entityDiscriminatorCases = entityTypes.map((entityType, index) => {
  const mismatchedEntityType = entityTypes[(index + 1) % entityTypes.length];
  return {
    entityType,
    expectedObjectType: ENTITY_OBJECT_TYPE_MAP[entityType],
    mismatchedObjectType:
      ENTITY_OBJECT_TYPE_MAP[requireDefined(mismatchedEntityType, `mismatched entity type for ${entityType}`)],
  };
});

const retiredPlanSecurityObjectTypes = [
  'TX_PLAN_SECURITY_ACCEPTANCE',
  'TX_PLAN_SECURITY_CANCELLATION',
  'TX_PLAN_SECURITY_EXERCISE',
  'TX_PLAN_SECURITY_ISSUANCE',
  'TX_PLAN_SECURITY_RELEASE',
  'TX_PLAN_SECURITY_RETRACTION',
  'TX_PLAN_SECURITY_TRANSFER',
] as const;

describe('ocfZodSchemas', () => {
  beforeAll(() => {
    if (schemaAvailabilityError) {
      throw schemaAvailabilityError;
    }
  });

  it('parses strict source-of-truth OCF objects', () => {
    const fixture = stripSourceMetadata(loadProductionFixture('stakeholder', 'individual'));
    const parsed = parseOcfObject(fixture);

    expect(parsed.object_type).toBe('STAKEHOLDER');
    expect(parsed.id).toBe(fixture.id);
  });

  it('rejects unknown fields with strict validation', () => {
    const fixture = stripSourceMetadata(loadProductionFixture('stakeholder', 'individual'));
    const invalidFixture = {
      ...fixture,
      __unexpected_field: 'not allowed',
    };

    const parseInvalid = () => parseOcfObject(invalidFixture);
    expect(parseInvalid).toThrow(OcpValidationError);
    expect(parseInvalid).toThrow('__unexpected_field');
  });

  describe('strict top-level own-key validation', () => {
    const canonicalStakeholder = {
      object_type: 'STAKEHOLDER',
      id: 'strict-own-key-stakeholder',
      name: { legal_name: 'Strict Own Key' },
      stakeholder_type: 'INDIVIDUAL',
    } as const;

    it('preserves canonical output for a valid null-prototype input', () => {
      const input = Object.assign(Object.create(null) as Record<string, unknown>, canonicalStakeholder);

      const raw = parseOcfObject(input);
      const typed = parseOcfEntityInput('stakeholder', input);

      expect(raw).toEqual(canonicalStakeholder);
      expect(typed).toEqual(canonicalStakeholder);
      expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(typed)).toBe(Object.prototype);
    });

    it.each([
      { label: 'ordinary object', prototype: Object.prototype },
      { label: 'null-prototype object', prototype: null },
    ])('rejects a defineProperty __proto__ key on a $label before it can be stripped', ({ prototype }) => {
      const input = defineEnumerableOwnProperty(
        Object.assign(Object.create(prototype) as Record<string, unknown>, canonicalStakeholder),
        '__proto__',
        { polluted: true }
      );

      for (const parse of [() => parseOcfObject(input), () => parseOcfEntityInput('stakeholder', input)]) {
        const error = captureValidationError(parse);

        expect(error.fieldPath).toBe('__proto__');
        expect(error.message).toContain('additional properties');
      }

      expect(Object.prototype.hasOwnProperty.call(input, '__proto__')).toBe(true);
      expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    });

    it.each(['constructor', 'prototype', '__unexpected_field'])(
      'rejects the top-level unknown own key %s with its exact path',
      (key) => {
        const input = defineEnumerableOwnProperty({ ...canonicalStakeholder }, key, 'not allowed');

        expect(captureValidationError(() => parseOcfObject(input)).fieldPath).toBe(key);
        expect(captureValidationError(() => parseOcfEntityInput('stakeholder', input)).fieldPath).toBe(key);
      }
    );

    it('rejects a nested defineProperty __proto__ key with its exact path', () => {
      const name = defineEnumerableOwnProperty(
        Object.assign(Object.create(null) as Record<string, unknown>, { legal_name: 'Nested Strict Own Key' }),
        '__proto__',
        { polluted: true }
      );
      const input = { ...canonicalStakeholder, name };

      expect(captureValidationError(() => parseOcfObject(input)).fieldPath).toBe('name.__proto__');
      expect(captureValidationError(() => parseOcfEntityInput('stakeholder', input)).fieldPath).toBe('name.__proto__');
      expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    });

    it('rejects accessors before schema validation without invoking them', () => {
      const getter = jest.fn(() => {
        throw new Error('accessor must not run');
      });
      const input = { ...canonicalStakeholder } as Record<string, unknown>;
      Object.defineProperty(input, '__unexpected_accessor', {
        configurable: true,
        enumerable: true,
        get: getter,
      });

      expect(captureValidationError(() => parseOcfObject(input)).classification).toBe('invalid_ocf_json');
      expect(captureValidationError(() => parseOcfEntityInput('stakeholder', input)).classification).toBe(
        'invalid_ocf_json'
      );
      expect(getter).not.toHaveBeenCalled();
    });

    it('rejects proxies before schema validation without invoking reflection traps', () => {
      const ownKeys = jest.fn(() => {
        throw new Error('proxy ownKeys trap must not run');
      });
      const getPrototypeOf = jest.fn(() => {
        throw new Error('proxy getPrototypeOf trap must not run');
      });
      const input = new Proxy({ ...canonicalStakeholder }, { getPrototypeOf, ownKeys });

      expect(captureValidationError(() => parseOcfObject(input)).classification).toBe('invalid_ocf_json');
      expect(captureValidationError(() => parseOcfEntityInput('stakeholder', input)).classification).toBe(
        'invalid_ocf_json'
      );
      expect(ownKeys).not.toHaveBeenCalled();
      expect(getPrototypeOf).not.toHaveBeenCalled();
    });
  });

  describe('stock plan alias boundary', () => {
    const legacyStockPlan = {
      object_type: 'STOCK_PLAN',
      id: 'legacy-stock-plan',
      plan_name: 'Legacy Plan',
      initial_shares_reserved: '1000',
      stock_class_id: 'stock-class-1',
    };

    it('keeps legacy normalization available at the raw ingestion boundary', () => {
      expect(parseOcfObject(legacyStockPlan)).toMatchObject({
        stock_class_ids: ['stock-class-1'],
      });
    });

    it('rejects the legacy singular key at the typed entity boundary before normalization', () => {
      expect(captureValidationError(() => parseOcfEntityInput('stockPlan', legacyStockPlan))).toMatchObject({
        code: 'INVALID_FORMAT',
        fieldPath: 'stock_class_id',
        expectedType: 'stock_class_ids: [string, ...string[]]',
        receivedValue: 'stock-class-1',
      });
    });
  });

  describe('canonical typed document locations', () => {
    const documentBase = {
      object_type: 'DOCUMENT',
      id: 'document-1',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
    } as const;

    it.each([
      ['both locations omitted', documentBase],
      ['both locations null', { ...documentBase, path: null, uri: null }],
      ['path with a null uri', { ...documentBase, path: './agreement.pdf', uri: null }],
      ['uri with a null path', { ...documentBase, path: null, uri: 'https://example.com/agreement.pdf' }],
      [
        'both locations populated',
        { ...documentBase, path: './agreement.pdf', uri: 'https://example.com/agreement.pdf' },
      ],
    ])('rejects %s at the typed entity boundary', (_case, input) => {
      expect(() => parseOcfEntityInput('document', input)).toThrow(OcpValidationError);
    });

    it.each([
      ['path with a null uri', { ...documentBase, path: './agreement.pdf', uri: null }],
      ['uri with a null path', { ...documentBase, path: null, uri: 'https://example.com/agreement.pdf' }],
    ])('also keeps raw OCF parsing schema-faithful for %s', (_case, input) => {
      expect(() => parseOcfObject(input)).toThrow(OcpValidationError);
    });
  });

  describe('typed entity discriminator preflight', () => {
    it('derives one unique canonical discriminator for every registry entry', () => {
      expect(entityDiscriminatorCases).toHaveLength(entityTypes.length);
      expect(new Set(entityDiscriminatorCases.map(({ expectedObjectType }) => expectedObjectType)).size).toBe(
        entityTypes.length
      );
    });

    it.each(entityDiscriminatorCases)(
      'rejects missing object_type for $entityType before schema validation',
      ({ entityType, expectedObjectType }) => {
        const error = captureValidationError(() => parseOcfEntityInput(entityType, { id: 'preflight-id' }));

        expect(error.fieldPath).toBe('object_type');
        expect(error.expectedType).toBe(expectedObjectType);
        expect(error.receivedValue).toBeUndefined();
      }
    );

    it.each(entityDiscriminatorCases)(
      'rejects mismatched object_type for $entityType before schema validation',
      ({ entityType, expectedObjectType, mismatchedObjectType }) => {
        const error = captureValidationError(() =>
          parseOcfEntityInput(entityType, {
            object_type: mismatchedObjectType,
          })
        );

        expect(error.fieldPath).toBe('object_type');
        expect(error.expectedType).toBe(expectedObjectType);
        expect(error.receivedValue).toBe(mismatchedObjectType);
        expect(error.message).toContain(`Entity type "${entityType}" expects object_type "${expectedObjectType}"`);
      }
    );

    it.each(entityDiscriminatorCases)(
      'accepts the exact object_type preflight for $entityType',
      ({ entityType, expectedObjectType }) => {
        try {
          const parsed = parseOcfEntityInput(entityType, { object_type: expectedObjectType });
          expect(parsed.object_type).toBe(expectedObjectType);
        } catch (error) {
          expect(error).toBeInstanceOf(OcpValidationError);
          expect((error as OcpValidationError).fieldPath).not.toBe('object_type');
          expect((error as Error).message).not.toContain('expects object_type');
        }
      }
    );
  });

  it.each(retiredPlanSecurityObjectTypes)('rejects retired PlanSecurity object type %s', (objectType) => {
    const error = captureValidationError(() => parseOcfObject({ object_type: objectType }));

    expect(error.fieldPath).toBe('object_type');
    expect(error.code).toBe('UNKNOWN_ENUM_VALUE');
    expect(error.receivedValue).toBe(objectType);
  });

  it('rejects non-schema plan_security_type on canonical equity compensation issuances', () => {
    const fixture = stripSourceMetadata(loadProductionFixture('equityCompensationIssuance', 'option-nso'));
    const malformedFixture: Record<string, unknown> = {
      ...fixture,
      plan_security_type: 'OPTION',
    };

    expect(() => parseOcfObject(malformedFixture)).toThrow('plan_security_type');
  });

  it('rejects an unsupported stakeholder status object_type before inspecting its fields', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture('stakeholderStatusChangeEvent'));
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      reason_text: 'Legacy reason',
    };

    const error = captureValidationError(() => parseOcfObject(legacyFixture));

    expect(error.fieldPath).toBe('object_type');
    expect(error.code).toBe('UNKNOWN_ENUM_VALUE');
    expect(error.receivedValue).toBe('TX_STAKEHOLDER_STATUS_CHANGE_EVENT');
  });

  it.each(['TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT', 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT'])(
    'rejects the non-schema stakeholder event name %s',
    (objectType) => {
      const error = captureValidationError(() =>
        parseOcfObject({
          object_type: objectType,
          id: 'event-1',
          date: '2024-01-15',
          stakeholder_id: 'stakeholder-1',
        })
      );

      expect(error.fieldPath).toBe('object_type');
      expect(error.code).toBe('UNKNOWN_ENUM_VALUE');
      expect(error.receivedValue).toBe(objectType);
    }
  );

  it('rejects non-schema new_relationships instead of rewriting it', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture('stakeholderRelationshipChangeEvent'));

    expect(() =>
      parseOcfObject({
        ...fixture,
        new_relationships: ['ADVISOR'],
      })
    ).toThrow('new_relationships');
  });

  it('rejects non-schema reason_text instead of rewriting it', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture('stakeholderStatusChangeEvent'));

    expect(() =>
      parseOcfObject({
        ...fixture,
        reason_text: 'Non-schema reason',
      })
    ).toThrow('reason_text');
  });

  it('parses the canonical stock consolidation resulting_security_id field', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture('stockConsolidation'));
    const parsed = parseOcfEntityInput('stockConsolidation', fixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.resulting_security_id).toBe('test-security-consolidated-result-001');
  });

  it('rejects stock consolidation legacy resulting_security_ids field', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture('stockConsolidation'));
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      resulting_security_ids: [fixture.resulting_security_id],
    };
    delete legacyFixture.resulting_security_id;

    expect(() => parseOcfEntityInput('stockConsolidation', legacyFixture)).toThrow(OcpValidationError);
    expect(() => parseOcfEntityInput('stockConsolidation', legacyFixture)).toThrow('resulting_security_ids');
  });

  it('rejects entity/object_type mismatches', () => {
    const stakeholderFixture = stripSourceMetadata(loadProductionFixture('stakeholder', 'individual'));

    const parseMismatched = () => parseOcfEntityInput('stockIssuance', stakeholderFixture);
    expect(parseMismatched).toThrow(OcpValidationError);
    expect(parseMismatched).toThrow('expects object_type "TX_STOCK_ISSUANCE"');
  });

  it('typed parsing accepts the exact canonical object_type', () => {
    const sourceFixture = stripSourceMetadata(loadProductionFixture('equityCompensationIssuance', 'option-iso'));
    const { option_grant_type: _, ...fixture } = sourceFixture;

    const parsed = parseOcfEntityInput('equityCompensationIssuance', fixture);

    expect(parsed.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
  });

  it('delegates conversion-right mechanism compatibility to the specialized pinned schema', () => {
    const fixture = stripSourceMetadata(loadProductionFixture<Record<string, unknown>>('warrantIssuance'));
    const trigger = {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'specialized-schema-trigger',
      conversion_right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        // SAFE is canonical for convertibles but deliberately absent from the pinned WarrantConversionRight schema.
        conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
      },
    };

    expect(() => parseOcfObject({ ...fixture, exercise_triggers: [trigger] })).toThrow(OcpValidationError);
  });

  it('typed parsing rejects a missing object_type', () => {
    const fixture = stripSourceMetadata(loadProductionFixture('stakeholder', 'individual'));
    const { object_type: _, ...withoutObjectType } = fixture;

    const parseMissing = () => parseOcfEntityInput('stakeholder', withoutObjectType);
    expect(parseMissing).toThrow(OcpValidationError);
    expect(parseMissing).toThrow('Required field is missing or invalid');
  });

  it('typed parsing rejects legacy object_type aliases', () => {
    const fixture = stripSourceMetadata(loadProductionFixture('equityCompensationIssuance', 'option-iso'));
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
    };

    const parseLegacy = () => parseOcfEntityInput('equityCompensationIssuance', legacyFixture);
    expect(parseLegacy).toThrow(OcpValidationError);
    expect(parseLegacy).toThrow('expects object_type "TX_EQUITY_COMPENSATION_ISSUANCE"');
  });
});
