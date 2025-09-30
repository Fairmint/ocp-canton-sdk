import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createVestingTerms', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createVestingTerms');
  });

  afterEach(() => {
    clearTransactionTreeFixture();
  });

  test('Basic', async () => {
    const config: ClientConfig = {
      network: 'devnet'
    };

    const validatorApi = new ValidatorApiClient(config);
    const featured = await getFeaturedAppRightContractDetails(validatorApi);
    const client = new OcpClient(config);

    // Load raw item data dynamically from OCF API format
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/vesting_terms-e7742df1-7c48-47e9-9c03-9c0cc2b83278.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '4f567c::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.vestingTerms.createVestingTerms({
      issuerContractId: '0019dabd34885de087b85c648702f2982d5d914b637f9f715637b0ae7ebe425ed9ca11122082e2f75ae84a2c77639b624a0784265234204291dbac187f4867019d8b23be75',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      vestingTermsData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220aea4174a24399f3f93dd2dd8c685df808fbff0ccb95f4734e026d9e4745e75d1');
  });
});
