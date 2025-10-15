import type { PaymentContext } from '../utils/paymentContext';

/** Input for locking funds in a subscription Used when creating or adding funds to a subscription */
export interface LockFundsInput {
  amuletInputs: string[];
  amountToLock: string; // Decimal as string
  paymentContext: PaymentContext;
}
