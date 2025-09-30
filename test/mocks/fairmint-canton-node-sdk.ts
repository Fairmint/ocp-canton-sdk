// Minimal mock of @fairmint/canton-node-sdk to avoid real network

import { ClientConfig } from "@fairmint/canton-node-sdk";
import { SubmitAndWaitForTransactionTreeResponse } from "@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations";

export class LedgerJsonApiClient {
  private config?: ClientConfig;
  public static __instances: LedgerJsonApiClient[] = [];
  public lastAuthToken?: string;
  private __getAuthToken?: () => Promise<string> | string;
  public submitAndWaitForTransactionTree = jest.fn(async (req: any): Promise<SubmitAndWaitForTransactionTreeResponse> => {
    const provider = this.__getAuthToken;
    if (provider) {
      const tok = await provider();
      this.lastAuthToken = typeof tok === 'string' ? tok : String(tok);
    }

    // Use fixture configured via setTransactionTreeFixture helper
    try {
      // Dynamically import to avoid circular dependencies
      const fixtureHelpers = require('../utils/fixtureHelpers');
      const fixtureResponse = fixtureHelpers.getFixtureResponse();
      if (fixtureResponse) {
        // Validate request matches fixture expectations
        fixtureHelpers.validateRequestMatchesFixture(req);
        return fixtureResponse;
      }
    } catch (error) {
      // fixtureHelpers might not exist or error during validation
      throw error;
    }

    // No fixture configured - this is an error
    throw new Error(
      'No transaction fixture configured. Use setTransactionTreeFixtureData() in your test setup. ' +
      'Request: ' + JSON.stringify(req, null, 2)
    );
  });

  public getEventsByContractId = jest.fn(async (req: { contractId: string }) => {
    // Allow tests to override via helper
    const override = (this as any).__eventsResponseOverride;
    if (override) return override;

    // Load from JSON fixture on disk: test/fixtures/ledgerJsonApi/v2/events/events-by-contract-id/<contractId>.json
    // Use absolute path to avoid cwd issues
    const path = require('path');
    const fs = require('fs');
    const fixtureBase = path.join(
      __dirname,
      '..',
      'fixtures',
      'ledgerJsonApi',
      'v2',
      'events',
      'events-by-contract-id'
    );

    const candidateNames: string[] = [
      `${req.contractId}.json`
    ];

    // Backward-compatible aliases used by test expectations
    if (req.contractId === 'vt-minimal') candidateNames.push('vesting-terms-minimal.json');
    if (req.contractId === 'slt-minimal') candidateNames.push('stock-legend-template-minimal.json');
    if (req.contractId === 'sp-minimal') candidateNames.push('stock-plan-minimal.json');

    let lastErr: Error | undefined;
    for (const name of candidateNames) {
      const fixturePath = path.join(fixtureBase, name);
      if (fs.existsSync(fixturePath)) {
        const fileContent = fs.readFileSync(fixturePath, 'utf-8');
        try {
          return JSON.parse(fileContent);
        } catch (e) {
          throw new Error(`Invalid JSON in fixture ${fixturePath}: ${(e as Error).message}`);
        }
      } else {
        lastErr = new Error(`Fixture not found at ${fixturePath}`);
      }
    }

    const primaryPath = path.join(fixtureBase, `${req.contractId}.json`);
    const error: any = new Error(`Fixture not found for contractId ${req.contractId}: ${primaryPath}`);
    error.code = 404;
    error.body = { code: 'CONTRACT_EVENTS_NOT_FOUND' };
    throw error;
  });

  constructor(config?: ClientConfig) {
    this.config = config;
    (LedgerJsonApiClient.__instances as any).push(this);
  }

  public getNetwork(): string {
    return this.config?.network || 'dev';
  }

  __setEventsResponse(resp: any) {
    (this as any).__eventsResponseOverride = resp;
    (this.getEventsByContractId as jest.Mock).mockResolvedValue(resp);
  }

  __setAuthTokenProvider(fn: () => Promise<string> | string) {
    this.__getAuthToken = fn;
  }
}


