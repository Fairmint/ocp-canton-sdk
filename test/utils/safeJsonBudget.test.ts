import { assertSafeOcfJson } from '../../src/utils/ocfJsonValidation';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

/** A shared object with many undefined properties, referenced many times: N x R work without a budget. */
function amplified(properties: number, references: number): Record<string, unknown> {
  const shared: Record<string, unknown> = {};
  for (let i = 0; i < properties; i++) shared[`p${i}`] = undefined;
  return { object_type: 'DOCUMENT', id: 'doc-1', items: Array.from({ length: references }, () => shared) };
}

describe('safe JSON budget counts skipped undefined properties', () => {
  it('refuses a 10k x 10k undefined-property shape quickly', () => {
    const input = amplified(10_000, 10_000);

    const started = Date.now();
    expect(() => assertSafeOcfJson(input, 'ocfObject')).toThrow(/too many nested values/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('refuses it quickly through parseOcfObject as well', () => {
    const input = amplified(10_000, 10_000);

    const started = Date.now();
    expect(() => parseOcfObject(input)).toThrow(/too many nested values/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('still accepts a modest number of undefined properties', () => {
    expect(() => assertSafeOcfJson({ id: 'a', comments: undefined, note: undefined }, 'ocfObject')).not.toThrow();
  });
});
