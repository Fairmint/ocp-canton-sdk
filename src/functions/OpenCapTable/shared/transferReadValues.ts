import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { DeepReadonly } from '../../../types/common';
import type {
  OcfConvertibleTransfer,
  OcfEquityCompensationTransfer,
  OcfStockTransfer,
  OcfWarrantTransfer,
} from '../../../types/native';
import { toNonEmptyStringArray } from '../../../utils/typeConversions';
import { requireStringArray } from './ocfValues';

type OcfTransfer = OcfConvertibleTransfer | OcfEquityCompensationTransfer | OcfStockTransfer | OcfWarrantTransfer;

function requireNonEmptyText(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a string`, {
      code: value === null || value === undefined ? OcpErrorCodes.REQUIRED_FIELD_MISSING : OcpErrorCodes.INVALID_TYPE,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be non-empty`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** Validate one required transfer Text after generated DAML decoding. */
export function requireGeneratedTransferText(value: unknown, fieldPath: string): string {
  return requireNonEmptyText(value, fieldPath);
}

/** Decode a DAML Optional Text while enforcing v35's non-empty Some value. */
export function generatedOptionalTransferText(value: unknown, fieldPath: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireNonEmptyText(value, fieldPath);
}

/** Decode transfer result IDs, enforcing non-empty, unique OCF identifiers. */
export function requireGeneratedTransferResultIds(value: unknown, fieldPath: string): [string, ...string[]] {
  const identifiers = toNonEmptyStringArray(value, fieldPath, { uniqueItems: true });
  const validated = identifiers.map((identifier, index) => requireNonEmptyText(identifier, `${fieldPath}.${index}`));
  const [first, ...remaining] = validated;
  if (first === undefined)
    throw new Error('Non-empty generated transfer identifier validation returned an empty array');
  return [first, ...remaining];
}

/** Decode the v35 comments list, where the list may be empty but no element may be. */
export function requireGeneratedTransferComments(value: unknown, fieldPath: string): string[] {
  return requireStringArray(value, fieldPath).map((comment, index) =>
    requireNonEmptyText(comment, `${fieldPath}.${index}`)
  );
}

/** Freeze a fresh transfer snapshot, including every nested collection and Monetary record. */
export function freezeTransferEvent<T extends OcfTransfer>(event: T): DeepReadonly<T> {
  const frozenResultIds = Object.freeze([...event.resulting_security_ids]);
  const frozenComments = event.comments === undefined ? undefined : Object.freeze([...event.comments]);
  const frozenAmount = 'amount' in event ? Object.freeze({ ...event.amount }) : undefined;

  return Object.freeze({
    ...event,
    resulting_security_ids: frozenResultIds,
    ...(frozenComments === undefined ? {} : { comments: frozenComments }),
    ...(frozenAmount === undefined ? {} : { amount: frozenAmount }),
  }) as DeepReadonly<T>;
}