export class AuthenticationManager {
  constructor(private readonly config?: ClientConfig) {}
  async getAuthToken(): Promise<string | undefined> {
    const provider = this.getAuthToken;
    if (!provider) return undefined;
    const value = await provider();
    return typeof value === 'string' ? value : value ? String(value) : undefined;
  }
}

export class BaseClient {
  protected readonly authManager: AuthenticationManager;

  constructor(private readonly name: string, protected readonly config?: ClientConfig) {
    this.authManager = new AuthenticationManager(config);
  }

  public getPartyId(): string {
    return this.config?.network === 'devnet' ? 'party::issuer' : 'party::unknown';
  }

  protected async getAuthToken(): Promise<string | undefined> {
    return this.authManager.getAuthToken();
  }
}

export class ValidatorApiClient extends BaseClient {
  public static __instances: ValidatorApiClient[] = [];
  public lookupFeaturedAppRight = jest.fn(async () => {
    const path = require('path');
    const fs = require('fs');
    const fixturePath = path.join(
      __dirname,
      '..',
      'fixtures',
      'validatorApi',
      'featured-app-right.json'
    );
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });
  public getAmuletRules = jest.fn(async () => {
    const path = require('path');
    const fs = require('fs');
    const fixturePath = path.join(
      __dirname,
      '..',
      'fixtures',
      'validatorApi',
      'amulet-rules.json'
    );
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });

  constructor(config: ClientConfig) {
    super('VALIDATOR_API', config);
    (ValidatorApiClient.__instances as any).push(this);
  }

  public async getAuthToken(): Promise<string | undefined> {
    return super.getAuthToken();
  }
}

// Export the getFeaturedAppRightContractDetails function
export async function getFeaturedAppRightContractDetails(
  validatorApi: ValidatorApiClient,
): Promise<any> {
  const featuredAppRight = await validatorApi.lookupFeaturedAppRight();
  if (!featuredAppRight || !featuredAppRight.featured_app_right) {
    throw new Error(
      `No featured app right found for party ${validatorApi.getPartyId()}`
    );
  }
  // The featured-apps endpoint may not include the synchronizer/domain id.
  // Fallback to amulet rules which reliably expose the domain_id to use as synchronizerId.
  const amuletRules = await validatorApi.getAmuletRules();
  const synchronizerIdFromRules =
    (amuletRules as any)?.amulet_rules?.domain_id || '';
  return {
    contractId: featuredAppRight.featured_app_right.contract_id,
    createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
    synchronizerId:
      (featuredAppRight as any)?.featured_app_right?.domain_id ||
      synchronizerIdFromRules,
    templateId: featuredAppRight.featured_app_right.template_id,
  };
}

// Export the findCreatedEventByTemplateId function
export function findCreatedEventByTemplateId(
  response: any,
  templateId: string
): any {
  // Mock implementation - look for CreatedTreeEvent in the transactionTree
  if (response?.transactionTree?.eventsById) {
    for (const [key, event] of Object.entries(response.transactionTree.eventsById)) {
      const eventData = event as any;
      const eventTemplateId = eventData?.CreatedTreeEvent?.value?.templateId;
      
      // Handle different template ID formats
      if (eventTemplateId === templateId) {
        return eventData.CreatedTreeEvent;
      }
      
      // Handle the case where templateId is in pkg: format but event has full template ID
      if (templateId.startsWith('pkg:') && eventTemplateId) {
        const pkgName = templateId.replace('pkg:', '');
        // Check if the template name part matches (after the hash)
        const templateNamePart = eventTemplateId.split(':').slice(1).join(':');
        // Convert the last colon to dot for comparison
        const normalizedTemplateName = templateNamePart.replace(/:([^:]+)$/, '.$1');
        if (normalizedTemplateName === pkgName) {
          return eventData;
        }
      }
    }
  }
  // If not found in transactionTree, try the old structure for backward compatibility
  if (response?.transaction?.events) {
    for (const event of response.transaction.events) {
      if (event.kind?.JsCreated?.templateId === templateId) {
        return event;
      }
    }
  }
  return null;
}


