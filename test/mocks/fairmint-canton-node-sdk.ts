// Minimal mock of @fairmint/canton-node-sdk to avoid real network

export type SubmitAndWaitForTransactionTreeResponse = {
  transactionTree: {
    updateId: string;
    synchronizerId?: string;
    eventsById: Record<string, any>;
  };
};

export type Command = any;
export type DisclosedContract = any;

export interface ClientConfig {
  url?: string;
  network?: string;
  getAuthToken?: () => Promise<string> | string;
}

export class LedgerJsonApiClient {
  private config?: ClientConfig;
  public static __instances: LedgerJsonApiClient[] = [];
  public lastAuthToken?: string;
  private __getAuthToken?: () => Promise<string> | string;
  public submitAndWaitForTransactionTree = jest.fn(async (req: any): Promise<SubmitAndWaitForTransactionTreeResponse> => {
    const provider = this.__getAuthToken || this.config?.getAuthToken;
    if (provider) {
      const tok = await provider();
      this.lastAuthToken = typeof tok === 'string' ? tok : String(tok);
    }
    return (
      (this as any).__submitResponse || {
        transactionTree: {
          updateId: 'mock-update-id',
          synchronizerId: 'mock-sync',
          eventsById: {}
        }
      }
    ) as SubmitAndWaitForTransactionTreeResponse;
  });

  public getEventsByContractId = jest.fn(async (req: { contractId: string }) => {
    // Allow tests to override via helper
    const override = (this as any).__eventsResponseOverride;
    if (override) return override;

    // Load from JSON fixture on disk: test/mocks/ledgerJsonApi/v2/events/events-by-contract-id/<contractId>.json
    // Use absolute path to avoid cwd issues
    const path = require('path');
    const fs = require('fs');
    const fixturePath = path.join(
      __dirname,
      '..',
      'mocks',
      'ledgerJsonApi',
      'v2',
      'events',
      'events-by-contract-id',
      `${req.contractId}.json`
    );

    if (!fs.existsSync(fixturePath)) {
      const error: any = new Error(`Fixture not found for contractId ${req.contractId}: ${fixturePath}`);
      error.code = 404;
      error.body = { code: 'CONTRACT_EVENTS_NOT_FOUND' };
      throw error;
    }

    const fileContent = fs.readFileSync(fixturePath, 'utf-8');
    try {
      return JSON.parse(fileContent);
    } catch (e) {
      throw new Error(`Invalid JSON in fixture ${fixturePath}: ${(e as Error).message}`);
    }
  });

  constructor(config?: ClientConfig) {
    this.config = config;
    (LedgerJsonApiClient.__instances as any).push(this);
  }

  public getNetwork(): string {
    return this.config?.network || 'dev';
  }

  // Helper for tests to set canned responses
  __setSubmitResponse(resp: SubmitAndWaitForTransactionTreeResponse) {
    (this as any).__submitResponse = resp;
  }

  __setEventsResponse(resp: any) {
    (this as any).__eventsResponseOverride = resp;
    (this.getEventsByContractId as jest.Mock).mockResolvedValue(resp);
  }

  __setAuthTokenProvider(fn: () => Promise<string> | string) {
    this.__getAuthToken = fn;
  }
}


