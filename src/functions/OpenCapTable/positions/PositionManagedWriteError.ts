import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { describePositionWriteRefusal, type PositionWriteRefusal } from './positionWriteGuard';

/**
 * Thrown before submission when an `UpdateCapTable` batch would write position-managed holdings, which the ledger's
 * root guard (OpenCapTable-v34 0.0.4 `validatePositionManagedWrites`) rejects. `refusals` names each offending item
 * with every reason; such holdings change only through the `PositionRegistry` choices.
 *
 * @example
 * ```typescript
 * try {
 *   await batch.execute();
 * } catch (error) {
 *   if (error instanceof PositionManagedWriteError) {
 *     for (const refusal of error.refusals) console.error(refusal.operation, refusal.entityType, refusal.id);
 *   }
 * }
 * ```
 */
export class PositionManagedWriteError extends OcpValidationError {
  /** The CapTable the batch targets. */
  readonly capTableContractId: string;

  /** Every refused item, in batch order (creates, then edits, then deletes), with every reason. */
  readonly refusals: readonly PositionWriteRefusal[];

  constructor(capTableContractId: string, refusals: readonly PositionWriteRefusal[]) {
    super(
      'batch',
      `${refusals.length} write(s) to position-managed holdings, which only the PositionRegistry choices may change: ${refusals
        .map(describePositionWriteRefusal)
        .join(' | ')}`,
      {
        code: OcpErrorCodes.POSITION_MANAGED_WRITE,
        classification: 'position_managed_write',
        context: {
          capTableContractId,
          refusals: refusals.map((refusal) => ({
            operation: refusal.operation,
            entityType: refusal.entityType,
            id: refusal.id,
            reasons: refusal.violations.map((violation) => violation.reason),
          })),
        },
      }
    );
    this.name = 'PositionManagedWriteError';
    this.capTableContractId = capTableContractId;
    this.refusals = refusals;
  }
}
