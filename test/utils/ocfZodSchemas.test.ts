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

  it('canonicalizes legacy stakeholder status change event object_type + reason_text', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      reason_text: 'Legacy reason',
    };

    const parsed = parseOcfObject(legacyFixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.object_type).toBe('CE_STAKEHOLDER_STATUS');
    expect(parsedRecord).not.toHaveProperty('reason_text');
    expect(parsedRecord.comments).toContain('Legacy reason');
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

  it('canonicalizes stock consolidation legacy resulting_security_ids field', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stockConsolidation'));
    const parsed = parseOcfEntityInput('stockConsolidation', fixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.resulting_security_id).toBe('test-security-consolidated-result-001');
    expect(parsedRecord).not.toHaveProperty('resulting_security_ids');
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
