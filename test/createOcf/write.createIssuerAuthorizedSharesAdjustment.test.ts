import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createIssuerAuthorizedSharesAdjustment', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createIssuerAuthorizedSharesAdjustment');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_issuer_authorized_shares_adjustment-1c80380c-37ed-41dd-2fbd-85294bbbeae3.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '55a780::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.issuerAuthorizedSharesAdjustment.createIssuerAuthorizedSharesAdjustment({
      issuerContractId: '00bcb6ca2191742fb1c1b3dea10c5de0bce674a27ad4ba2d71243137918380a79bca111220e7f12b545eb3f422740a39bad4266b6e4dcadf05335a18b2e8ebec4819071b09',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      adjustmentData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('122062594f41c48107f63605b229364b7779ca45dd84de3f164e3e87ed3ff041e21b');
  });
});
