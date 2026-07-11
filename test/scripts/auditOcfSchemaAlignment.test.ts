import { getOwnRecordValue } from '../../scripts/audit-ocf-schema-alignment';

describe('OCF schema alignment registry lookup', () => {
  test('returns an owned mapping value', () => {
    expect(getOwnRecordValue({ canonical: 'alias' }, 'canonical')).toBe('alias');
  });

  test('returns undefined for an unknown mapping key', () => {
    expect(getOwnRecordValue({ canonical: 'alias' }, 'unknown')).toBeUndefined();
  });

  test.each(['constructor', 'toString', '__proto__'])('rejects inherited prototype key %s', (prototypeKey) => {
    expect(getOwnRecordValue({}, prototypeKey)).toBeUndefined();
  });

  test('allows an explicitly owned property whose name overlaps a prototype key', () => {
    expect(getOwnRecordValue({ constructor: 'owned-alias' }, 'constructor')).toBe('owned-alias');
  });
});
