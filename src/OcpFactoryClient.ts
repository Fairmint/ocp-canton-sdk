import { ClientConfig, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult } from './functions/authorizeIssuer';
import { createIssuer, CreateIssuerParams, CreateIssuerResult, IssuerAuthorizationContractDetails } from './functions/createIssuer';

export { AuthorizeIssuerParams, AuthorizeIssuerResult } from './functions/authorizeIssuer';
export { CreateIssuerParams, CreateIssuerResult, IssuerAuthorizationContractDetails } from './functions/createIssuer';

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

  /**
   * Create an issuer by exercising the CreateIssuer choice on an IssuerAuthorization contract
   * @param params - Parameters for creating an issuer
   * @returns Promise resolving to the result of the issuer creation
   */
  async createIssuer(params: CreateIssuerParams): Promise<CreateIssuerResult> {
    return createIssuer(this.client, params);
  }
} 