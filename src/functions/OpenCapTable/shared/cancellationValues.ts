import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { damlTimeToDateString, dateStringToDAMLTime, isRecord } from '../../../utils/typeConversions';
import {
  assertCanonicalJsonGraph,
  assertExactObjectFields,
  requireCurrencyCode,
  requireDenseArray,
  requirePositiveDecimal,
} from './ocfValues';

export type QuantityCancellationEntityType =
  | 'stockCancellation'
  | 'equityCompensationCancellation'
  | 'warrantCancellation';

export type QuantityCancellationObjectType =
  | 'TX_STOCK_CANCELLATION'
  | 'TX_EQUITY_COMPENSATION_CANCELLATION'
  | 'TX_WARRANT_CANCELLATION';

export interface DamlQuantityCancellationValues {
  readonly id: string;
  readonly date: string;
  readonly security_id: string;
  readonly quantity: string;
  readonly reason_text: string;
  readonly comments: string[];
  readonly balance_security_id: string | null;
}

export interface NativeQuantityCancellationValues {
  readonly id: string;
  readonly date: string;
  readonly security_id: string;
  readonly quantity: string;
  readonly reason_text: string;
  readonly comments?: string[];
  readonly balance_security_id?: string;
}

export interface DamlConvertibleCancellationValues {
  readonly id: string;
  readonly date: string;
  readonly security_id: string;
  readonly amount: Monetary;
  readonly reason_text: string;
  readonly comments: string[];
  readonly balance_security_id: string | null;
}

export interface NativeConvertibleCancellationValues {
  readonly id: string;
  readonly date: string;
  readonly security_id: string;
  readonly amount: Monetary;
  readonly reason_text: string;
  readonly comments?: string[];
  readonly balance_security_id?: string;
}

const OCF_QUANTITY_CANCELLATION_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'quantity',
  'reason_text',
  'comments',
  'balance_security_id',
] as const;

const DAML_QUANTITY_CANCELLATION_FIELDS = [
  'id',
  'date',
  'security_id',
  'quantity',
  'reason_text',
  'comments',
  'balance_security_id',
] as const;

const OCF_CONVERTIBLE_CANCELLATION_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'amount',
  'reason_text',
  'comments',
  'balance_security_id',
] as const;

const DAML_CONVERTIBLE_CANCELLATION_FIELDS = [
  'id',
  'date',
  'security_id',
  'amount',
  'reason_text',
  'comments',
  'balance_security_id',
] as const;

const MONETARY_FIELDS = ['amount', 'currency'] as const;

