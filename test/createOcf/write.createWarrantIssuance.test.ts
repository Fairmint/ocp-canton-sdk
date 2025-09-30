import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createWarrantIssuance', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createWarrantIssuance');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/tx_warrant_issuance-66d91301-1382-4564-a0cf-75a5a4524294.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '947a53::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.warrantIssuance.createWarrantIssuance({
      issuerContractId: '00bd0fe4760d580f008195eeee9cda4cfd0392d7f2f33bd99fdc06fe3561e6b796ca11122016dc981de24077bad5a124295707057ebea3aeebe134a258c2c0813e15b88ed8',
      featuredAppRightContractDetails: featured,
      issuerParty,
      
      issuanceData: itemData
    });

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.contractId).toBeDefined();
    expect(typeof result.contractId).toBe('string');
    expect(result.contractId.length).toBeGreaterThan(0);
    expect(result.updateId).toBe('1220fcc44a625eec5cc24a58cef84ef6c257e34951633b9a6368be07760c1b8c0a3c');
  });
});
