// Minimal mock of @fairmint/canton-node-sdk to avoid real network

import type { ClientConfig } from '@fairmint/canton-node-sdk';
import type {
  SubmitAndWaitForTransactionTreeParams,
  SubmitAndWaitForTransactionTreeResponse,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CreatedTreeEventWrapper } from '@fairmint/canton-node-sdk/build/src/utils/contracts/findCreatedEvent';
import fs from 'fs';
import path from 'path';
import { getCurrentEventsFixture, getCurrentFixture, validateRequestMatchesFixture } from '../utils/fixtureHelpers';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new Error(`Invalid mock fixture: ${description} must be an object`);
  }
  return record;
}

function requireString(value: unknown, description: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid mock fixture: ${description} must be a string`);
  }
  return value;
}

function isCreatedTreeEventWrapper(value: unknown): value is CreatedTreeEventWrapper {
  const event = asRecord(value);
  const createdTreeEvent = asRecord(event?.CreatedTreeEvent);
  const createdValue = asRecord(createdTreeEvent?.value);
  return typeof createdValue?.templateId === 'string' && typeof createdValue.contractId === 'string';
}

export class LedgerJsonApiClient {
  private readonly config: ClientConfig | undefined;
  public static __instances: LedgerJsonApiClient[] = [];
  public lastAuthToken?: string;
  private __getAuthToken?: () => Promise<string> | string;
  private __eventsResponseOverride?: unknown;
  private __activeContractsResponseOverride?: readonly unknown[];
  public submitAndWaitForTransactionTree = jest.fn(
    async (req: SubmitAndWaitForTransactionTreeParams): Promise<SubmitAndWaitForTransactionTreeResponse> => {
      const provider = this.__getAuthToken;
      if (provider) {
        const tok = await provider();
        this.lastAuthToken = typeof tok === 'string' ? tok : String(tok);
      }
      // Check if there's a fixture configured and validate request matches
      const fixture = getCurrentFixture();
      if (fixture) {
        validateRequestMatchesFixture(req);
        if (!fixture.response) {
          throw new Error('Transaction fixture is missing its response payload');
        }
        return fixture.response;
      }

      // No fixture configured - this is an error
      throw new Error(
        `No transaction fixture configured. Use setTransactionTreeFixtureData() in your test setup. ` +
          `Request: ${JSON.stringify(req, null, 2)}`
      );
    }
  );

  public getEventsByContractId = jest.fn((req: { contractId: string }) => {
    // Allow tests to override via helper
    const override = this.__eventsResponseOverride;
    if (override) return override;

    // Check if there's an events fixture configured
    const eventsFixture = getCurrentEventsFixture();
    if (eventsFixture) {
      return eventsFixture;
    }

    // No fixture configured - this is an error
    const error = Object.assign(
      new Error(
        `No events fixture configured. Use setEventsFixtureData() in your test setup. ` +
          `Contract ID: ${req.contractId}`
      ),
      { code: 404, body: { code: 'CONTRACT_EVENTS_NOT_FOUND' } }
    );
    throw error;
  });

  public getActiveContracts = jest.fn(async () => {
    // Allow tests to override via helper
    const override = this.__activeContractsResponseOverride;
    if (override !== undefined) return Promise.resolve(override);

    // No fixture configured - this is an error (consistent with other mock methods)
    throw new Error(
      `No active contracts fixture configured. Use __setActiveContractsResponse() in your test setup ` +
        `or mock getActiveContracts directly.`
    );
  });

  __setActiveContractsResponse(resp: readonly unknown[]): void {
    this.__activeContractsResponseOverride = resp;
    (this.getActiveContracts as jest.Mock).mockResolvedValue(resp);
  }

  constructor(config?: ClientConfig) {
    this.config = config;
    LedgerJsonApiClient.__instances.push(this);
  }

  public getNetwork(): string {
    return this.config?.network ?? 'dev';
  }

  __setEventsResponse(resp: unknown): void {
    this.__eventsResponseOverride = resp;
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

  public getNetwork(): string {
    return this.config?.network ?? 'localnet';
  }

  protected async getAuthToken(): Promise<string | undefined> {
    return this.authManager.getAuthToken();
  }
}

export class ValidatorApiClient extends BaseClient {
  public static __instances: ValidatorApiClient[] = [];
  public lookupFeaturedAppRight = jest.fn((_params: { partyId: string }) => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'validatorApi', 'featured-app-right.json');
    const data: unknown = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });
  public getAmuletRules = jest.fn(() => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'validatorApi', 'amulet-rules.json');
    const data: unknown = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    return data;
  });

  constructor(config: ClientConfig) {
    super('VALIDATOR_API', config);
    ValidatorApiClient.__instances.push(this);
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
  private partyId: string | undefined;

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
export async function getFeaturedAppRightContractDetails(validatorApi: ValidatorApiClient): Promise<DisclosedContract> {
  const partyId = validatorApi.getPartyId();
  const response = requireRecord(await validatorApi.lookupFeaturedAppRight({ partyId }), 'featured app right response');
  const featuredAppRight = asRecord(response.featured_app_right);
  if (!featuredAppRight) {
    throw new Error(`No featured app right found for party ${partyId}`);
  }
  // Match canton-node-sdk: the featured-app endpoint is not the synchronizer source.
  // Amulet rules reliably expose the domain_id used as synchronizerId.
  const amuletRulesResponse = requireRecord(await validatorApi.getAmuletRules(), 'amulet rules response');
  const amuletRules = requireRecord(amuletRulesResponse.amulet_rules, 'amulet rules');
  const synchronizerId = requireString(amuletRules.domain_id, 'amulet rules domain_id');
  return {
    contractId: requireString(featuredAppRight.contract_id, 'featured app right contract_id'),
    createdEventBlob: requireString(featuredAppRight.created_event_blob, 'featured app right created_event_blob'),
    synchronizerId,
    templateId: requireString(featuredAppRight.template_id, 'featured app right template_id'),
  };
}

// Export the findCreatedEventByTemplateId function
export function findCreatedEventByTemplateId(
  response: SubmitAndWaitForTransactionTreeResponse,
  templateId: string
): CreatedTreeEventWrapper | undefined {
  const expectedSuffix = templateId.includes(':') ? templateId.substring(templateId.indexOf(':') + 1) : templateId;
  const transactionTree = asRecord(response.transactionTree);
  const nestedTransaction = asRecord(transactionTree?.transaction);
  const eventsById = asRecord(transactionTree?.eventsById) ?? asRecord(nestedTransaction?.eventsById);
  if (!eventsById) {
    return undefined;
  }

  for (const event of Object.values(eventsById)) {
    if (isCreatedTreeEventWrapper(event)) {
      const actualTemplateId = event.CreatedTreeEvent.value.templateId;
      const actualSuffix = actualTemplateId.includes(':')
        ? actualTemplateId.substring(actualTemplateId.indexOf(':') + 1)
        : actualTemplateId;
      if (actualSuffix === expectedSuffix) {
        return event;
      }
    }
  }
  return undefined;
}
