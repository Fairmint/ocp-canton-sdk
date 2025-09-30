import { ClientConfig, getFeaturedAppRightContractDetails, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src';
import { setTransactionTreeFixtureData, clearTransactionTreeFixture } from '../utils/fixtureHelpers';
import * as fs from 'fs';
import * as path from 'path';

interface TestFixture {
  functionName: string;
  dbInput: Record<string, unknown>;
  testContext: {
    issuerContractId: string;
    issuerParty: string;
    [key: string]: unknown;
  };
  expectedRequest: {
    commands: Array<Record<string, unknown>>;
    actAs: string[];
    disclosedContracts: Array<Record<string, unknown>>;
  };
  expectedResponse: {
    transactionTree: Record<string, unknown>;
  };
}

interface FunctionMapping {
  namespace: keyof OcpClient;
  functionName: string;
  buildParams: (fixture: TestFixture, featuredAppRight: unknown) => Record<string, unknown>;
}

// Map test fixture function names to OcpClient paths and parameter builders
const FUNCTION_MAPPINGS: Record<string, FunctionMapping> = {
  createDocument: {
    namespace: 'document',
    functionName: 'createDocument',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...documentData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        documentData
      };
    }
  },
  createStockClass: {
    namespace: 'stockClass',
    functionName: 'createStockClass',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...stockClassData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        stockClassData
      };
    }
  },
  createStakeholder: {
    namespace: 'stakeholder',
    functionName: 'createStakeholder',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...stakeholderData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        stakeholderData
      };
    }
  },
  createStockLegendTemplate: {
    namespace: 'stockLegendTemplate',
    functionName: 'createStockLegendTemplate',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...templateData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        templateData
      };
    }
  },
  createVestingTerms: {
    namespace: 'vestingTerms',
    functionName: 'createVestingTerms',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...vestingTermsData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        vestingTermsData
      };
    }
  },
  createStockPlan: {
    namespace: 'stockPlan',
    functionName: 'createStockPlan',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...planData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        planData
      };
    }
  },
  createConvertibleIssuance: {
    namespace: 'convertibleIssuance',
    functionName: 'createConvertibleIssuance',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...issuanceData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        issuanceData
      };
    }
  },
  createWarrantIssuance: {
    namespace: 'warrantIssuance',
    functionName: 'createWarrantIssuance',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...issuanceData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        issuanceData
      };
    }
  },
  createStockIssuance: {
    namespace: 'stockIssuance',
    functionName: 'createStockIssuance',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...issuanceData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        issuanceData
      };
    }
  },
  createStockCancellation: {
    namespace: 'stockCancellation',
    functionName: 'createStockCancellation',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...cancellationData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        cancellationData
      };
    }
  },
  createIssuerAuthorizedSharesAdjustment: {
    namespace: 'issuerAuthorizedSharesAdjustment',
    functionName: 'createIssuerAuthorizedSharesAdjustment',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...adjustmentData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        adjustmentData
      };
    }
  },
  createStockClassAuthorizedSharesAdjustment: {
    namespace: 'stockClassAuthorizedSharesAdjustment',
    functionName: 'createStockClassAuthorizedSharesAdjustment',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...adjustmentData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        adjustmentData
      };
    }
  },
  createStockPlanPoolAdjustment: {
    namespace: 'stockPlanPoolAdjustment',
    functionName: 'createStockPlanPoolAdjustment',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...adjustmentData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        adjustmentData
      };
    }
  },
  createEquityCompensationExercise: {
    namespace: 'stockPlan',
    functionName: 'createEquityCompensationExercise',
    buildParams: (fixture, featuredAppRight) => {
      const { object_type, ...exerciseData } = fixture.dbInput;
      return {
        issuerContractId: fixture.testContext.issuerContractId,
        issuerParty: fixture.testContext.issuerParty,
        featuredAppRightContractDetails: featuredAppRight,
        exerciseData
      };
    }
  }
};

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
      beforeEach(() => {
        // Set up the fixture data directly without file I/O
        const fixtureData = {
          timestamp: new Date().toISOString(),
          url: 'https://ledger-api.validator.devnet.transfer-agent.xyz/v2/commands/submit-and-wait-for-transaction-tree',
          request: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: fixture.expectedRequest
          },
          response: fixture.expectedResponse as any
        };
        
        setTransactionTreeFixtureData(fixtureData as any);
      });

      afterEach(() => {
        clearTransactionTreeFixture();
      });

      test('validates request and returns expected response', async () => {
        const mapping = FUNCTION_MAPPINGS[fixture.functionName];
        
        if (!mapping) {
          throw new Error(`No function mapping found for ${fixture.functionName}`);
        }

        const config: ClientConfig = {
          network: 'devnet'
        };

        const validatorApi = new ValidatorApiClient(config);
        const featuredAppRight = await getFeaturedAppRightContractDetails(validatorApi);
        const client = new OcpClient(config);

        // Build parameters from fixture
        const params = mapping.buildParams(fixture, featuredAppRight);

        // Call the function dynamically
        const namespace = client[mapping.namespace] as Record<string, Function>;
        const fn = namespace[mapping.functionName];
        
        if (!fn) {
          throw new Error(`Function ${mapping.functionName} not found on ${mapping.namespace}`);
        }

        const result = await fn(params);

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
