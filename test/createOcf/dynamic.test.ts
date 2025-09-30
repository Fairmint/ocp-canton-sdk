import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcfIssuerData, OcfStakeholderData, OcfStockClassData, OcfStockLegendTemplateData, OcfVestingTermsData, OcfStockPlanData, OcfStockIssuanceData, OcfDocumentData, OcpClient } from '../../src';
import { setTransactionTreeFixtureData, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';
import { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';

interface TestFixture {
  functionName: string;
  db: Record<string, unknown>;
  testContext: {
    issuerContractId: string;
    issuerParty: string;
    issuerAuthorizationContractDetails?: DisclosedContract;
  };
  request: Record<string, unknown>;
  onchain_ocf: Record<string, unknown>;
}

// Load all fixtures from the fixtures directory
function loadFixtures(): Array<{ name: string; fixture: TestFixture }> {
  const fixturesDir = path.join(__dirname, '../fixtures/createOcf');
  
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
  
  return files.map(filename => {
    const fixturePath = path.join(fixturesDir, filename);
    const fileContent = fs.readFileSync(fixturePath, 'utf-8');
    const fixture = JSON.parse(fileContent) as TestFixture;
    const testName = filename.replace('.json', '');
    
    return { name: testName, fixture };
  });
}

describe('OCP Client - Dynamic Create Tests', () => {
  const fixtures = loadFixtures();

  if (fixtures.length === 0) {
    test('No fixtures found', () => {
      console.warn('No fixture files found in test/fixtures/createOcf/');
    });
    return;
  }

  fixtures.forEach(({ name, fixture }) => {
    describe(name, () => {
      beforeEach(async () => {
        const config: ClientConfig = {
          network: 'devnet'
        };
        const validatorApi = new ValidatorApiClient(config);

        // Set up the fixture data directly without file I/O
        const fixtureData = {
          ...fixture,
          timestamp: new Date().toISOString(),
          url: 'https://ledger-api.validator.devnet.transfer-agent.xyz/v2/commands/submit-and-wait-for-transaction-tree',
          request: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
              commands: [fixture.request],
              actAs: [fixture.testContext.issuerParty],
              disclosedContracts: [await getFeaturedAppRightContractDetails(validatorApi)],
            }
          },
        };
        
        setTransactionTreeFixtureData(fixtureData);
      });

      afterEach(() => {
        clearTransactionTreeFixture();
      });

      test('validates request and returns expected response', async () => {
        const config: ClientConfig = {
          network: 'devnet'
        };

        const validatorApi = new ValidatorApiClient(config);
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        const client = new OcpClient(config);

        let result;
        switch (fixture.db.object_type) {
          case 'ISSUER':
            result = await client.issuer.createIssuer({
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              issuerData: fixture.db as unknown as OcfIssuerData,
              issuerAuthorizationContractDetails: fixture.testContext.issuerAuthorizationContractDetails!
            });
            break;
          case 'STOCK_CLASS':
            result = await client.stockClass.createStockClass({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              stockClassData: fixture.db as unknown as OcfStockClassData
            });
            break;
          case 'STAKEHOLDER':
            result = await client.stakeholder.createStakeholder({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              stakeholderData: fixture.db as unknown as OcfStakeholderData
            });
            break;
          case 'STOCK_LEGEND_TEMPLATE':
            result = await client.stockLegendTemplate.createStockLegendTemplate({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              templateData: fixture.db as unknown as OcfStockLegendTemplateData
            });
            break;
          case 'VESTING_TERMS':
            result = await client.vestingTerms.createVestingTerms({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              vestingTermsData: fixture.db as unknown as OcfVestingTermsData
            });
            break;
          case 'STOCK_PLAN':
            result = await client.stockPlan.createStockPlan({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              planData: fixture.db as unknown as OcfStockPlanData
            });
            break;
          case 'TX_STOCK_ISSUANCE':
            result = await client.stockIssuance.createStockIssuance({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              issuanceData: fixture.db as unknown as OcfStockIssuanceData
            });
            break;
          case 'TX_STOCK_CANCELLATION':
            result = await client.stockCancellation.createStockCancellation({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              cancellationData: fixture.db as any
            });
            break;
          case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
            result = await client.issuerAuthorizedSharesAdjustment.createIssuerAuthorizedSharesAdjustment({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              adjustmentData: fixture.db as any
            });
            break;
          case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
            result = await client.stockClassAuthorizedSharesAdjustment.createStockClassAuthorizedSharesAdjustment({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              adjustmentData: fixture.db as any
            });
            break;
          case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
            result = await client.stockPlanPoolAdjustment.createStockPlanPoolAdjustment({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              adjustmentData: fixture.db as any
            });
            break;
          case 'TX_EQUITY_COMPENSATION_ISSUANCE':
            result = await client.stockPlan.createEquityCompensationIssuance({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              issuanceData: fixture.db as any
            });
            break;
          case 'TX_EQUITY_COMPENSATION_EXERCISE':
            result = await client.stockPlan.createEquityCompensationExercise({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              exerciseData: fixture.db as any
            });
            break;
          case 'DOCUMENT':
            result = await client.document.createDocument({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              documentData: fixture.db as unknown as OcfDocumentData
            });
            break;
          default:
            throw new Error(`Unsupported object type: ${fixture.db.object_type}`);
        }

        // Verify result structure
        expect(result).toBeDefined();
        expect(result.contractId).toBeDefined();
        expect(typeof result.contractId).toBe('string');
        expect(result.contractId.length).toBeGreaterThan(0);
        expect(result.updateId).toBeDefined();
      });
    });
  });
});
