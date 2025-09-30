import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockIssuance', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockIssuance');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_stock_issuance-6057992e-ebc4-e178-cf20-338b7effda82.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = 'e5eb6f::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockIssuance.createStockIssuance({
      issuerContractId: '001d806841ae6f9fc56e1409ba969bb9abbb71f10f4c02426d2d9af8d2523efb83ca11122095d72f7e1b3c5fd58f212c717fa17d1b350162ebf387a8527bb7518f16328f89',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      issuanceData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220e4189877808e32812d5a4795604b6227a3c5e28958f940293f70b471229b3af0');
  });
});
