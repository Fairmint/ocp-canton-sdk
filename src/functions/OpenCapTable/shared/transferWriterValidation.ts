import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary, NonEmptyArray } from '../../../types/native';
import { toNonEmptyStringArray } from '../../../utils/typeConversions';
import { requireOcfMonetary, requirePositiveOcfDecimal } from './ocfValues';
import { optionalWriterArray, requireWriterString } from './ocfWriterValidation';

function requireNonEmptyTransferText(value: unknown, fieldPath: string): string {
  const text = requireWriterString(value, fieldPath);
  if (text.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a non-empty string`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: text,
    });
  }
  return text;
}

/** Require a non-empty transfer Text field, matching the pinned v35 DAML ensure clauses. */
export function requiredTransferTextToDaml(value: unknown, fieldPath: string): string {
  return requireNonEmptyTransferText(value, fieldPath);
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
  return requireNonEmptyTransferText(value, fieldPath);
}

/** Encode transfer comments while preserving whitespace and rejecting empty elements. */
export function transferCommentsToDaml(value: unknown, fieldPath: string): string[] {
  return optionalWriterArray(value, fieldPath).map((comment, index) =>
    requireNonEmptyTransferText(comment, `${fieldPath}.${index}`)
  );
}

/** Encode the strictly positive Monetary amount required by ConvertibleTransfer v35. */
export function positiveTransferMonetaryToDaml(value: unknown, fieldPath: string): Monetary {
  const monetary = requireOcfMonetary(value, fieldPath);
  return {
    amount: requirePositiveOcfDecimal(monetary.amount, `${fieldPath}.amount`),
    currency: monetary.currency,
  };
}

/** Encode the required unique result identifiers shared by every transfer writer. */
export function resultingSecurityIdsToDaml(value: unknown, fieldPath: string): NonEmptyArray<string> {
  const identifiers = toNonEmptyStringArray(value, fieldPath, { uniqueItems: true });
  const validated = identifiers.map((identifier, index) =>
    requireNonEmptyTransferText(identifier, `${fieldPath}.${index}`)
  );
  const [first, ...remaining] = validated;
  if (first === undefined) throw new Error('Non-empty transfer identifier validation returned an empty array');
  return [first, ...remaining];
}
