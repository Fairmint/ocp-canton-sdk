import { OcpValidationError } from '../../src/errors';
import {
  ENTITY_OBJECT_TYPE_MAP,
  ENTITY_REGISTRY,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { parseOcfEntityInput, parseOcfObject, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';
import { PLAN_SECURITY_OBJECT_TYPE_MAP, type PlanSecurityObjectType } from '../../src/utils/planSecurityAliases';
import { ZERO_UUID } from '../../src/utils/zeroUuidNormalization';
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
    mismatchedObjectType: ENTITY_OBJECT_TYPE_MAP[mismatchedEntityType],
  };
});

const PLAN_SECURITY_FIXTURE_LOADERS = {
  TX_PLAN_SECURITY_ACCEPTANCE: () => loadSyntheticFixture<Record<string, unknown>>('equityCompensationAcceptance'),
  TX_PLAN_SECURITY_CANCELLATION: () => loadProductionFixture<Record<string, unknown>>('equityCompensationCancellation'),
  TX_PLAN_SECURITY_EXERCISE: () => loadProductionFixture<Record<string, unknown>>('equityCompensationExercise'),
  TX_PLAN_SECURITY_ISSUANCE: () =>
    loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso'),
  TX_PLAN_SECURITY_RELEASE: () => loadSyntheticFixture<Record<string, unknown>>('equityCompensationRelease'),
  TX_PLAN_SECURITY_RETRACTION: () => loadSyntheticFixture<Record<string, unknown>>('equityCompensationRetraction'),
  TX_PLAN_SECURITY_TRANSFER: () => loadSyntheticFixture<Record<string, unknown>>('equityCompensationTransfer'),
} satisfies Record<PlanSecurityObjectType, () => Record<string, unknown>>;

