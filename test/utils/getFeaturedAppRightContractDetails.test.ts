import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { ClientConfig } from '@fairmint/canton-node-sdk';

describe('getFeaturedAppRightContractDetails', () => {
  test('returns mocked featured app right details', async () => {
    const config: ClientConfig = {
      network: 'devnet',
    };

    const validatorApi = new ValidatorApiClient(config);
    const featured = await getFeaturedAppRightContractDetails(validatorApi);

    expect(featured).toEqual({
      templateId: 'a5b055492fb8f08b2e7bc0fc94da6da50c39c2e1d7f24cd5ea8db12fc87c1332:Splice.Amulet:FeaturedAppRight',
      contractId:
        '003533ff9d4e6f03bef0eaba92e8821e9f9f185565c2cdb5977a2112bd194e9915ca111220c1653beb7399dc66686ddc720bdeba2418ab7de1f1bd7237c389e62ccd0c7c17',
      createdEventBlob: expect.any(String),
      synchronizerId: 'global-domain::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a',
    });
  });
});
