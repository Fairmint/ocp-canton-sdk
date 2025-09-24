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

  public getEventsByContractId = jest.fn(async (_req: { contractId: string }) => {
    return {} as any;
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
    (this.getEventsByContractId as jest.Mock).mockResolvedValue(resp);
  }

  __setAuthTokenProvider(fn: () => Promise<string> | string) {
    this.__getAuthToken = fn;
  }
}


