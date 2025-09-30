import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockClassAuthorizedSharesAdjustment', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockClassAuthorizedSharesAdjustment');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_stock_class_authorized_shares_adjustment-bc2e4a2c-8b00-4725-84e6-d905ca4dfa1d.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '824748::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockClassAuthorizedSharesAdjustment.createStockClassAuthorizedSharesAdjustment({
      issuerContractId: '002ae048ab56a519d8afcd1410aae68d6bdc2e1f2c129b15e89f5bf559000c6bb9ca1112205e6805b9038ebcb5eba45dbe94d0dceb09215a9d03f4fe51f3ad0f4a0647b3ff',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      adjustmentData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220298de15bc12a02755d723d9d2e75ce952f713366b9cd086fcf110f5bf7b350a6');
  });
});
