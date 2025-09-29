import { OcpClient } from '../src';

describe('get: getVestingTermsAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.vestingTerms.getVestingTermsAsOcf({ contractId: 'vt-minimal' });
    expect(res).toEqual({
      vestingTerms: {
        object_type: 'VESTING_TERMS',
        id: 'vt-1',
        name: '1 year cliff',
        description: 'Standard',
        allocation_type: 'FRONT_LOADED',
        vesting_conditions: [],
        comments: []
      },
      contractId: 'vt-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.vestingTerms.getVestingTermsAsOcf({ contractId: 'vesting-terms-full' });
    expect(res).toEqual({
      vestingTerms: {
        object_type: 'VESTING_TERMS',
        id: 'e7742df1-7c48-47e9-9c03-9c0cc2b83278',
        name: "SOIRÉ Goods Founder's Stock Vesting",
        description: "Vesting terms for 8,000,000 shares issued to Kash Rogers under the Founder's Stock Purchase Agreement dated August 8, 2024. The vesting schedule includes 10% immediate vesting, a 1-year cliff for 15%, and monthly vesting over 36 months for the remaining 75%.",
        allocation_type: 'CUMULATIVE_ROUNDING',
        vesting_conditions: [],
        comments: []
      },
      contractId: 'vesting-terms-full'
    });
  });
});


