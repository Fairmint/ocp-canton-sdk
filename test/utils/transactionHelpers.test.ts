import { safeGet } from '../../src/utils/transactionHelpers';

describe('transaction helpers', () => {
  describe('safeGet', () => {
    it('returns an own nested leaf value', () => {
      expect(safeGet({ nested: { value: 'ocf-id' } }, ['nested', 'value'])).toBe('ocf-id');
    });

    it('rejects inherited path segments', () => {
      expect(safeGet({}, ['toString'])).toBeUndefined();
      expect(safeGet(Object.create({ inherited: { value: 'ocf-id' } }), ['inherited', 'value'])).toBeUndefined();
    });
  });
});
