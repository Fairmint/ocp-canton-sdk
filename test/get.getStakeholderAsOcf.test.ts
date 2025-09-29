import { OcpClient } from '../src';

describe('get: getStakeholderAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stakeholder.getStakeholderAsOcf({ contractId: 'stakeholder-minimal' });
    expect(res).toEqual({
      stakeholder: {
        object_type: 'STAKEHOLDER',
        id: 'st-1',
        name: { legal_name: 'Alice' },
        stakeholder_type: 'INDIVIDUAL',
        addresses: [],
        tax_ids: []
      },
      contractId: 'stakeholder-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stakeholder.getStakeholderAsOcf({ contractId: 'stakeholder-full' });
    expect(res).toEqual({
      stakeholder: {
        object_type: 'STAKEHOLDER',
        id: 'st-2',
        name: { legal_name: 'Bob', first_name: 'Bob', last_name: 'Builder' },
        stakeholder_type: 'INSTITUTION',
        issuer_assigned_id: 'EMP-1',
        current_relationships: ['INVESTOR', 'BOARD_MEMBER'],
        primary_contact: {
          name: { legal_name: 'Jane Smith', first_name: 'Jane', last_name: 'Smith' },
          phone_numbers: [ { phone_type: 'BUSINESS', phone_number: '+1 415 555 0000' } ],
          emails: [ { email_type: 'BUSINESS', email_address: 'jane@example.com' } ]
        },
        contact_info: {
          phone_numbers: [ { phone_type: 'MOBILE', phone_number: '+1 415 555 1111' } ],
          emails: [ { email_type: 'PERSONAL', email_address: 'bob@example.com' } ]
        },
        addresses: [ { address_type: 'LEGAL', country: 'US', city: 'SF', postal_code: '94105' } ],
        tax_ids: [ { country: 'US', tax_id: '12-3456789' } ],
        comments: ['VIP investor']
      },
      contractId: 'stakeholder-full'
    });
  });
});


