/**
 * The writer's off-ledger checks of one write (design, "What moves off the ledger"). Every check the ledger does not
 * make against the rest of a book depends on an honest TA and holds only if no other write changes what it read before
 * the write's outcome is known, so `RegisterWriter` runs them on each `CapTable_Apply` and `CapTable_Restate`
 * transaction under that transaction's locks (`register.writeScopes`): ceilings, orphaned references, the lifecycle of
 * warrants, convertibles and equity compensation, and the ledger date. A violation that still commits, from a write
 * outside the writer, is an accepted gap: readers and detectors flag it, and a restatement fixes it.
 */

import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../errors';
import type {
  BookWrite,
  RegisterCheckError,
  RegisterCheckOptions,
  RegisterCheckRule,
  RegisterCheckViolation,
} from '../../types/register';
import { requireDate } from '../dates';
import type { RegisterIndex } from '../registerIndex';
import { CheckedWrite } from './book';
import { checkCeilings } from './ceilings';
import { checkDates } from './dates';
import { checkInstruments } from './instruments';
import { checkReferences } from './references';

const RULE_CODES: Readonly<Record<RegisterCheckRule, OcpErrorCode>> = {
  class_ceiling: OcpErrorCodes.OUT_OF_RANGE,
  issuer_ceiling: OcpErrorCodes.OUT_OF_RANGE,
  plan_pool: OcpErrorCodes.OUT_OF_RANGE,
  orphaned_reference: OcpErrorCodes.CONTRACT_NOT_FOUND,
  class_has_stock: OcpErrorCodes.INVALID_FORMAT,
  stakeholder_holds: OcpErrorCodes.INVALID_FORMAT,
  after_retirement: OcpErrorCodes.INVALID_FORMAT,
  after_expiration: OcpErrorCodes.OUT_OF_RANGE,
  exceeds_remaining: OcpErrorCodes.OUT_OF_RANGE,
  future_dated: OcpErrorCodes.OUT_OF_RANGE,
};

function listName(write: BookWrite): string {
  switch (write.kind) {
    case 'apply':
    case 'restate':
      return 'operations';
    case 'cancelHolds':
      return 'holds';
    case 'placeHolds':
    case 'settle':
      return 'lots';
  }
}

/**
 * Every rule a write would break on its book, by the checks selected (all by default): what the write itself breaks,
 * not what the book broke before it.
 *
 * @param index - The book's key index, current at the write (with record payloads, for Apply and Restate)
 * @param write - The write, as `register.resolveInputs` takes it
 * @param options - The ledger date and which checks to run
 * @throws OcpValidationError when `today` is not a date, the index keeps no record data, or the write is one the
 * inputs preflight refuses (an ID already used, a missing reference, state, epoch or shard)
 */
export function writeViolations(
  index: RegisterIndex,
  write: BookWrite,
  options: RegisterCheckOptions
): RegisterCheckViolation[] {
  const today = requireDate(options.today, 'today');
  const { ceilings, references, instruments, dates } = options;
  if (ceilings === false && references === false && instruments === false && dates === false) return [];
  const checked = new CheckedWrite(index, write);
  return [
    ...(dates === false ? [] : checkDates(checked, today)),
    ...(references === false ? [] : checkReferences(checked)),
    ...(instruments === false ? [] : checkInstruments(checked)),
    ...(ceilings === false ? [] : checkCeilings(checked)),
  ];
}

/**
 * Run the off-ledger checks of a write and refuse it when it breaks any rule (see {@link writeViolations}).
 *
 * @throws OcpValidationError ({@link RegisterCheckError}) with the first violation's message, its rule as the
 * classification and every violation on `violations`
 */
export function checkWrite(index: RegisterIndex, write: BookWrite, options: RegisterCheckOptions): void {
  const violations = writeViolations(index, write, options);
  const [first] = violations;
  if (first === undefined) return;
  const more = violations.length > 1 ? ` (and ${violations.length - 1} more)` : '';
  const list = listName(write);
  const error: RegisterCheckError = new OcpValidationError(
    first.operation === null ? list : `${list}[${first.operation}]`,
    `${first.message}${more}`,
    {
      code: RULE_CODES[first.rule],
      classification: first.rule,
      context: {
        check: first.check,
        subject: first.subject,
        recordIds: first.recordIds,
        violations: violations.length,
      },
    }
  );
  Object.defineProperty(error, 'violations', { value: violations, enumerable: false, configurable: true });
  throw error;
}
