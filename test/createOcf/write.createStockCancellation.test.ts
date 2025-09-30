import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockCancellation', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockCancellation');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_stock_cancellation-ba60e9d6-1e85-43ac-94bc-f0c4745a2dbe.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '21d0ed::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockCancellation.createStockCancellation({
      issuerContractId: '0012975f9b257503c7db27b38fde1fbe5ae2d24ce72468dbe2dfd3d1d1a2caf001ca111220d68ece50e56e877aa638bb29885f5a503d2f1e10a8f8daa0e6873c2575435787',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      cancellationData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220253f1c217e4cb9d630fd2335ebdbe61ab5bb2da2e4245ce068c4a2407b2091ad');
  });
});
