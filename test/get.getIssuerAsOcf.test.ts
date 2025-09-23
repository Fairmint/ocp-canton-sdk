import { OcpClient } from '../src';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LedgerJsonApiClient } = require('@fairmint/canton-node-sdk');

describe('get: getIssuerAsOcf', () => {
  test('maps network response to expected OCF issuer', async () => {
    const client = new OcpClient({ network: 'dev' });
    const ledger = (LedgerJsonApiClient as any).__instances?.slice(-1)[0] as InstanceType<typeof LedgerJsonApiClient> & { __setEventsResponse: Function };

    // Mock events response to include issuer_data
    ledger.__setEventsResponse({
      created: {
        createdEvent: {
          createArgument: {
            issuer_data: {
              id: 'iss-1',
              legal_name: 'ACME Inc.',
              country_of_formation: 'US',
              formation_date: '2025-01-01T00:00:00Z'
            }
          }
        }
      }
    });

    const res = await client.issuer.getIssuerAsOcf({ contractId: 'issuer-1' });
    expect(res).toEqual({
      contractId: 'issuer-1',
      issuer: {
        id: 'iss-1',
        object_type: 'ISSUER',
        legal_name: 'ACME Inc.',
        country_of_formation: 'US',
        formation_date: '2025-01-01'
      }
    });
  });
});


