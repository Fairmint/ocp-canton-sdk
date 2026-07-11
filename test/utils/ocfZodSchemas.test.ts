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
    const fixture = stripSourceMetadata(loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual'));
    const parsed = parseOcfObject(fixture);

    expect(parsed.object_type).toBe('STAKEHOLDER');
    expect(parsed.id).toBe(fixture.id);
  });

  it('rejects unknown fields with strict validation', () => {
    const fixture = stripSourceMetadata(loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual'));
    const invalidFixture = {
      ...fixture,
      __unexpected_field: 'not allowed',
    };

    const parseInvalid = () => parseOcfObject(invalidFixture);
    expect(parseInvalid).toThrow(OcpValidationError);
    expect(parseInvalid).toThrow('__unexpected_field');
  });

  describe('typed document location normalization', () => {
    const documentBase = {
      object_type: 'DOCUMENT',
      id: 'document-1',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
    } as const;

    it.each([
      {
        activeLocation: 'path',
        inactiveLocation: 'uri',
        input: { ...documentBase, path: './agreement.pdf', uri: null },
      },
      {
        activeLocation: 'uri',
        inactiveLocation: 'path',
        input: { ...documentBase, path: null, uri: 'https://example.com/agreement.pdf' },
      },
    ] as const)(
      'normalizes a null inactive $inactiveLocation before validating the active $activeLocation',
      ({ activeLocation, inactiveLocation, input }) => {
        const parsed = parseOcfEntityInput('document', input) as Record<string, unknown>;

        expect(parsed[activeLocation]).toBe(input[activeLocation]);
        expect(inactiveLocation in parsed).toBe(false);
        expect(input[inactiveLocation]).toBeNull();
      }
    );

    it.each([
      ['both locations omitted', documentBase],
      ['both locations null', { ...documentBase, path: null, uri: null }],
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
    ])('keeps raw OCF parsing schema-faithful for %s', (_case, input) => {
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
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-nso')
    );
    const malformedFixture: Record<string, unknown> = {
      ...fixture,
      plan_security_type: 'OPTION',
    };

    expect(() => parseOcfObject(malformedFixture)).toThrow('plan_security_type');
  });

  it('rejects an unsupported stakeholder status object_type before inspecting its fields', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));
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
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );

    expect(() =>
      parseOcfObject({
        ...fixture,
        new_relationships: ['ADVISOR'],
      })
    ).toThrow('new_relationships');
  });

  it('rejects non-schema reason_text instead of rewriting it', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    expect(() =>
      parseOcfObject({
        ...fixture,
        reason_text: 'Non-schema reason',
      })
    ).toThrow('reason_text');
  });

  it('parses the canonical stock consolidation resulting_security_id field', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stockConsolidation'));
    const parsed = parseOcfEntityInput('stockConsolidation', fixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.resulting_security_id).toBe('test-security-consolidated-result-001');
  });

  it('rejects stock consolidation legacy resulting_security_ids field', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stockConsolidation'));
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      resulting_security_ids: [fixture.resulting_security_id],
    };
    delete legacyFixture.resulting_security_id;

    expect(() => parseOcfEntityInput('stockConsolidation', legacyFixture)).toThrow(OcpValidationError);
    expect(() => parseOcfEntityInput('stockConsolidation', legacyFixture)).toThrow('resulting_security_ids');
  });

  it('rejects entity/object_type mismatches', () => {
    const stakeholderFixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual')
    );

    const parseMismatched = () => parseOcfEntityInput('stockIssuance', stakeholderFixture);
    expect(parseMismatched).toThrow(OcpValidationError);
    expect(parseMismatched).toThrow('expects object_type "TX_STOCK_ISSUANCE"');
  });

  it('typed parsing accepts the exact canonical object_type', () => {
    const sourceFixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso')
    );
    const { option_grant_type: _, ...fixture } = sourceFixture;

    const parsed = parseOcfEntityInput('equityCompensationIssuance', fixture);

    expect(parsed.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
  });

  it('typed parsing rejects a missing object_type', () => {
    const fixture = stripSourceMetadata(loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual'));
    const { object_type: _, ...withoutObjectType } = fixture;

    const parseMissing = () => parseOcfEntityInput('stakeholder', withoutObjectType);
    expect(parseMissing).toThrow(OcpValidationError);
    expect(parseMissing).toThrow('Required field is missing or invalid');
  });

  it('typed parsing rejects legacy object_type aliases', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso')
    );
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
    };

    const parseLegacy = () => parseOcfEntityInput('equityCompensationIssuance', legacyFixture);
    expect(parseLegacy).toThrow(OcpValidationError);
    expect(parseLegacy).toThrow('expects object_type "TX_EQUITY_COMPENSATION_ISSUANCE"');
  });
});
