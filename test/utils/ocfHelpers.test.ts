/** Tests for OCF helper utilities */

import { extractOcfIdFromCreateArgs, getOcfDataFieldName, getOcfTypeLabel } from '../../src/utils/ocfHelpers';

describe('getOcfDataFieldName', () => {
  test('returns correct field names for entity types', () => {
    expect(getOcfDataFieldName('STAKEHOLDER')).toBe('ocf_data');
    expect(getOcfDataFieldName('STOCK_CLASS')).toBe('ocf_data');
    expect(getOcfDataFieldName('STOCK_PLAN')).toBe('ocf_data');
  });

  test('returns correct field names for transaction types', () => {
    expect(getOcfDataFieldName('TX_STOCK_ISSUANCE')).toBe('ocf_data');
    expect(getOcfDataFieldName('TX_STOCK_CANCELLATION')).toBe('ocf_data');
  });
});

describe('extractOcfIdFromCreateArgs', () => {
  test('extracts ID from stakeholder data', () => {
    const args = { ocf_data: { id: 'sh-123', name: { legal_name: 'John' } } };
    expect(extractOcfIdFromCreateArgs('STAKEHOLDER', args)).toBe('sh-123');
  });

  test('extracts ID from issuance data', () => {
    const args = { ocf_data: { id: 'iss-456', quantity: '100' } };
    expect(extractOcfIdFromCreateArgs('TX_STOCK_ISSUANCE', args)).toBe('iss-456');
  });

  test('returns undefined for missing data', () => {
    expect(extractOcfIdFromCreateArgs('STAKEHOLDER', {})).toBe(undefined);
    expect(extractOcfIdFromCreateArgs('STAKEHOLDER', null)).toBe(undefined);
    expect(extractOcfIdFromCreateArgs('STAKEHOLDER', { ocf_data: {} })).toBe(undefined);
  });
});

describe('getOcfTypeLabel', () => {
  test('returns singular label for count 1', () => {
    expect(getOcfTypeLabel('STAKEHOLDER', 1)).toBe('1 Stakeholder');
    expect(getOcfTypeLabel('TX_STOCK_ISSUANCE', 1)).toBe('1 Stock Issuance');
  });

  test('returns plural label for count > 1', () => {
    expect(getOcfTypeLabel('STAKEHOLDER', 5)).toBe('5 Stakeholders');
    expect(getOcfTypeLabel('TX_STOCK_ISSUANCE', 10)).toBe('10 Stock Issuances');
  });

  test('handles vesting terms special case', () => {
    expect(getOcfTypeLabel('VESTING_TERMS', 1)).toBe('1 Vesting Terms');
    expect(getOcfTypeLabel('VESTING_TERMS', 2)).toBe('2 Vesting Terms');
  });
});
