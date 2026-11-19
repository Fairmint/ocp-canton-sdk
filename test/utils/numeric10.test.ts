import { canonicalizeNumeric10, canonicalizeOcfNumeric10 } from '../../src/utils/numeric10';
import { ocfDeepEqual } from '../../src/utils/ocfComparison';
import { initialSharesAuthorizedToDaml } from '../../src/utils/typeConversions';

const manyZeros = '0'.repeat(256);

describe('redundant leading integer zeroes', () => {
  it('comparison: a long zero-padded Numeric equals its canonical value', () => {
    expect(ocfDeepEqual({ q: `${manyZeros}1` }, { q: '1' })).toBe(true);
    expect(ocfDeepEqual({ q: `-${manyZeros}.50` }, { q: '-0.5' })).toBe(true);
    expect(ocfDeepEqual({ q: `${manyZeros}2` }, { q: '1' })).toBe(false);
  });

  it('canonicalizeNumeric10 strips the padding but keeps sign and one integer digit', () => {
    expect(canonicalizeNumeric10(`${manyZeros}1`)).toEqual({ ok: true, value: '1' });
    expect(canonicalizeNumeric10(`-${manyZeros}.50`)).toEqual({ ok: true, value: '-0.5' });
    expect(canonicalizeNumeric10(manyZeros)).toEqual({ ok: true, value: '0' });
  });

  it('still bounds pathological input after stripping', () => {
    expect(canonicalizeNumeric10(`1${'0'.repeat(300)}`).ok).toBe(false);
  });

  it('writer: an OCF Numeric with long zero padding is written as its canonical value', () => {
    expect(canonicalizeOcfNumeric10(`${manyZeros}1000`)).toEqual({ ok: true, value: '1000' });
    expect(canonicalizeOcfNumeric10(`${manyZeros}.5`)).toEqual({ ok: true, value: '0.5' });
    expect(initialSharesAuthorizedToDaml(`${manyZeros}1000`)).toEqual({
      tag: 'OcfInitialSharesNumeric',
      value: '1000',
    });
  });
});
