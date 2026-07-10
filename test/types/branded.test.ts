import {
  isContractId,
  isOcfId,
  isPartyId,
  isSecurityId,
  toContractId,
  toOcfId,
  toPartyId,
  toSecurityId,
  type ContractId,
  type OcfId,
  type PartyId,
  type SecurityId,
} from '../../src';

const brandCases = [
  ['ContractId', isContractId, toContractId],
  ['OcfId', isOcfId, toOcfId],
  ['PartyId', isPartyId, toPartyId],
  ['SecurityId', isSecurityId, toSecurityId],
] as const;

describe('public branded identifier helpers', () => {
  it.each(brandCases)('%s accepts and preserves non-empty strings', (_name, guard, convert) => {
    expect(guard('identifier-123')).toBe(true);
    expect(convert('identifier-123')).toBe('identifier-123');
  });

  it.each(brandCases)('%s rejects empty and non-string values', (_name, guard, convert) => {
    const invalidValues: unknown[] = ['', 0, false, null, undefined, {}, []];

    for (const value of invalidValues) {
      expect(guard(value)).toBe(false);
      expect(() => convert(value)).toThrow(`Invalid ${_name}`);
    }
  });

  it('keeps identifier brands distinct at compile time', () => {
    const contractId: ContractId = toContractId('contract-id');
    const ocfId: OcfId = toOcfId('ocf-id');
    const partyId: PartyId = toPartyId('party-id');
    const securityId: SecurityId = toSecurityId('security-id');

    expect([contractId, ocfId, partyId, securityId]).toEqual(['contract-id', 'ocf-id', 'party-id', 'security-id']);
  });
});
