import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary, NonEmptyArray } from '../../../types/native';
import { toNonEmptyStringArray } from '../../../utils/typeConversions';
import { requireMonetary, requirePositiveDecimal } from './ocfValues';
import { optionalWriterArray, requireWriterString } from './ocfWriterValidation';

/** Require a non-empty transfer Text field, matching the pinned v35 DAML ensure clauses. */
export function requiredTransferTextToDaml(value: unknown, fieldPath: string): string {
  return requireWriterString(value, fieldPath);
}

/** Encode a v35 Optional Text: omission becomes None and a present value must be non-empty. */
export function optionalTransferTextToDaml(value: unknown, fieldPath: string): string | null {
  if (value === undefined) return null;
  if (value === null) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be omitted rather than set to null`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string or omitted property',
      receivedValue: value,
    });
  }
  return requireWriterString(value, fieldPath);
}

/** Encode transfer comments while preserving whitespace and rejecting empty elements. */
export function transferCommentsToDaml(value: unknown, fieldPath: string): string[] {
  return optionalWriterArray(value, fieldPath).map((comment, index) =>
    requireWriterString(comment, `${fieldPath}.${index}`)
  );
}

/** Encode the strictly positive Monetary amount required by ConvertibleTransfer v35. */
export function positiveTransferMonetaryToDaml(value: unknown, fieldPath: string): Monetary {
  const monetary = requireMonetary(value, fieldPath);
  return {
    amount: requirePositiveDecimal(monetary.amount, `${fieldPath}.amount`),
    currency: monetary.currency,
  };
}

/** Encode the required unique result identifiers shared by every transfer writer. */
export function resultingSecurityIdsToDaml(value: unknown, fieldPath: string): NonEmptyArray<string> {
  const identifiers = toNonEmptyStringArray(value, fieldPath, { uniqueItems: true });
  const validated = identifiers.map((identifier, index) => requireWriterString(identifier, `${fieldPath}.${index}`));
  const [first, ...remaining] = validated;
  if (first === undefined) throw new Error('Non-empty transfer identifier validation returned an empty array');
  return [first, ...remaining];
}
