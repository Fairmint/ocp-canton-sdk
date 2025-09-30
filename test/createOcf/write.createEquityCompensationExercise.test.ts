import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createEquityCompensationExercise', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createEquityCompensationExercise');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_equity_compensation_exercise-5a9b5b82-8c18-4dd4-804a-bcec60faefb8.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '4e4790::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockPlan.createEquityCompensationExercise({
      issuerContractId: '00f25a5cb8e1030949dfd61134056091deb787e3774466b7c20f93998e27f97382ca111220c1ab38d3121b55c0c2234fd564e745fde7b373b8109ac89591ae94bf623a2681',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      exerciseData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('122070945f039dad73b1f4dc1970e3d8bdf023f2354a4a094200adbdc174e9f765f2');
  });
});
