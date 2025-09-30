import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockPlan', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockPlan');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/stock_plan-ee2bd2da-fbf8-4073-bd39-26809027f0e0.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '257503::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockPlan.createStockPlan({
      issuerContractId: '005b768651ac441feb6e17b480787a13dafec09d3f3b6f3c645517cb092ee33f9bca1112203991499ab1ec9f4590bddcae4e8aa64540dcc3cad2a3f5ae1237019a4c4dfa16',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      planData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220dbdb890e741a2df21354a9dd71922acf675a1cc5ee9fe8eb94cef643a9cca88d');
  });
});
