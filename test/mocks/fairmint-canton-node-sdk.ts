// Minimal mock of @fairmint/canton-node-sdk to avoid real network

import type { ClientConfig } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export class LedgerJsonApiClient {
  private readonly config?: ClientConfig;
  public static __instances: LedgerJsonApiClient[] = [];
  public lastAuthToken?: string;
  private __getAuthToken?: () => Promise<string> | string;
  public submitAndWaitForTransaction = jest.fn(async (req: any): Promise<SubmitAndWaitForTransactionResponse> => {
    const provider = this.__getAuthToken;
    if (provider) {
      const tok = await provider();
      this.lastAuthToken = typeof tok === 'string' ? tok : String(tok);
    }
    // Check if there's a fixture configured and validate request matches
    const { getCurrentFixture, validateRequestMatchesFixture } = require('../utils/fixtureHelpers');
    const fixture = getCurrentFixture();
    if (fixture) {
      validateRequestMatchesFixture(req);
      return fixture.response;
    }

    // No fixture configured - this is an error
    throw new Error(
      `No transaction fixture configured. Use setTransactionFixtureData() in your test setup. ` +
        `Request: ${JSON.stringify(req, null, 2)}`
    );
  });

  public getEventsByContractId = jest.fn((req: { contractId: string }) => {
    // Allow tests to override via helper
    const override = (this as any).__eventsResponseOverride;
    if (override) return override;

    // Check if there's an events fixture configured
    const { getCurrentEventsFixture } = require('../utils/fixtureHelpers');
    const eventsFixture = getCurrentEventsFixture();
    if (eventsFixture) {
      return eventsFixture;
    }

    // No fixture configured - this is an error
    const error: any = new Error(
      `No events fixture configured. Use setEventsFixtureData() in your test setup. ` + `Contract ID: ${req.contractId}`
    );
    error.code = 404;
    error.body = { code: 'CONTRACT_EVENTS_NOT_FOUND' };
    throw error;
  });

  public getActiveContracts = jest.fn(async () => {
    // Allow tests to override via helper
    const override = (this as any).__activeContractsResponseOverride;
    if (override !== undefined) return Promise.resolve(override);

    // No fixture configured - this is an error (consistent with other mock methods)
    throw new Error(
      `No active contracts fixture configured. Use __setActiveContractsResponse() in your test setup ` +
        `or mock getActiveContracts directly.`
    );
  });

  __setActiveContractsResponse(resp: unknown[]) {
    (this as any).__activeContractsResponseOverride = resp;
    (this.getActiveContracts as jest.Mock).mockResolvedValue(resp);
  }

  constructor(config?: ClientConfig) {
    this.config = config;
    (LedgerJsonApiClient.__instances as any).push(this);
  }

  public getNetwork(): string {
    return this.config?.network ?? 'dev';
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
  constructor(_config?: ClientConfig) {}
  async getAuthToken(): Promise<string | undefined> {
    // Mock implementation - returns undefined
    return Promise.resolve(undefined);
  }
}

export class BaseClient {
  protected readonly authManager: AuthenticationManager;

  constructor(
    _name: string,
    protected readonly config?: ClientConfig
  ) {
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
  public lookupFeaturedAppRight = jest.fn(() => {
    const path = require('path');
    const fs = require('fs');
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'validatorApi', 'featured-app-right.json');
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });
  public getAmuletRules = jest.fn(() => {
    const path = require('path');
    const fs = require('fs');
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'validatorApi', 'amulet-rules.json');
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });

  constructor(config: ClientConfig) {
    super('VALIDATOR_API', config);
    (ValidatorApiClient.__instances as any).push(this);
  }

  public override async getAuthToken(): Promise<string | undefined> {
    return super.getAuthToken();
  }
}

export class Canton {
  public static __instances: Canton[] = [];
  public readonly ledger: LedgerJsonApiClient;
  public readonly validator: ValidatorApiClient;
  public readonly scan: unknown;
  private partyId?: string;

  constructor(public readonly config: ClientConfig) {
    this.ledger = new LedgerJsonApiClient(config);
    this.validator = new ValidatorApiClient(config);
    this.scan = {};
    this.partyId = config.partyId;
    Canton.__instances.push(this);
  }