const planSecurityObjectTypes = Object.keys(PLAN_SECURITY_OBJECT_TYPE_MAP) as PlanSecurityObjectType[];
const planSecurityDiscriminatorCases = planSecurityObjectTypes.map((sourceObjectType) => ({
  sourceObjectType,
  canonicalObjectType: PLAN_SECURITY_OBJECT_TYPE_MAP[sourceObjectType],
  fixture: PLAN_SECURITY_FIXTURE_LOADERS[sourceObjectType],
}));

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

  it('normalizes an optional zero-UUID vesting reference before schema validation', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('stockIssuance', 'with-vesting')
    );

    const parsed = parseOcfEntityInput('stockIssuance', {
      ...fixture,
      vesting_terms_id: ZERO_UUID,
    });

    expect(parsed).not.toHaveProperty('vesting_terms_id');
  });

  it('rejects a required id containing the zero-UUID sentinel as missing', () => {
    const fixture = stripSourceMetadata(loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual'));
    const error = captureValidationError(() => parseOcfObject({ ...fixture, id: ZERO_UUID }));

    expect(error.fieldPath).toBe('id');
    expect(error.message).toContain('required');
  });

  it('preserves zero-UUID array positions so schema validation rejects the entry', () => {
    const error = captureValidationError(() =>
      parseOcfObject({
        object_type: 'FINANCING',
        id: 'financing-1',
        name: 'Seed',
        date: '2025-01-01',
        issuance_ids: [ZERO_UUID],
      })
    );

    expect(error.fieldPath).toBe('issuance_ids.0');
    expect(error.message).toContain('must be string');
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

  describe('typed entity discriminator preflight', () => {
    it('derives one unique canonical discriminator for every registry entry', () => {
      expect(entityDiscriminatorCases).toHaveLength(entityTypes.length);
      expect(new Set(entityDiscriminatorCases.map(({ expectedObjectType }) => expectedObjectType)).size).toBe(
        entityTypes.length
      );
    });

    it('treats a zero-UUID object_type sentinel as missing without deep pre-normalization', () => {
      const untouchedNestedValue = Object.defineProperty({}, 'vesting_terms_id', {
        enumerable: true,
        get: () => {
          throw new Error('typed discriminator preflight must not traverse nested values');
        },
      });
      const error = captureValidationError(() =>
        parseOcfEntityInput('stakeholder', {
          object_type: ZERO_UUID,
          nested: untouchedNestedValue,
        })
      );

      expect(error.fieldPath).toBe('object_type');
      expect(error.expectedType).toBe('STAKEHOLDER');
      expect(error.receivedValue).toBeUndefined();
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

  it.each(planSecurityDiscriminatorCases)(
    'normalizes schema-valid $sourceObjectType to $canonicalObjectType after validating its declared shape',
    ({ sourceObjectType, canonicalObjectType, fixture: loadFixture }) => {
      const fixture = stripSourceMetadata(loadFixture());
      const planSecurityFixture: Record<string, unknown> = {
        ...fixture,
        object_type: sourceObjectType,
      };

      const parsedRecord = toRecord(parseOcfObject(planSecurityFixture));

      expect(parsedRecord.object_type).toBe(canonicalObjectType);
      expect(parsedRecord.id).toBe(fixture.id);
    }
  );

  it('does not let normalization rescue a schema-invalid PlanSecurity issuance', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-nso')
    );
    const malformedFixture: Record<string, unknown> = {
      ...fixture,
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
      plan_security_type: 'OPTION',
    };
    delete malformedFixture.compensation_type;
    delete malformedFixture.option_grant_type;

    expect(() => parseOcfObject(malformedFixture)).toThrow('plan_security_type');
  });

  it('upgrades and validates a historical stakeholder relationship event', () => {
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );
    const { relationship_started: _, relationship_ended: __, ...legacyFixture } = fixture;

    const parsed = parseOcfObject({
      ...legacyFixture,
      object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
      new_relationships: ['CONSULTANT'],
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
    expect(parsed.relationship_started).toBe('CONSULTANT');
    expect(parsed).not.toHaveProperty('new_relationships');
  });

  it.each([
    {
      relationshipStarted: 'ADVISOR',
      relationshipEnded: null,
      presentField: 'relationship_started',
      presentValue: 'ADVISOR',
      absentField: 'relationship_ended',
    },
    {
      relationshipStarted: null,
      relationshipEnded: 'EMPLOYEE',
      presentField: 'relationship_ended',
      presentValue: 'EMPLOYEE',
      absentField: 'relationship_started',
    },
  ])(
    'treats an explicit null $absentField as absent when upgrading a historical relationship event',
    ({ relationshipStarted, relationshipEnded, presentField, presentValue, absentField }) => {
      const fixture = stripSourceMetadata(
        loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
      );

      const parsed = parseOcfObject({
        ...fixture,
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        relationship_started: relationshipStarted,
        relationship_ended: relationshipEnded,
      });

      expect(parsed.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
      expect(toRecord(parsed)[presentField]).toBe(presentValue);
      expect(parsed).not.toHaveProperty(absentField);
    }
  );

  it('treats null new_relationships as absent when a canonical relationship is present', () => {
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );

    const parsed = parseOcfObject({
      ...fixture,
      object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
      new_relationships: null,
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
    expect(parsed.relationship_started).toBe('ADVISOR');
    expect(parsed).not.toHaveProperty('new_relationships');
  });

  it('rejects null new_relationships when no canonical relationship is present', () => {
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );
    const { relationship_started: _, relationship_ended: __, ...withoutCanonicalRelationship } = fixture;

    expect(() =>
      parseOcfObject({
        ...withoutCanonicalRelationship,
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        new_relationships: null,
      })
    ).toThrow('one of relationship_started or relationship_ended is required');
  });

  it('upgrades and validates a historical stakeholder status event', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    const parsed = parseOcfObject({
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      comments: ['Imported'],
      reason_text: 'Reinstated',
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_STATUS');
    expect(parsed.comments).toEqual(['Imported', 'Reinstated']);
    expect(parsed).not.toHaveProperty('reason_text');
  });

  it('treats an explicit null reason_text as absent when upgrading a historical status event', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    const parsed = parseOcfObject({
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      reason_text: null,
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_STATUS');
    expect(parsed.comments).toEqual(fixture.comments);
    expect(parsed).not.toHaveProperty('reason_text');
  });

  it('treats null comments as absent before migrating a historical status reason', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    const parsed = parseOcfObject({
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      comments: null,
      reason_text: 'Reinstated',
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_STATUS');
    expect(parsed.comments).toEqual(['Reinstated']);
    expect(parsed).not.toHaveProperty('reason_text');
  });

  it('leaves comments absent when historical status comments and reason are both null', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    const parsed = parseOcfObject({
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      comments: null,
      reason_text: null,
    });

    expect(parsed.object_type).toBe('CE_STAKEHOLDER_STATUS');
    expect(parsed).not.toHaveProperty('comments');
    expect(parsed).not.toHaveProperty('reason_text');
  });

  it('still rejects non-array, non-null comments while migrating a historical status reason', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));

    expect(() =>
      parseOcfObject({
        ...fixture,
        object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
        comments: { text: 'Imported' },
        reason_text: 'Reinstated',
      })
    ).toThrow('Invalid comments: expected array');
  });

  it('validates the canonical stakeholder relationship enum after legacy transformation', () => {
    const error = captureValidationError(() =>
      parseOcfObject({
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        id: 'event-1',
        date: '2024-01-15',
        stakeholder_id: 'stakeholder-1',
        new_relationships: ['NOT_A_RELATIONSHIP'],
      })
    );

    expect(error.fieldPath).toBe('relationship_started');
    expect(error.message).toContain('must be equal to one of the allowed values');
  });

  it('does not rescue a canonical relationship event containing a non-schema legacy field', () => {
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

  it('does not rescue a canonical status event containing a non-schema legacy field', () => {
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

  it('rejects entity/object_type mismatches', () => {
    const stakeholderFixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('stakeholder', 'individual')
    );

    const parseMismatched = () => parseOcfEntityInput('stockIssuance', stakeholderFixture);
    expect(parseMismatched).toThrow(OcpValidationError);
    expect(parseMismatched).toThrow('expects object_type "TX_STOCK_ISSUANCE"');
  });

  it('typed parsing accepts the exact canonical object_type', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso')
    );

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

  it('keeps historical stakeholder aliases at the raw parser boundary', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
    };

    const parseLegacy = () => parseOcfEntityInput('stakeholderStatusChangeEvent', legacyFixture);
    expect(parseLegacy).toThrow(OcpValidationError);
    expect(parseLegacy).toThrow('expects object_type "CE_STAKEHOLDER_STATUS"');
  });
});
