import { OcpValidationError } from '../../src/errors';
import { parseOcfEntityInput, parseOcfObject, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';
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

  it('canonicalizes legacy plan security issuance + option_grant_type before validation', () => {
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

    const parsed = parseOcfEntityInput('planSecurityIssuance', legacyFixture);
    const parsedRecord = toRecord(parsed);

    expect(parsedRecord.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(parsedRecord.compensation_type).toBe('OPTION_ISO');
    expect(parsedRecord).not.toHaveProperty('option_grant_type');
  });

  it('canonicalizes legacy plan security issuance + plan_security_type before validation', () => {
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

    const parsed = parseOcfEntityInput('planSecurityIssuance', legacyFixture);
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

    const parsed = parseOcfEntityInput('stakeholderStatusChangeEvent', legacyFixture);
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

    const parsed = parseOcfEntityInput('stakeholderRelationshipChangeEvent', legacyFixture);
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

    expect(() => parseOcfEntityInput('stakeholderRelationshipChangeEvent', legacyFixture)).toThrow(
      'legacy new_relationships with multiple entries is ambiguous'
    );
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
});
