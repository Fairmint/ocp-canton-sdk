import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockPlanPoolAdjustment', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockPlanPoolAdjustment');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_stock_plan_pool_adjustment-282200ac-926d-49d2-957b-084db9c07c38.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '1b2149::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockPlanPoolAdjustment.createStockPlanPoolAdjustment({
      issuerContractId: '003a3ffd1fb411e2c7408850f36c3e632490c3116d0aca7e294af52a505ef73b01ca111220ae870a4ef00bfaa0b14f56899e5e363585e0010cdd66c9f0b3b0937749d4a8dd',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      adjustmentData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220585d78c181b2f5b7a9f589cad3a3505b9e0184826f7c24fda3a4383eb5f3fdb3');
  });
});
