import { ClientConfig, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult } from './functions/authorizeIssuer';

export { AuthorizeIssuerParams, AuthorizeIssuerResult } from './functions/authorizeIssuer';

export class OcpFactoryClient {
  private client: LedgerJsonApiClient;

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);
  }

  /**
   * Authorize an issuer using the OCP Factory contract
   * @param params - Parameters for authorizing an issuer
   * @returns Promise resolving to the result of the authorization
   */
  async authorizeIssuer(params: AuthorizeIssuerParams): Promise<AuthorizeIssuerResult> {
    return authorizeIssuer(this.client, params);
  }
} 