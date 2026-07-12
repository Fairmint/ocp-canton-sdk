import { canonicalizeNonnegativeDamlNumeric10 } from '../../../utils/damlNumeric';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import type { AdministrativeAdjustmentEntityType } from './adjustmentContractData';

interface AdministrativeAdjustmentDefinition {
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
}

const ADMINISTRATIVE_ADJUSTMENT_DEFINITION_MAP: Readonly<
  Record<AdministrativeAdjustmentEntityType, AdministrativeAdjustmentDefinition>
> = {
  issuerAuthorizedSharesAdjustment: { numericField: 'new_shares_authorized' },
  stockClassAuthorizedSharesAdjustment: { numericField: 'new_shares_authorized' },
  stockPlanPoolAdjustment: { numericField: 'shares_reserved' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

/** Canonical nonnegative fixed-point Numeric(10) shared by all adjustment read and write boundaries. */
export function canonicalizeAdministrativeAdjustmentNumeric(value: unknown, fieldPath: string): string {
  return canonicalizeNonnegativeDamlNumeric10(
    value,
    fieldPath,
    'nonnegative fixed-point Numeric(10) string with at most 28 integral and 10 fractional digits'
  );
}

/** Validate semantic fields that generated codecs model only as Text, Numeric, Time, or Optional Time. */
export function validateAdministrativeAdjustmentDamlSemantics(
  entityType: AdministrativeAdjustmentEntityType,
  input: unknown
): void {
  if (!isRecord(input)) return;
  const { numericField } = ADMINISTRATIVE_ADJUSTMENT_DEFINITION_MAP[entityType];
  if (hasOwnField(input, numericField)) {
    canonicalizeAdministrativeAdjustmentNumeric(input[numericField], `${entityType}.${numericField}`);
  }
  if (hasOwnField(input, 'date')) {
    damlTimeToDateString(input.date, `${entityType}.date`);
  }
  for (const field of ['board_approval_date', 'stockholder_approval_date'] as const) {
    if (hasOwnField(input, field)) {
      optionalDamlTimeToDateString(input[field], `${entityType}.${field}`);
    }
  }
}
