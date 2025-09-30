import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createConvertibleIssuance', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createConvertibleIssuance');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_convertible_issuance-72a00893-ace6-4a9e-9881-5e79a06af2b2.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '3bf3b4::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.convertibleIssuance.createConvertibleIssuance({
      issuerContractId: '003c65cc842f023a05d7b5e3d09bbaba106b3ac45b04b2141b4c0494024dfcdd8fca11122001057bb13e472d75a079623e8bd84676eb237ed1d7c29bc38ba85e0da36367a2',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      issuanceData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220017c6469795528b9c113af7f0cd19256d590ba185446ce004b5c1dc7030cb61a');
  });
});
