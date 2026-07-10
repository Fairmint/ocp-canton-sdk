/** Compile-time contracts for the public issuer-authorization response boundary. */

import type {
  AuthorizeIssuerResult,
  SubmitAndWaitForTransactionTreeResponse,
  WithdrawAuthorizationResult,
} from '../../src';

type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const authorizeResponseUsesPublicLedgerType: Assert<
  IsExactly<AuthorizeIssuerResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;
const withdrawResponseUsesPublicLedgerType: Assert<
  IsExactly<WithdrawAuthorizationResult['response'], SubmitAndWaitForTransactionTreeResponse>
> = true;

void authorizeResponseUsesPublicLedgerType;
void withdrawResponseUsesPublicLedgerType;
