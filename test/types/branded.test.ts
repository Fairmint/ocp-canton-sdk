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

  it.each(brandCases)('%s reports hostile objects without invoking user code', (name, _guard, convert) => {
    const hostileToString = jest.fn(() => {
      throw new Error('hostile toString invoked');
    });
    const hostileObject = { toString: hostileToString };

    expect(() => convert(hostileObject)).toThrow(`Invalid ${name}`);
    expect(hostileToString).not.toHaveBeenCalled();

    const proxyTrap = jest.fn(() => {
      throw new Error('proxy trap invoked');
    });
    const hostileProxy = new Proxy(
      {},
      {
        get: proxyTrap,
        getOwnPropertyDescriptor: proxyTrap,
        getPrototypeOf: proxyTrap,
        ownKeys: proxyTrap,
      }
    );

    expect(() => convert(hostileProxy)).toThrow(`Invalid ${name}`);
    expect(proxyTrap).not.toHaveBeenCalled();
  });

  it('bounds diagnostics for large invalid objects', () => {
    const largeObject = Object.fromEntries(Array.from({ length: 1_000 }, (_, index) => [`field_${index}`, index]));

    try {
      toContractId(largeObject);
      throw new Error('Expected toContractId to reject a non-string object');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid ContractId');
      expect((error as Error).message.length).toBeLessThan(256);
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
