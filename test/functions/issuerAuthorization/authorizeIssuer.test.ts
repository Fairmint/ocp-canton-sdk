import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { authorizeIssuer } from '../../../src/functions/OpenCapTable/issuerAuthorization/authorizeIssuer';

describe('authorizeIssuer factory configuration', () => {
  const client = {} as LedgerJsonApiClient;

  it('rejects incomplete factory coordinates from untyped callers before ledger access', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: { contractId: 'factory-cid' } as unknown as { contractId: string; templateId: string },
      })
    ).rejects.toThrow('factory override must contain exactly');
  });

  it('rejects blank atomic factory coordinates before ledger access', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: { contractId: 'factory-cid', templateId: '   ' },
      })
    ).rejects.toThrow('factory override must contain exactly');
  });

  it('rejects whitespace-padded atomic factory coordinates before ledger access', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: { contractId: ' factory-cid', templateId: 'factory-tid' },
      })
    ).rejects.toThrow('without leading or trailing whitespace');
  });

  it('rejects a null factory override with a validation error before ledger access', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: null as unknown as { contractId: string; templateId: string },
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.factory',
      code: 'INVALID_FORMAT',
      expectedType: 'exact object with non-empty, whitespace-trimmed string contractId and templateId properties',
      receivedValue: null,
    });
  });

  it('rejects additional factory fields before ledger access', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: {
          contractId: 'factory-cid',
          templateId: 'factory-tid',
          unexpected: 'must-not-survive',
        } as { contractId: string; templateId: string },
      })
    ).rejects.toThrow('factory override must contain exactly');
  });

  it('rejects parameter accessors and proxies without invoking traps', async () => {
    const getter = jest.fn(() => 'issuer::party');
    const accessorParams = {};
    Object.defineProperty(accessorParams, 'issuer', { enumerable: true, get: getter });
    await expect(authorizeIssuer(client, accessorParams as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.issuer',
    });
    expect(getter).not.toHaveBeenCalled();

    const trap = jest.fn(() => {
      throw new Error('proxy trap invoked');
    });
    const proxy = new Proxy({}, { get: trap, ownKeys: trap });
    await expect(authorizeIssuer(client, proxy as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer',
    });
    expect(trap).not.toHaveBeenCalled();
  });

  it('rejects missing, blank, unknown, and symbol authorization fields before ledger access', async () => {
    await expect(authorizeIssuer(client, {} as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.issuer',
    });
    await expect(authorizeIssuer(client, { issuer: ' ' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer.issuer',
    });
    await expect(authorizeIssuer(client, { issuer: 'issuer::party', unexpected: true } as never)).rejects.toMatchObject(
      { name: 'OcpValidationError', fieldPath: 'authorizeIssuer.unexpected' }
    );
    const symbol = Symbol('unexpected');
    await expect(authorizeIssuer(client, { issuer: 'issuer::party', [symbol]: true } as never)).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'authorizeIssuer',
    });
  });

  it('rejects incomplete direct ledger injection before submitting authorization', async () => {
    await expect(
      authorizeIssuer(client, {
        issuer: 'issuer::party',
        factory: { contractId: 'factory-cid', templateId: 'factory-tid' },
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'client.submitAndWaitForTransactionTree',
    });
  });
});
