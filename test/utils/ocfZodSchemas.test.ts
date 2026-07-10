import { OcpValidationError } from '../../src/errors';
import {
  ENTITY_OBJECT_TYPE_MAP,
  ENTITY_REGISTRY,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { StakeholderRelationshipType } from '../../src/types/native';
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
const stakeholderRelationshipTypes = [
  'ADVISOR',
  'BOARD_MEMBER',
  'CONSULTANT',
  'EMPLOYEE',
  'EX_ADVISOR',
  'EX_CONSULTANT',
  'EX_EMPLOYEE',
  'EXECUTIVE',
  'FOUNDER',
  'INVESTOR',
  'NON_US_EMPLOYEE',
  'OFFICER',
  'OTHER',
] as const satisfies readonly StakeholderRelationshipType[];
type MissingStakeholderRelationshipType = Exclude<
  StakeholderRelationshipType,
  (typeof stakeholderRelationshipTypes)[number]
>;
const stakeholderRelationshipTypeCoverageIsExhaustive: MissingStakeholderRelationshipType extends never ? true : never =
  true;
const entityDiscriminatorCases = entityTypes.map((entityType, index) => {
  const mismatchedEntityType = entityTypes[(index + 1) % entityTypes.length];
  return {
    entityType,
    expectedObjectType: ENTITY_OBJECT_TYPE_MAP[entityType],
    mismatchedObjectType:
      ENTITY_OBJECT_TYPE_MAP[requireDefined(mismatchedEntityType, `mismatched entity type for ${entityType}`)],
  };
});

describe('ocfZodSchemas', () => {
  void stakeholderRelationshipTypeCoverageIsExhaustive;

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

  it('raw parsing canonicalizes legacy plan security issuance + option_grant_type before validation', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-iso')
    );
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
      option_grant_type: 'ISO',
    };
    delete legacyFixture.compensation_type;
    delete legacyFixture.quantity_source;

    const parsed = parseOcfObject(legacyFixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(parsedRecord.compensation_type).toBe('OPTION_ISO');
    expect(parsedRecord).not.toHaveProperty('option_grant_type');
  });

  it('raw parsing canonicalizes legacy plan security issuance + plan_security_type before validation', () => {
    const fixture = stripSourceMetadata(
      loadProductionFixture<Record<string, unknown>>('equityCompensationIssuance', 'option-nso')
    );
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      object_type: 'TX_PLAN_SECURITY_ISSUANCE',
      plan_security_type: 'OPTION',
    };
    delete legacyFixture.compensation_type;
    delete legacyFixture.option_grant_type;
    delete legacyFixture.quantity_source;

    const parsed = parseOcfObject(legacyFixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(parsedRecord.compensation_type).toBe('OPTION');
    expect(parsedRecord).not.toHaveProperty('plan_security_type');
  });

  it('rejects legacy stakeholder status reason_text before object_type normalization', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));
    const legacyFixture: Record<string, unknown> = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      reason_text: 'Legacy reason',
    };

    expect(() => parseOcfObject(legacyFixture)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(legacyFixture)).toThrow('reason_text');
  });

  it('canonicalizes legacy stakeholder relationship event shape', () => {
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
      new_relationships: ['ADVISOR'],
    };

    const parsed = parseOcfObject(legacyFixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
    expect(parsedRecord.relationship_started).toBe('ADVISOR');
    expect(parsedRecord).not.toHaveProperty('new_relationships');
  });

  it('rejects ambiguous legacy stakeholder relationship event shape with two relationships', () => {
    const fixture = stripSourceMetadata(
      loadSyntheticFixture<Record<string, unknown>>('stakeholderRelationshipChangeEvent')
    );
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
      new_relationships: ['ADVISOR', 'INVESTOR'],
    };

    expect(() => parseOcfObject(legacyFixture)).toThrow('legacy new_relationships with multiple entries is ambiguous');
  });

  it.each(stakeholderRelationshipTypes)('strictly parses raw legacy %s relationship input', (relationship) => {
    const parsed = parseOcfObject({
      object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
      id: `legacy-relationship-${relationship.toLowerCase()}`,
      date: '2025-03-01',
      stakeholder_id: 'stakeholder-1',
      new_relationships: [relationship],
    });

    expect(parsed).toMatchObject({
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      relationship_started: relationship,
    });
    expect(parsed).not.toHaveProperty('new_relationships');
  });

  it('rejects mixed legacy and canonical relationship representations', () => {
    const parseMixedRepresentation = () =>
      parseOcfObject({
        object_type: 'TX_STAKEHOLDER_RELATIONSHIP_CHANGE_EVENT',
        id: 'mixed-relationship-event',
        date: '2025-03-01',
        stakeholder_id: 'stakeholder-1',
        relationship_started: 'ADVISOR',
        new_relationships: ['UNKNOWN_RELATIONSHIP'],
      });

    expect(parseMixedRepresentation).toThrow(OcpValidationError);
    expect(parseMixedRepresentation).toThrow('cannot mix legacy new_relationships');
  });

  describe('canonical stakeholder relationship events', () => {
    it.each(stakeholderRelationshipTypes)('strictly parses the %s relationship value', (relationship) => {
      const input = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: `relationship-${relationship.toLowerCase()}`,
        date: '2025-03-01',
        stakeholder_id: 'stakeholder-1',
        relationship_started: relationship,
        relationship_ended: relationship,
      };

      const parsed = parseOcfEntityInput('stakeholderRelationshipChangeEvent', input);

      expect(parsed.relationship_started).toBe(relationship);
      expect(parsed.relationship_ended).toBe(relationship);
    });

    it.each(['advisor', ' ADVISOR', 'ADVISOR '])(
      'rejects the non-canonical value %j instead of coercing it',
      (value) => {
        const input = {
          object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
          id: 'relationship-invalid-enum',
          date: '2025-03-01',
          stakeholder_id: 'stakeholder-1',
          relationship_started: value,
        };

        expect(() => parseOcfEntityInput('stakeholderRelationshipChangeEvent', input)).toThrow(OcpValidationError);
      }
    );

    it('rejects the legacy new_relationships field on a canonical event', () => {
      const input = {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'relationship-with-legacy-field',
        date: '2025-03-01',
        stakeholder_id: 'stakeholder-1',
        relationship_started: 'ADVISOR',
        new_relationships: ['FOUNDER'],
      };

      const parseCanonicalWithLegacyField = () => parseOcfEntityInput('stakeholderRelationshipChangeEvent', input);
      expect(parseCanonicalWithLegacyField).toThrow(OcpValidationError);
      expect(parseCanonicalWithLegacyField).toThrow('new_relationships');
    });
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
});
