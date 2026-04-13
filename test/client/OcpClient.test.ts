import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
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

describe('OcpClient OpenCapTable entity facade', () => {
  it('forwards issuer.get readAs through the OcpClient facade', async () => {
    const issuerTemplateId = Fairmint.OpenCapTable.OCF.Issuer.Issuer.templateId;
    const ledger = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: issuerTemplateId,
            createArgument: {
              issuer_data: {
                id: 'iss-1',
                legal_name: 'Facade Test Corp',
                country_of_formation: 'US',
                formation_date: '2025-01-01T00:00:00Z',
                tax_ids: [],
                comments: [],
              },
            },
          },
        },
      }),
    };
    const ocp = new OcpClient({ ledger: ledger as never });

    const result = await ocp.OpenCapTable.issuer.get({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });

    expect(result.contractId).toBe('issuer-cid-1');
    expect(result.data.id).toBe('iss-1');
    expect(ledger.getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'issuer-cid-1',
      readAs: ['issuer::party-1'],
    });
  });
});
