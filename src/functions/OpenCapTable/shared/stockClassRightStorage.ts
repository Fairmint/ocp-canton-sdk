import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { isRecord } from '../../../utils/typeConversions';

const INAPPLICABLE_STOCK_CLASS_RIGHT_FIELDS = [
  'ceiling_price_per_share',
  'custom_description',
  'discount_rate',
  'expires_at',
  'floor_price_per_share',
  'percent_of_capitalization',
  'reference_share_price',
  'reference_valuation_price_per_share',
  'valuation_cap',
] as const;

const TRIGGER_FIELDS = [
  'trigger_id',
  'type_',
  'conversion_right',
  'nickname',
  'start_date',
  'end_date',
  'trigger_condition',
  'trigger_date',
  'trigger_description',
] as const;

const COMPARABLE_TRIGGER_FIELDS = TRIGGER_FIELDS.filter((field) => field !== 'conversion_right');

function schemaMismatch(fieldPath: string, expectedType: string, receivedValue: unknown, message?: string): never {
  throw new OcpValidationError(fieldPath, message ?? `${fieldPath} does not match the canonical storage shape`, {
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (!isRecord(value)) return schemaMismatch(fieldPath, 'object', value);
  return value;
}

function assertExactFields(record: Record<string, unknown>, fields: readonly string[], fieldPath: string): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) schemaMismatch(`${fieldPath}.${key}`, 'absent', record[key]);
  }
  for (const key of fields) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      schemaMismatch(`${fieldPath}.${key}`, 'present canonical field', undefined);
    }
  }
}

/** The flat DAML stock-class record contains fields for other right variants; all must remain null. */
export function assertInapplicableStockClassRightFields(right: Record<string, unknown>, fieldPath: string): void {
  for (const field of INAPPLICABLE_STOCK_CLASS_RIGHT_FIELDS) {
    if (right[field] !== null) {
      schemaMismatch(
        `${fieldPath}.${field}`,
        'null',
        right[field],
        `${field} is inapplicable to a stock-class conversion right and must be null`
      );
    }
  }
}

function assertPlaceholderRight(value: unknown, fieldPath: string, expectedTarget: string): void {
  const variant = requireRecord(value, fieldPath);
  assertExactFields(variant, ['tag', 'value'], fieldPath);
  if (variant.tag !== 'OcfRightConvertible') {
    schemaMismatch(`${fieldPath}.tag`, 'OcfRightConvertible', variant.tag);
  }

  const innerPath = `${fieldPath}.value`;
  const inner = requireRecord(variant.value, innerPath);
  assertExactFields(
    inner,
    ['type_', 'conversion_mechanism', 'converts_to_future_round', 'converts_to_stock_class_id'],
    innerPath
  );
  if (inner.type_ !== 'CONVERTIBLE_CONVERSION_RIGHT') {
    schemaMismatch(`${innerPath}.type_`, 'CONVERTIBLE_CONVERSION_RIGHT', inner.type_);
  }
  if (inner.converts_to_future_round !== null) {
    schemaMismatch(`${innerPath}.converts_to_future_round`, 'null', inner.converts_to_future_round);
  }
  if (inner.converts_to_stock_class_id !== expectedTarget) {
    schemaMismatch(`${innerPath}.converts_to_stock_class_id`, expectedTarget, inner.converts_to_stock_class_id);
  }

  const mechanismPath = `${innerPath}.conversion_mechanism`;
  const mechanism = requireRecord(inner.conversion_mechanism, mechanismPath);
  assertExactFields(mechanism, ['tag', 'value'], mechanismPath);
  if (mechanism.tag !== 'OcfConvMechCustom') {
    schemaMismatch(`${mechanismPath}.tag`, 'OcfConvMechCustom', mechanism.tag);
  }

  const mechanismValuePath = `${mechanismPath}.value`;
  const mechanismValue = requireRecord(mechanism.value, mechanismValuePath);
  assertExactFields(mechanismValue, ['custom_conversion_description'], mechanismValuePath);
  if (mechanismValue.custom_conversion_description !== 'Stock class conversion') {
    schemaMismatch(
      `${mechanismValuePath}.custom_conversion_description`,
      'Stock class conversion',
      mechanismValue.custom_conversion_description
    );
  }
}

/**
 * Verify the circular trigger that DAML v34 requires solely to store an OCF stock-class right.
 * Every persisted trigger field must be identical to its enclosing trigger (or the writer's
 * deterministic unspecified sentinel for StockClass objects), otherwise decoding would be lossy.
 */
export function assertStockClassStorageTrigger(
  value: unknown,
  fieldPath: string,
  expectedTarget: string,
  expectedTrigger: Readonly<Record<string, unknown>>
): void {
  const trigger = requireRecord(value, fieldPath);
  assertExactFields(trigger, TRIGGER_FIELDS, fieldPath);
  assertPlaceholderRight(trigger.conversion_right, `${fieldPath}.conversion_right`, expectedTarget);

  for (const field of COMPARABLE_TRIGGER_FIELDS) {
    const expected = expectedTrigger[field];
    if (!Object.is(trigger[field], expected)) {
      schemaMismatch(`${fieldPath}.${field}`, `same value as enclosing trigger (${String(expected)})`, trigger[field]);
    }
  }
}
