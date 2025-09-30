import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixture, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('write: createStakeholder', () => {
  beforeEach(() => {
    setTransactionTreeFixture('createStakeholder');
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
    const rawItemPath = path.join(__dirname, '../fixtures/ocpClient/rawItems/stakeholder-0a284e00-a2e9-48eb-980b-4752787323fd.json');
    const rawItemData = JSON.parse(fs.readFileSync(rawItemPath, 'utf8'));
    
    // Remove OCF-only metadata fields
    const { object_type, option_grant_type, ...itemData } = rawItemData;

    const issuerParty = '66ff16::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34';

    const result = await client.stakeholder.createStakeholder({
      issuerContractId: '0079d1f0a8330e7e30b8a454231b164803a1c9859a1312d9bbf7910c05535ddcafca11122054b69ef493094d6e26aa2ecdfa10e252f98944945164ea878d4e12f4298c4eb4',
      featuredAppRightContractDetails: featured,
      issuerParty,
      stakeholderData: itemData
    });

    // Verify result structure
    expect(result).toEqual({
      contractId: '002ebbef74c6813f80e43e3f1c76dbce215aae868805a3d85dd8282a205d0dbaf7ca111220a28a1dfab3b54d033469c84823b11c4298032a227808c9b543618b81a5809911',
      updateId: '1220faf461e8afb9546a8cbff8491fa66b65e9ac9790f817fd72eaa243d6e648f740'
    });
  });
});
