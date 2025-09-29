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