function requiredMissing(fieldPath: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(fieldPath: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function invalidFormat(fieldPath: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(fieldPath, `${fieldPath} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireExactRecord(
  value: unknown,
  allowedFields: readonly string[],
  fieldPath: string,
  expectedType: string
): Record<string, unknown> {
  assertCanonicalJsonGraph(value, fieldPath, { rejectUndefined: true });
  if (!isRecord(value)) throw invalidType(fieldPath, expectedType, value);
  assertExactObjectFields(value, allowedFields, fieldPath);
  return value;
}

function requireNonEmptyString(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(fieldPath, 'non-empty string', value);
  if (value.length === 0) throw invalidFormat(fieldPath, 'non-empty string', value);
  return value;
}

function requireDiscriminator(value: unknown, fieldPath: string, expectedValue: string): void {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, expectedValue, value);
  if (typeof value !== 'string') throw invalidType(fieldPath, expectedValue, value);
  if (value !== expectedValue) throw invalidFormat(fieldPath, expectedValue, value);
}

function requireOcfDateToDaml(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'OCF date string', value);
  return dateStringToDAMLTime(value, fieldPath);
}

function requireDamlTimeToOcfDate(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) throw requiredMissing(fieldPath, 'DAML Time string', value);
  return damlTimeToDateString(value, fieldPath);
}

function requireComments(value: unknown, fieldPath: string, optional: boolean): string[] {
  if (value === undefined && optional) return [];
  if (value === undefined) throw requiredMissing(fieldPath, 'array of non-empty strings', value);
  if (value === null) throw invalidType(fieldPath, 'array of non-empty strings', value);

  return requireDenseArray(value, fieldPath).map((comment, index) =>
    requireNonEmptyString(comment, `${fieldPath}.${index}`)
  );
}

function requireOptionalBalanceSecurityId(
  value: unknown,
  fieldPath: string,
  options: { readonly nullIsAbsent: boolean }
): string | undefined {
  if (value === undefined) return undefined;
  if (value === null && options.nullIsAbsent) return undefined;
  if (typeof value !== 'string') {
    throw invalidType(
      fieldPath,
      options.nullIsAbsent ? 'null or non-empty string' : 'non-empty string or omitted',
      value
    );
  }
  if (value.length === 0) {
    throw invalidFormat(
      fieldPath,
      options.nullIsAbsent ? 'null or non-empty string' : 'non-empty string or omitted',
      value
    );
  }
  return value;
}

function requirePositiveMonetary(value: unknown, fieldPath: string): Monetary {
  const monetary = requireExactRecord(value, MONETARY_FIELDS, fieldPath, 'Monetary object');
  return {
    amount: requirePositiveDecimal(monetary.amount, `${fieldPath}.amount`),
    currency: requireCurrencyCode(monetary.currency, `${fieldPath}.currency`),
  };
}

/** Validate and encode one exact quantity-based OCF cancellation for DAML. */
export function quantityCancellationValuesToDaml(
  input: unknown,
  entityType: QuantityCancellationEntityType,
  objectType: QuantityCancellationObjectType
): DamlQuantityCancellationValues {
  const data = requireExactRecord(
    input,
    OCF_QUANTITY_CANCELLATION_FIELDS,
    entityType,
    `${objectType} cancellation object`
  );
  requireDiscriminator(data.object_type, `${entityType}.object_type`, objectType);
  const balanceSecurityId = requireOptionalBalanceSecurityId(
    data.balance_security_id,
    `${entityType}.balance_security_id`,
    { nullIsAbsent: false }
  );

  return {
    id: requireNonEmptyString(data.id, `${entityType}.id`),
    date: requireOcfDateToDaml(data.date, `${entityType}.date`),
    security_id: requireNonEmptyString(data.security_id, `${entityType}.security_id`),
    quantity: requirePositiveDecimal(data.quantity, `${entityType}.quantity`),
    reason_text: requireNonEmptyString(data.reason_text, `${entityType}.reason_text`),
    comments: requireComments(data.comments, `${entityType}.comments`, true),
    balance_security_id: balanceSecurityId ?? null,
  };
}

/** Validate and decode one exact generated quantity-based DAML cancellation. */
export function quantityCancellationValuesFromDaml(
  input: unknown,
  entityType: QuantityCancellationEntityType
): NativeQuantityCancellationValues {
  const data = requireExactRecord(
    input,
    DAML_QUANTITY_CANCELLATION_FIELDS,
    entityType,
    'generated quantity cancellation data'
  );
  const comments = requireComments(data.comments, `${entityType}.comments`, false);
  const balanceSecurityId = requireOptionalBalanceSecurityId(
    data.balance_security_id,
    `${entityType}.balance_security_id`,
    { nullIsAbsent: true }
  );

  return {
    id: requireNonEmptyString(data.id, `${entityType}.id`),
    date: requireDamlTimeToOcfDate(data.date, `${entityType}.date`),
    security_id: requireNonEmptyString(data.security_id, `${entityType}.security_id`),
    quantity: requirePositiveDecimal(data.quantity, `${entityType}.quantity`),
    reason_text: requireNonEmptyString(data.reason_text, `${entityType}.reason_text`),
    ...(comments.length > 0 ? { comments } : {}),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
  };
}

/** Validate and encode one exact OCF convertible cancellation for DAML. */
export function convertibleCancellationValuesToDaml(input: unknown): DamlConvertibleCancellationValues {
  const entityType = 'convertibleCancellation';
  const data = requireExactRecord(
    input,
    OCF_CONVERTIBLE_CANCELLATION_FIELDS,
    entityType,
    'TX_CONVERTIBLE_CANCELLATION cancellation object'
  );
  requireDiscriminator(data.object_type, `${entityType}.object_type`, 'TX_CONVERTIBLE_CANCELLATION');
  const balanceSecurityId = requireOptionalBalanceSecurityId(
    data.balance_security_id,
    `${entityType}.balance_security_id`,
    { nullIsAbsent: false }
  );

  return {
    id: requireNonEmptyString(data.id, `${entityType}.id`),
    date: requireOcfDateToDaml(data.date, `${entityType}.date`),
    security_id: requireNonEmptyString(data.security_id, `${entityType}.security_id`),
    amount: requirePositiveMonetary(data.amount, `${entityType}.amount`),
    reason_text: requireNonEmptyString(data.reason_text, `${entityType}.reason_text`),
    comments: requireComments(data.comments, `${entityType}.comments`, true),
    balance_security_id: balanceSecurityId ?? null,
  };
}

/** Validate and decode one exact generated DAML convertible cancellation. */
export function convertibleCancellationValuesFromDaml(input: unknown): NativeConvertibleCancellationValues {
  const entityType = 'convertibleCancellation';
  const data = requireExactRecord(
    input,
    DAML_CONVERTIBLE_CANCELLATION_FIELDS,
    entityType,
    'generated convertible cancellation data'
  );
  const comments = requireComments(data.comments, `${entityType}.comments`, false);
  const balanceSecurityId = requireOptionalBalanceSecurityId(
    data.balance_security_id,
    `${entityType}.balance_security_id`,
    { nullIsAbsent: true }
  );

  return {
    id: requireNonEmptyString(data.id, `${entityType}.id`),
    date: requireDamlTimeToOcfDate(data.date, `${entityType}.date`),
    security_id: requireNonEmptyString(data.security_id, `${entityType}.security_id`),
    amount: requirePositiveMonetary(data.amount, `${entityType}.amount`),
    reason_text: requireNonEmptyString(data.reason_text, `${entityType}.reason_text`),
    ...(comments.length > 0 ? { comments } : {}),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
  };
}
