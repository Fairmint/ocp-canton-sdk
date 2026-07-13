import type { CommandObservabilityOptions } from '../../../observability';
import type { DisclosedContract, SubmitAndWaitForTransactionTreeResponse } from '../../../types/common';

/** Parameters for authorizing an issuer through the OCP Factory. */
export interface AuthorizeIssuerParams extends CommandObservabilityOptions {
  issuer: string;
  /** Factory contract override. Must be paired with `factoryTemplateId`. */
  factoryContractId?: string;
  /** Factory template override. Must be paired with `factoryContractId`. */
  factoryTemplateId?: string;
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
