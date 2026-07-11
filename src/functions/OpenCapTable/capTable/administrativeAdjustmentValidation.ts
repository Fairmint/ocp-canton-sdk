import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { normalizeOcfNumericString } from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';
import type { AdministrativeAdjustmentEntityType } from './adjustmentContractData';

interface AdministrativeAdjustmentValidationInput {
  readonly id: unknown;
  readonly subjectField: 'issuer_id' | 'stock_class_id' | 'stock_plan_id';
  readonly subjectValue: unknown;
  readonly numericField: 'new_shares_authorized' | 'shares_reserved';
  readonly numericValue: unknown;
  readonly comments: unknown;
}

/** Validate shared OCF v0.4.0 administrative-adjustment invariants and return the canonical total. */
export function validateAdministrativeAdjustmentFields(
  entityType: AdministrativeAdjustmentEntityType,
  input: AdministrativeAdjustmentValidationInput
): string {
  validateRequiredString(input.id, `${entityType}.id`);
  validateRequiredString(input.subjectValue, `${entityType}.${input.subjectField}`);

  if (!Array.isArray(input.comments)) {
    throw new OcpValidationError(`${entityType}.comments`, 'Comments must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string[]',
      receivedValue: input.comments,
    });
  }
  input.comments.forEach((comment, index) => validateRequiredString(comment, `${entityType}.comments[${index}]`));

  const fieldPath = `${entityType}.${input.numericField}`;
  const normalized = normalizeOcfNumericString(input.numericValue, fieldPath);
  if (normalized.startsWith('-') && normalized !== '-0') {
    throw new OcpValidationError(fieldPath, 'Absolute share totals must be non-negative', {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-negative decimal string with at most 10 fractional digits',
      receivedValue: input.numericValue,
    });
  }

  return normalized === '-0' ? '0' : normalized;
}
