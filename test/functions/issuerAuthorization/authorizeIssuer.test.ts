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
      fieldPath: 'factory',
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
});
