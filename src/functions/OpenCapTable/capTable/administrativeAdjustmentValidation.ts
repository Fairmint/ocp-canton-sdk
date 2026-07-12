import { canonicalizeNonnegativeDamlNumeric10 } from '../../../utils/damlNumeric';
import { validateRequiredString } from '../../../utils/validation';
import {
  generatedDamlTimeToDateString,
  optionalGeneratedDamlTimeToDateString,
  requireGeneratedDamlNumeric10,
} from '../shared/generatedDamlValues';
import type { AdministrativeAdjustmentEntityType } from './adjustmentContractData';

interface AdministrativeAdjustmentDefinition {
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly subjectField: 'issuer_id' | 'stock_class_id' | 'stock_plan_id';
}

const ADMINISTRATIVE_ADJUSTMENT_DEFINITION_MAP: Readonly<
  Record<AdministrativeAdjustmentEntityType, AdministrativeAdjustmentDefinition>
> = {
  issuerAuthorizedSharesAdjustment: { numericField: 'new_shares_authorized', subjectField: 'issuer_id' },
  stockClassAuthorizedSharesAdjustment: {
    numericField: 'new_shares_authorized',
    subjectField: 'stock_class_id',
  },
  stockPlanPoolAdjustment: { numericField: 'shares_reserved', subjectField: 'stock_plan_id' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

/** Canonical nonnegative fixed-point Numeric(10) accepted by OCF writer boundaries. */
export function canonicalizeAdministrativeAdjustmentWriterNumeric(value: unknown, fieldPath: string): string {
  return canonicalizeNonnegativeDamlNumeric10(
    value,
    fieldPath,
    'nonnegative fixed-point Numeric(10) string with at most 28 integral and 10 fractional digits'
  );
}

/** Canonical nonnegative generated Numeric(10), including the generated wire contract's exponent form. */
export function canonicalizeAdministrativeAdjustmentReadNumeric(value: unknown, fieldPath: string): string {
  return requireGeneratedDamlNumeric10(value, fieldPath, 'nonnegative');
}

/** Validate semantic fields that generated codecs model only as Text, Numeric, Time, or Optional Time. */
export function validateAdministrativeAdjustmentDamlSemantics(
  entityType: AdministrativeAdjustmentEntityType,
  input: unknown
): void {
  if (!isRecord(input)) return;
  const { numericField, subjectField } = ADMINISTRATIVE_ADJUSTMENT_DEFINITION_MAP[entityType];
  if (hasOwnField(input, 'id')) validateRequiredString(input.id, `${entityType}.id`);
  if (hasOwnField(input, subjectField)) validateRequiredString(input[subjectField], `${entityType}.${subjectField}`);
  if (hasOwnField(input, numericField)) {
    canonicalizeAdministrativeAdjustmentReadNumeric(input[numericField], `${entityType}.${numericField}`);
  }
  if (hasOwnField(input, 'date')) {
    generatedDamlTimeToDateString(input.date, `${entityType}.date`);
  }
  for (const field of ['board_approval_date', 'stockholder_approval_date'] as const) {
    if (hasOwnField(input, field)) {
      optionalGeneratedDamlTimeToDateString(input[field], `${entityType}.${field}`);
    }
  }
  if (Array.isArray(input.comments)) {
    input.comments.forEach((comment, index) => validateRequiredString(comment, `${entityType}.comments[${index}]`));
  }
}
