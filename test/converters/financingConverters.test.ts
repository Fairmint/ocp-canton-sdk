import type { OcfFinancing } from '../../src';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlFinancingToNative } from '../../src/functions/OpenCapTable/financing/damlToOcf';
import { financingDataToDaml } from '../../src/functions/OpenCapTable/financing/financingDataToDaml';

describe('Financing converters', () => {
  const financing: OcfFinancing = {
    object_type: 'FINANCING',
    id: 'financing-series-a',
    name: 'Series A',
    issuance_ids: ['stock-issuance-1', 'convertible-issuance-1'],
    date: '2026-01-15',
    comments: ['Initial close'],
  };

  it('maps the canonical OCF representation to generated DAML data', () => {
    expect(financingDataToDaml(financing)).toEqual({
      id: 'financing-series-a',
      name: 'Series A',
      issuance_ids: ['stock-issuance-1', 'convertible-issuance-1'],
      date: '2026-01-15T00:00:00.000Z',
      comments: ['Initial close'],
    });
  });

  it('round-trips through the generic dispatchers', () => {
    const damlData = financingDataToDaml(financing);

    expect(convertToOcf('financing', damlData)).toEqual(financing);
  });

  it('normalizes absent comments at the representation boundary', () => {
    const withoutComments: OcfFinancing = {
      object_type: 'FINANCING',
      id: 'financing-series-a',
      name: 'Series A',
      issuance_ids: ['stock-issuance-1', 'convertible-issuance-1'],
      date: '2026-01-15',
    };
    const damlData = financingDataToDaml(withoutComments);

    expect(damlData.comments).toEqual([]);
    expect(damlFinancingToNative(damlData)).toEqual(withoutComments);
  });

  it('does not preflight issuance references that the DAML contract owns', () => {
    const damlData = convertToDaml('financing', {
      ...financing,
      issuance_ids: ['not-present-on-this-cap-table'],
    });

    expect(damlData.issuance_ids).toEqual(['not-present-on-this-cap-table']);
  });
});
