import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixtureData, clearTransactionTreeFixture, setEventsFixtureData, clearEventsFixture, convertTransactionTreeToEventsResponse } from '../utils/fixtureHelpers';
import { validateOcfObject } from '../utils/ocfSchemaValidator';
import * as fs from 'fs';
import * as path from 'path';
import { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';

interface TestFixture {
  functionName: string;
  db: Record<string, unknown>;
  testContext: {
    issuerContractId: string;
    issuerParty: string;
    issuerAuthorizationContractDetails?: DisclosedContract & {
      response?: any;
      synchronizerId?: string;
    };
  };
  request: Record<string, unknown>;
  response?: any;
  synchronizerId?: string;
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
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        
        // Build the expected disclosed contracts array
        const disclosedContracts: DisclosedContract[] = [];
        
        // For issuer creation, include the issuer authorization contract
        if (fixture.db.object_type === 'ISSUER' && fixture.testContext.issuerAuthorizationContractDetails) {
          // Extract only the required DisclosedContract fields
          const authContract = fixture.testContext.issuerAuthorizationContractDetails;
          disclosedContracts.push({
            contractId: authContract.contractId,
            createdEventBlob: authContract.createdEventBlob,
            synchronizerId: authContract.synchronizerId,
            templateId: authContract.templateId
          });
        }
        
        // Always include the featured app right
        disclosedContracts.push(featuredAppRight);

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
              disclosedContracts,
            }
          },
        };
        
        setTransactionTreeFixtureData(fixtureData);
      });

      afterEach(() => {
        clearTransactionTreeFixture();
      });

      test('validates request and returns expected response', async () => {
        // Validate input OCF data against schema
        await validateOcfObject(fixture.db);

        const config: ClientConfig = {
          network: 'devnet'
        };

        const validatorApi = new ValidatorApiClient(config);
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        const client = new OcpClient(config);

        // ISSUER has different input requirements, so handle it separately
        const result = fixture.db.object_type === 'ISSUER'
          ? await client.issuer.createIssuer({
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              issuerData: fixture.db as any,
              issuerAuthorizationContractDetails: fixture.testContext.issuerAuthorizationContractDetails!
            })
          : await client.createOcfObject({
              issuerContractId: fixture.testContext.issuerContractId,
              featuredAppRightContractDetails: featuredAppRight,
              issuerParty: fixture.testContext.issuerParty,
              ocfData: fixture.db as { object_type: string; [key: string]: unknown }
            });

        // Verify result structure
        expect(result).toBeDefined();
        expect(result.contractId).toBeDefined();
        expect(typeof result.contractId).toBe('string');
        expect(result.contractId.length).toBeGreaterThan(0);
        expect(result.updateId).toBeDefined();
      });

      test('get*AsOcf returns expected OCF data', async () => {
        // Determine where the response is located
        const response = fixture.response || fixture.testContext.issuerAuthorizationContractDetails?.response;
        const synchronizerId = fixture.synchronizerId || fixture.testContext.issuerAuthorizationContractDetails?.synchronizerId || '';

        // Skip this test if there's no response data (required for events mock)
        if (!response) {
          return;
        }

        const config: ClientConfig = {
          network: 'devnet'
        };

        // Convert the transaction tree response to events format
        const eventsResponse = convertTransactionTreeToEventsResponse(
          response,
          synchronizerId
        );

        // Set up the events fixture
        setEventsFixtureData(eventsResponse);

        try {
          const client = new OcpClient(config);
          const contractId = 'test-contract-id';

          let result: any;
          let expectedOcf: any;

          switch (fixture.db.object_type) {
            case 'ISSUER':
              result = await client.issuer.getIssuerAsOcf({ contractId });
              expectedOcf = { issuer: fixture.onchain_ocf, contractId };
              break;
            case 'STOCK_CLASS':
              result = await client.stockClass.getStockClassAsOcf({ contractId });
              expectedOcf = { stockClass: fixture.onchain_ocf, contractId };
              break;
            case 'STAKEHOLDER':
              result = await client.stakeholder.getStakeholderAsOcf({ contractId });
              expectedOcf = { stakeholder: fixture.onchain_ocf, contractId };
              break;
            case 'STOCK_LEGEND_TEMPLATE':
              result = await client.stockLegendTemplate.getStockLegendTemplateAsOcf({ contractId });
              expectedOcf = { stockLegendTemplate: fixture.onchain_ocf, contractId };
              break;
            case 'VESTING_TERMS':
              result = await client.vestingTerms.getVestingTermsAsOcf({ contractId });
              expectedOcf = { vestingTerms: fixture.onchain_ocf, contractId };
              break;
            case 'STOCK_PLAN':
              result = await client.stockPlan.getStockPlanAsOcf({ contractId });
              expectedOcf = { stockPlan: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_ISSUANCE':
              result = await client.stockIssuance.getStockIssuanceAsOcf({ contractId });
              expectedOcf = { stockIssuance: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_CANCELLATION':
              result = await client.stockCancellation.getStockCancellationEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
              result = await client.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
              result = await client.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
              result = await client.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_EQUITY_COMPENSATION_ISSUANCE':
              result = await client.stockPlan.getEquityCompensationIssuanceEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_EQUITY_COMPENSATION_EXERCISE':
              result = await client.stockPlan.getEquityCompensationExerciseEventAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'DOCUMENT':
              result = await client.document.getDocumentAsOcf({ contractId });
              expectedOcf = { document: fixture.onchain_ocf, contractId };
              break;
            case 'TX_WARRANT_ISSUANCE':
              result = await client.warrantIssuance.getWarrantIssuanceAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_CONVERTIBLE_ISSUANCE':
              result = await client.convertibleIssuance.getConvertibleIssuanceAsOcf({ contractId });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            default:
              throw new Error(`Unsupported object type: ${fixture.db.object_type}`);
          }

          // Verify the result matches expected OCF
          expect(result).toEqual(expectedOcf);

          // Validate the returned OCF data against schema
          // Extract the actual OCF object from the result (remove contractId wrapper)
          const ocfData = Object.values(result).find((val) => 
            typeof val === 'object' && val !== null && 'object_type' in val
          ) as Record<string, unknown>;
          
          await validateOcfObject(ocfData);
        } finally {
          clearEventsFixture();
        }
      });
    });
  });
});
