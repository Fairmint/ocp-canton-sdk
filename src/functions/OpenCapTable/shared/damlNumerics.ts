import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { Monetary } from '../../../types/native';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { damlMonetaryToNativeWithValidation, isRecord } from '../../../utils/typeConversions';
import { assertExactObjectFields, assertNotRuntimeProxy, requireCurrencyCode } from './ocfValues';

const DAML_NUMERIC_10_EXPECTED_TYPE =
  'DAML Numeric(10) decimal string with at most 28 integral digits and 10 fractional digits';

function invalidNumeric(
  value: unknown,
  fieldPath: string,
  code: 'REQUIRED_FIELD_MISSING' | 'INVALID_TYPE' | 'INVALID_FORMAT'
): never {
  const message =
    code === 'REQUIRED_FIELD_MISSING'
      ? `${fieldPath} is required`
      : `${fieldPath} must be a valid ${DAML_NUMERIC_10_EXPECTED_TYPE}`;
  throw new OcpValidationError(fieldPath, message, {
    code: OcpErrorCodes[code],
    expectedType: DAML_NUMERIC_10_EXPECTED_TYPE,
    receivedValue: value,
  });
}

/**
 * Parse and canonicalize the fixed-point string representation of DAML Numeric 10.
 *
 * Generated DAML codecs only verify that Numeric values are strings, so ledger
 * JSON still needs an exact scale and magnitude check at the SDK boundary.
 */
export function parseDamlNumeric10(value: unknown, fieldPath: string): string {
  if (value === undefined) return invalidNumeric(value, fieldPath, 'REQUIRED_FIELD_MISSING');
  if (typeof value !== 'string') return invalidNumeric(value, fieldPath, 'INVALID_TYPE');

  const numeric = canonicalizeNumeric10(value, { allowExponent: false });
  if (!numeric.ok) return invalidNumeric(value, fieldPath, 'INVALID_FORMAT');
  return numeric.value;
}

/** Parse a DAML Numeric 10 that must also satisfy the canonical OCF Percentage range. */
export function parseDamlPercentage(value: unknown, fieldPath: string): string {
  const normalized = parseDamlNumeric10(value, fieldPath);
  if (!normalized.startsWith('-') && (normalized === '0' || normalized === '1' || normalized.startsWith('0.'))) {
    return normalized;
  }

  throw new OcpValidationError(fieldPath, `${fieldPath} must be between 0 and 1 inclusive`, {
    code: OcpErrorCodes.OUT_OF_RANGE,
    expectedType: 'DAML Numeric(10) percentage between 0 and 1 inclusive',
    receivedValue: value,
  });
}

/** Encode a native Monetary amount using the exact fixed-point limits of DAML Numeric 10. */
export function nativeMonetaryToDamlNumeric10(value: unknown, fieldPath: string): { amount: string; currency: string } {
  if (value === undefined) {
    throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  assertNotRuntimeProxy(value, fieldPath, 'exact Monetary object');
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be a Monetary object`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'Monetary object',
      receivedValue: value,
    });
  }
  assertExactObjectFields(value, ['amount', 'currency'], fieldPath);
  if (value.currency === undefined) {
    throw new OcpValidationError(`${fieldPath}.currency`, `${fieldPath}.currency is required`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: value.currency,
    });
  }
  if (typeof value.currency !== 'string') {
    throw new OcpValidationError(`${fieldPath}.currency`, `${fieldPath}.currency must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'three-letter uppercase ISO 4217 currency code',
      receivedValue: value.currency,
    });
  }
  if (!/^[A-Z]{3}$/.test(value.currency)) {
    throw new OcpValidationError(
      `${fieldPath}.currency`,
      `${fieldPath}.currency must be a three-letter uppercase ISO 4217 code`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'three-letter uppercase ISO 4217 currency code',
        receivedValue: value.currency,
      }
    );
  }
  const amount = parseDamlNumeric10(value.amount, `${fieldPath}.amount`);
  if (amount.startsWith('-')) {
    throw new OcpValidationError(`${fieldPath}.amount`, `${fieldPath}.amount must be nonnegative`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'nonnegative DAML Numeric(10)',
      receivedValue: value.amount,
    });
  }
  return {
    amount,
    currency: value.currency,
  };
}

/** Validate a nullable generated Monetary record using the strict Numeric 10 parser for its amount. */
export function damlNumeric10MonetaryToNative(value: unknown, fieldPath: string): Monetary | undefined {
  if (!isRecord(value)) return damlMonetaryToNativeWithValidation(value, fieldPath);
  const amount = parseDamlNumeric10(value.amount, `${fieldPath}.amount`);
  const monetary = damlMonetaryToNativeWithValidation({ ...value, amount }, fieldPath);
  if (monetary === undefined) return undefined;
  return {
    amount: monetary.amount,
    currency: requireCurrencyCode(monetary.currency, `${fieldPath}.currency`),
  };
}
