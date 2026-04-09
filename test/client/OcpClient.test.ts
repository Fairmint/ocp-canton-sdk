import type { ClientConfig } from '@fairmint/canton-node-sdk';
import * as openCapTableCapTable from '../../src/functions/OpenCapTable/capTable';
import { OcpClient } from '../../src/OcpClient';
import { createLedgerAndValidatorClients, createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

jest.mock('@fairmint/canton-node-sdk');

describe('OcpClient', () => {
  const config: ClientConfig = { network: 'devnet' };

  it('reuses injected runtime clients instead of constructing hidden ones', () => {
    const { ledger, validator } = createLedgerAndValidatorClients(config);

    const ocp = new OcpClient({ ledger, validator });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBe(validator);
  });

  it('supports ledger-only dependencies', () => {
    const ledger = createLedgerJsonApiClient(config);

    const ocp = new OcpClient({ ledger });

    expect(ocp.ledger).toBe(ledger);
    expect(ocp.validator).toBeUndefined();
  });
});

describe('OcpClient OpenCapTable.capTable facade', () => {
  const config: ClientConfig = { network: 'devnet' };

  let classifySpy: jest.SpiedFunction<typeof openCapTableCapTable.classifyIssuerCapTables>;
  let getStateSpy: jest.SpiedFunction<typeof openCapTableCapTable.getCapTableState>;

  beforeEach(() => {
    classifySpy = jest.spyOn(openCapTableCapTable, 'classifyIssuerCapTables').mockResolvedValue({
      status: 'none',
      current: null,
    });
    getStateSpy = jest.spyOn(openCapTableCapTable, 'getCapTableState').mockResolvedValue(null);
  });

  afterEach(() => {
    classifySpy.mockRestore();
    getStateSpy.mockRestore();
  });

  it('forwards capTable.classify to classifyIssuerCapTables with the injected ledger', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await ocp.OpenCapTable.capTable.classify('issuer::party-1');

    expect(classifySpy).toHaveBeenCalledTimes(1);
    expect(classifySpy).toHaveBeenCalledWith(ledger, 'issuer::party-1');
  });

  it('forwards capTable.getState to getCapTableState with the injected ledger', async () => {
    const ledger = createLedgerJsonApiClient(config);
    const ocp = new OcpClient({ ledger });

    await ocp.OpenCapTable.capTable.getState('issuer::party-2');

    expect(getStateSpy).toHaveBeenCalledTimes(1);
    expect(getStateSpy).toHaveBeenCalledWith(ledger, 'issuer::party-2');
  });
});
