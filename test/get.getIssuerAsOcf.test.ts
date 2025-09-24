import { OcpClient } from '../src';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LedgerJsonApiClient } = require('@fairmint/canton-node-sdk');

describe('get: getIssuerAsOcf', () => {
  test('maps network response to expected OCF issuer (file-backed fixture)', async () => {
    const client = new OcpClient({ network: 'devnet' });
    const res = await client.issuer.getIssuerAsOcf({ contractId: 'issuer-1' });
    console.log(res);
    expect(res).toEqual({
      issuer: {
        object_type: 'ISSUER',
        id: '66ff16f7-5f65-4a78-9011-fac4a8596efc',
        legal_name: 'Fairmint Inc.',
        country_of_formation: 'US',
        formation_date: '2019-04-23',
        country_subdivision_of_formation: 'DE',
        tax_ids: [],
        initial_shares_authorized: '15000000.0000000000',
        comments: []
      },
      contractId: 'issuer-1'
    });
  });
});