  public getNetwork(): string {
    return this.config.network;
  }

  public getProvider(): string | undefined {
    return this.config.provider;
  }

  public getPartyId(): string {
    return this.partyId ?? this.validator.getPartyId();
  }

  public setPartyId(partyId: string): void {
    this.partyId = partyId;
  }
}

// Export the getFeaturedAppRightContractDetails function
export async function getFeaturedAppRightContractDetails(validatorApi: ValidatorApiClient): Promise<any> {
  const featuredAppRight = await validatorApi.lookupFeaturedAppRight();
  if (!featuredAppRight?.featured_app_right) {
    throw new Error(`No featured app right found for party ${validatorApi.getPartyId()}`);
  }
  // The featured-apps endpoint may not include the synchronizer/domain id.
  // Fallback to amulet rules which reliably expose the domain_id to use as synchronizerId.
  const amuletRules = await validatorApi.getAmuletRules();
  const synchronizerIdFromRules = amuletRules?.amulet_rules?.domain_id ?? '';
  return {
    contractId: featuredAppRight.featured_app_right.contract_id,
    createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
    synchronizerId: featuredAppRight?.featured_app_right?.domain_id ?? synchronizerIdFromRules,
    templateId: featuredAppRight.featured_app_right.template_id,
  };
}

function templateIdSuffix(templateId: string): string {
  return templateId.includes(':') ? templateId.substring(templateId.indexOf(':') + 1) : templateId;
}

/** Matches the real SDK helper: returns the flat CreatedEvent payload, or undefined. */
export function findCreatedEventByTemplateId(response: any, templateId: string): any {
  const events = response?.transaction?.events;
  if (!Array.isArray(events)) return undefined;

  const expectedSuffix = templateIdSuffix(templateId);

  for (const event of events) {
    const created = event?.CreatedEvent;
    if (!created?.templateId) continue;
    if (templateIdSuffix(created.templateId) === expectedSuffix) {
      return created;
    }
    if (created.templateId === templateId) {
      return created;
    }
  }
  return undefined;
}

export function extractEventsFromTransaction(transaction: unknown): {
  created: Array<{
    contractId: string;
    templateId: string;
    packageName?: string;
    createArgument?: unknown;
  }>;
  archived: unknown[];
  exercised: unknown[];
} {
  const asResponse = transaction as { transaction?: { events?: unknown[] }; events?: unknown[] } | null;
  const events = asResponse?.transaction?.events ?? asResponse?.events ?? [];
  const created: Array<{
    contractId: string;
    templateId: string;
    packageName?: string;
    createArgument?: unknown;
  }> = [];
  const archived: unknown[] = [];
  const exercised: unknown[] = [];

  if (!Array.isArray(events)) {
    return { created, archived, exercised };
  }

  for (const event of events) {
    const entry = event as Record<string, unknown>;
    if (entry.CreatedEvent && typeof entry.CreatedEvent === 'object') {
      const c = entry.CreatedEvent as Record<string, unknown>;
      const contractId = typeof c.contractId === 'string' ? c.contractId : '';
      const templateId = typeof c.templateId === 'string' ? c.templateId : '';
      const packageName = typeof c.packageName === 'string' ? c.packageName : undefined;
      created.push({
        contractId,
        templateId,
        ...(packageName !== undefined ? { packageName } : {}),
        createArgument: c.createArgument,
      });
    } else if (entry.ArchivedEvent) {
      archived.push(entry.ArchivedEvent);
    } else if (entry.ExercisedEvent) {
      exercised.push(entry.ExercisedEvent);
    }
  }

  return { created, archived, exercised };
}

export class TransactionBatch {
  constructor(
    private readonly client: LedgerJsonApiClient,
    private readonly actAs: string[],
    private readonly readAs?: string[]
  ) {}

  addBuiltCommand(_built: unknown): this {
    return this;
  }

  addCommand(_command: unknown): this {
    return this;
  }

  async submitAndWaitForTransaction(): Promise<unknown> {
    return this.client.submitAndWaitForTransaction({
      commands: [],
      actAs: this.actAs,
      readAs: this.readAs,
    });
  }
}
