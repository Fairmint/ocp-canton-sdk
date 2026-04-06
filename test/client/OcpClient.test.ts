import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src/OcpClient';

jest.mock('@fairmint/canton-node-sdk');

describe('OcpClient', () => {
  const config: ClientConfig = { network: 'devnet' };

  it('reuses injected runtime clients instead of constructing hidden ones', () => {
    const ledger = new LedgerJsonApiClient(config);
    const validator = new ValidatorApiClient(config);

    const ocp = new OcpClient({ ledger, validator });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBe(validator);
  });

  it('supports ledger-only dependencies', () => {
    const ledger = new LedgerJsonApiClient(config);

    const ocp = new OcpClient({ ledger });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBeUndefined();
  });
});
