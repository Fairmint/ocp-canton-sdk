import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { OcpFactoryCoordinates } from '../../../clientOptions';
import type { CommandObservabilityOptions } from '../../../observabilityTypes';
import type { DisclosedContract } from '../../../types/common';

/** Parameters for authorizing an issuer through the OCP Factory. */
export interface AuthorizeIssuerParams extends CommandObservabilityOptions {
  issuer: string;
  /** Atomic factory override for custom deployments. */
  factory?: OcpFactoryCoordinates;
}

/** Result of authorizing an issuer. */
export interface AuthorizeIssuerResult extends DisclosedContract {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/** Parameters for withdrawing an issuer authorization. */
export interface WithdrawAuthorizationParams extends CommandObservabilityOptions {
  issuerAuthorizationContractId: string;
  systemOperatorParty: string;
}

/** Result of withdrawing an issuer authorization. */
export interface WithdrawAuthorizationResult {
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}
