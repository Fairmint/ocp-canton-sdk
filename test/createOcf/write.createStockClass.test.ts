import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStockClass', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStockClass');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/stock_class-93feb8f8-f8b6-4be6-ae10-d5cab38a9baf.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '926233::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stockClass.createStockClass({
      issuerContractId: '00620e528248eb8fcdc75903835191d254313a86a43f17d473e8c597cae6e6ce50ca11122055afe851d0332ce4a9ba334dcc0dd748ace4dc40cf91279ffb3e71b8cde5d7a0',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      stockClassData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('12203b3f08dcc4bf5f10c1872151e3fe1acdee781c64fee67bdba3f797c4901554c9');
  });
});
