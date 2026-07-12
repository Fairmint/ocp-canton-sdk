import { loadFixture, loadProductionFixture, prepareFixtureForSubmission } from './productionFixtures';

describe('fixture loading', () => {
  test('returns a runtime-validated record', () => {
    const fixture = loadProductionFixture('stakeholder', 'individual');

    expect(fixture.object_type).toBe('STAKEHOLDER');
    expect(typeof fixture.id).toBe('string');
  });

  test('rejects a parsed fixture whose root is not an object', () => {
    const parse = jest.spyOn(JSON, 'parse').mockReturnValueOnce([]);
    try {
      expect(() => loadFixture('production/stakeholder/individual.json')).toThrow(
        'Fixture production/stakeholder/individual.json must contain a JSON object'
      );
    } finally {
      parse.mockRestore();
    }
  });
});

describe('prepareFixtureForSubmission', () => {
  const identifiers = {
    id: 'run-specific-id',
    securityId: 'run-specific-security-id',
  };

  test('strips source metadata and replaces valid fixture identifiers', () => {
    expect(
      prepareFixtureForSubmission(
        {
          _source: { environment: 'production' },
          id: 'source-id',
          object_type: 'TX_STOCK_ISSUANCE',
          security_id: 'source-security-id',
        },
        identifiers
      )
    ).toEqual({
      id: 'run-specific-id',
      object_type: 'TX_STOCK_ISSUANCE',
      security_id: 'run-specific-security-id',
    });
  });

  test('does not add security_id when the source fixture does not contain one', () => {
    expect(prepareFixtureForSubmission({ id: 'source-id', object_type: 'STAKEHOLDER' }, identifiers)).toEqual({
      id: 'run-specific-id',
      object_type: 'STAKEHOLDER',
    });
  });

  test('rejects a non-string security_id instead of hiding it with a generated value', () => {
    expect(() =>
      prepareFixtureForSubmission(
        {
          id: 'source-id',
          object_type: 'TX_STOCK_ISSUANCE',
          security_id: 42,
        },
        identifiers
      )
    ).toThrow('Fixture field security_id must be a string when present');
  });

  test('rejects a missing source id instead of hiding it with a generated value', () => {
    expect(() =>
      prepareFixtureForSubmission(
        {
          object_type: 'STAKEHOLDER',
        },
        identifiers
      )
    ).toThrow('Fixture field id must be a string');
  });
});
