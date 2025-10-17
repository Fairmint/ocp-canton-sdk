import type { PaymentContext } from '../utils/paymentContext';

/** Input for locking funds in a paymentStream Used when creating or adding funds to a paymentStream */
export interface LockFundsInput {
  amuletInputs: string[];
  amountToLock: string; // Decimal as string
  paymentContext: PaymentContext;
}
