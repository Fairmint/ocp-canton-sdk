import { OcpValidationError } from '../../src/errors';
import { parseOcfEntityInput, parseOcfObject, resolveOcfSchemaDir } from '../../src/utils/ocfZodSchemas';
import { loadProductionFixture, loadSyntheticFixture, stripSourceMetadata } from './productionFixtures';

describe('ocfZodSchemas', () => {
  beforeAll(() => {
    // Fail fast with actionable error if source-of-truth OCF schema is unavailable.
    resolveOcfSchemaDir();
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

    expect(() => parseOcfObject(invalidFixture)).toThrow(OcpValidationError);
    expect(() => parseOcfObject(invalidFixture)).toThrow('__unexpected_field');
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
    const parsedRecord = parsed as unknown as Record<string, unknown>;

    expect(parsedRecord.object_type).toBe('TX_EQUITY_COMPENSATION_ISSUANCE');
    expect(parsedRecord.compensation_type).toBe('OPTION_ISO');
    expect(parsedRecord).not.toHaveProperty('option_grant_type');
  });

  it('canonicalizes legacy stakeholder status change event object_type + reason_text', () => {
    const fixture = stripSourceMetadata(loadSyntheticFixture<Record<string, unknown>>('stakeholderStatusChangeEvent'));
    const legacyFixture = {
      ...fixture,
      object_type: 'TX_STAKEHOLDER_STATUS_CHANGE_EVENT',
      reason_text: 'Legacy reason',
    };

    const parsed = parseOcfEntityInput('stakeholderStatusChangeEvent', legacyFixture);
    const parsedRecord = parsed as unknown as Record<string, unknown>;

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
    const parsedRecord = parsed as unknown as Record<string, unknown>;

    expect(parsedRecord.object_type).toBe('CE_STAKEHOLDER_RELATIONSHIP');
    expect(parsedRecord.relationship_started).toBe('ADVISOR');
    expect(parsedRecord).not.toHaveProperty('new_relationships');
  });
});
