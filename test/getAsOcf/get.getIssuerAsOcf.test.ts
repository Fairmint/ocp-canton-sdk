import { OcpClient } from '../../src';

describe('get: getIssuerAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.issuer.getIssuerAsOcf({ contractId: 'issuer-minimal' });
    expect(res).toEqual({
      issuer: {
        object_type: 'ISSUER',
        id: '66ff16f7-5f65-4a78-9011-fac4a8596efc',
        legal_name: 'Fairmint Inc.',
        country_of_formation: 'US',
        formation_date: '2019-04-23',
        tax_ids: [],
        comments: []
      },
      contractId: 'issuer-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.issuer.getIssuerAsOcf({ contractId: 'issuer-full' });
    expect(res).toEqual({
      issuer: {
        object_type: 'ISSUER',
        id: '87685711-93e5-4998-b332-9c5bbadf4b5c',
        legal_name: 'Magnetic Media Holdings, Inc.',
        country_of_formation: 'US',
        formation_date: '2006-11-13',
        tax_ids: [  {
             country: "US",
             tax_id: "208420066",
           } ],
        comments: ["Here is a comment", "Here is another comment"],
        dba: 'Magnetic 3D',
        country_subdivision_of_formation: 'DE',
        email: { email_type: 'BUSINESS', email_address: 'support@magnetic3d.com' },
        phone: { phone_type: 'MOBILE', phone_number: '+1 612 234 2345' },
        address: {
          address_type: 'LEGAL',
          country: 'US',
          street_suite: '450 Lexington Avenue, 4th floor',
          city: 'New York City',
          country_subdivision: 'NY',
          postal_code: '10017'
        },
        initial_shares_authorized: '191500.0000000000',
        country_subdivision_name_of_formation: 'The text name of state, province, or subdivision where the issuer company was legally formed if the code is not available'
      },
      contractId: 'issuer-full'
    });
  });
});


