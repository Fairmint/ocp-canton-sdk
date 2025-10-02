import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas';
import * as fs from 'fs';
import * as path from 'path';
import { type OcfIssuerData, OcpClient } from '../../src';
import {
  clearEventsFixture,
  clearTransactionTreeFixture,
  convertTransactionTreeToEventsResponse,
  setEventsFixtureData,
  setTransactionTreeFixtureData,
} from '../utils/fixtureHelpers';
import { validateOcfObject } from '../utils/ocfSchemaValidator';

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

  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  return files.map((filename) => {
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
          network: 'devnet',
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
            templateId: authContract.templateId,
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
            },
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
          network: 'devnet',
        };

        const validatorApi = new ValidatorApiClient(config);
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        const client = new OcpClient(config);

        // Build the command based on object type
        const commandWithDisclosed =
          fixture.db.object_type === 'ISSUER'
            ? client.issuer.buildCreateIssuerCommand({
                featuredAppRightContractDetails: featuredAppRight,
                issuerParty: fixture.testContext.issuerParty,
                issuerData: fixture.db as unknown as OcfIssuerData,
                issuerAuthorizationContractDetails: fixture.testContext.issuerAuthorizationContractDetails!,
              })
            : client.buildCreateOcfObjectCommand({
                issuerContractId: fixture.testContext.issuerContractId,
                featuredAppRightContractDetails: featuredAppRight,
                issuerParty: fixture.testContext.issuerParty,
                ocfData: fixture.db as { object_type: string; [key: string]: unknown },
              })[0]; // For non-ISSUER types, we get an array, take the first command

        // Execute the command
        const response = (await client.client.submitAndWaitForTransactionTree({
          actAs: [fixture.testContext.issuerParty],
          commands: [commandWithDisclosed.command],
          disclosedContracts: commandWithDisclosed.disclosedContracts,
        })) as SubmitAndWaitForTransactionTreeResponse;

        // Verify result structure
        expect(response).toBeDefined();
        expect(response.transactionTree).toBeDefined();

        // Access eventsById - fixtures have the structure transactionTree.transaction.eventsById
        const transaction = (response.transactionTree as any).transaction ?? response.transactionTree;
        expect(transaction.eventsById).toBeDefined();
        expect(Object.keys(transaction.eventsById).length).toBeGreaterThan(0);

        // Find any created event
        const createdEvent = Object.values(transaction.eventsById).find((event: any) => event.CreatedTreeEvent);

        expect(createdEvent).toBeDefined();
        const { contractId } = (createdEvent as any).CreatedTreeEvent.value;
        expect(contractId).toBeDefined();
        expect(typeof contractId).toBe('string');
        expect(contractId.length).toBeGreaterThan(0);
      });

      test('builds archive and create commands when previousContractId is provided', async () => {
        // Skip this test for types that don't support archiving or have different requirements
        const unsupportedTypes = ['ISSUER', 'TX_EQUITY_COMPENSATION_EXERCISE', 'TX_EQUITY_COMPENSATION_ISSUANCE'];
        if (unsupportedTypes.includes(fixture.db.object_type as string)) {
          return;
        }

        const config: ClientConfig = {
          network: 'devnet',
        };

        const validatorApi = new ValidatorApiClient(config);
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        const client = new OcpClient(config);

        // Build commands without previousContractId
        const commandsWithoutArchive = client.buildCreateOcfObjectCommand({
          issuerContractId: fixture.testContext.issuerContractId,
          featuredAppRightContractDetails: featuredAppRight,
          issuerParty: fixture.testContext.issuerParty,
          ocfData: fixture.db as { object_type: string; [key: string]: unknown },
        });

        // Should return array with 1 command (create only)
        expect(Array.isArray(commandsWithoutArchive)).toBe(true);
        expect(commandsWithoutArchive.length).toBe(1);
        expect(commandsWithoutArchive[0]).toHaveProperty('command');
        expect(commandsWithoutArchive[0]).toHaveProperty('disclosedContracts');
        expect(commandsWithoutArchive[0].command).toHaveProperty('ExerciseCommand');

        // Build commands with previousContractId
        const previousContractId = 'placeholder-previous-contract-id-123';
        const commandsWithArchive = client.buildCreateOcfObjectCommand({
          issuerContractId: fixture.testContext.issuerContractId,
          featuredAppRightContractDetails: featuredAppRight,
          issuerParty: fixture.testContext.issuerParty,
          ocfData: fixture.db as { object_type: string; [key: string]: unknown },
          previousContractId,
        });

        // Should return array with 2 commands (archive + create)
        expect(Array.isArray(commandsWithArchive)).toBe(true);
        expect(commandsWithArchive.length).toBe(2);

        // First command should be archive
        const archiveCommand = commandsWithArchive[0];
        expect(archiveCommand).toHaveProperty('command');
        expect(archiveCommand).toHaveProperty('disclosedContracts');
        expect(archiveCommand.command).toHaveProperty('ExerciseCommand');

        // Type guard to ensure ExerciseCommand exists
        if ('ExerciseCommand' in archiveCommand.command) {
          expect(archiveCommand.command.ExerciseCommand).toHaveProperty('contractId', previousContractId);
          // Archive command choice should contain 'Archive'
          expect(archiveCommand.command.ExerciseCommand.choice).toContain('Archive');
        } else {
          throw new Error('Expected archive command to be an ExerciseCommand');
        }

        // Second command should be create (same as without archive)
        const createCommand = commandsWithArchive[1];
        expect(createCommand).toHaveProperty('command');
        expect(createCommand).toHaveProperty('disclosedContracts');
        expect(createCommand.command).toHaveProperty('ExerciseCommand');

        // Create command should match the one built without archive
        if ('ExerciseCommand' in createCommand.command && 'ExerciseCommand' in commandsWithoutArchive[0].command) {
          expect(createCommand.command.ExerciseCommand.choice).toBe(
            commandsWithoutArchive[0].command.ExerciseCommand.choice
          );
        } else {
          throw new Error('Expected create command to be an ExerciseCommand');
        }

        // Both commands should have disclosed contracts
        expect(Array.isArray(archiveCommand.disclosedContracts)).toBe(true);
        expect(archiveCommand.disclosedContracts.length).toBeGreaterThan(0);
        expect(Array.isArray(createCommand.disclosedContracts)).toBe(true);
        expect(createCommand.disclosedContracts.length).toBeGreaterThan(0);
      });

      test('get*AsOcf returns expected OCF data', async () => {
        // Determine where the response is located
        const response = fixture.response ?? fixture.testContext.issuerAuthorizationContractDetails?.response;
        const synchronizerId =
          fixture.synchronizerId ?? fixture.testContext.issuerAuthorizationContractDetails?.synchronizerId ?? '';

        // Skip this test if there's no response data (required for events mock)
        if (!response) {
          return;
        }

        const config: ClientConfig = {
          network: 'devnet',
        };

        // Convert the transaction tree response to events format
        const eventsResponse = convertTransactionTreeToEventsResponse(response, synchronizerId);

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
              result = await client.stockCancellation.getStockCancellationEventAsOcf({
                contractId,
              });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
              result = await client.issuerAuthorizedSharesAdjustment.getIssuerAuthorizedSharesAdjustmentEventAsOcf({
                contractId,
              });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
              result =
                await client.stockClassAuthorizedSharesAdjustment.getStockClassAuthorizedSharesAdjustmentEventAsOcf({
                  contractId,
                });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
              result = await client.stockPlanPoolAdjustment.getStockPlanPoolAdjustmentEventAsOcf({
                contractId,
              });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_EQUITY_COMPENSATION_ISSUANCE':
              result = await client.stockPlan.getEquityCompensationIssuanceEventAsOcf({
                contractId,
              });
              expectedOcf = { event: fixture.onchain_ocf, contractId };
              break;
            case 'TX_EQUITY_COMPENSATION_EXERCISE':
              result = await client.stockPlan.getEquityCompensationExerciseEventAsOcf({
                contractId,
              });
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
              throw new Error(`Unsupported object type: ${String(fixture.db.object_type)}`);
          }

          // Verify the result matches expected OCF
          expect(result).toEqual(expectedOcf);

          // Validate the returned OCF data against schema
          // Extract the actual OCF object from the result (remove contractId wrapper)
          const ocfData = Object.values(result).find(
            (val) => typeof val === 'object' && val !== null && 'object_type' in val
          ) as Record<string, unknown>;

          await validateOcfObject(ocfData);
        } finally {
          clearEventsFixture();
        }
      });
    });
  });
});
