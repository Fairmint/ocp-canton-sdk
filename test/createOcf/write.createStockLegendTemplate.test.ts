import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockLegendTemplate', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockLegendTemplate');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/stock_legend_template-4c59459e-1683-4248-b7c3-ab9f46f0ccfe.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '57de5b::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockLegendTemplate.createStockLegendTemplate({
      issuerContractId: '00e3a747a6d4004365c5c2ebb2b4b34474328d00cfb4243acc396887900de51c1dca11122018261710f8fd28544c023edd1243b120ddf0fcc1e69ae9f6f21d5967f2debc19',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      templateData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220efdee0a55afc7d7c20396a64014f992cb3d2957d521ee7cf5e2eec7041fdae2c');
  });
});
