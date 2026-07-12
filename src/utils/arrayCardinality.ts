import { OcpErrorCodes, OcpValidationError } from '../errors';
import { diagnosticPropertyPath } from '../errors/diagnosticValue';
import { snapshotDenseArrayValues } from './denseArray';

export interface ArrayItemContext {
  readonly fieldPath: string;
  readonly index: number;
}

export type ArrayItemParser<T> = (value: unknown, context: ArrayItemContext) => T;

export interface ArrayCardinality {
  readonly maximum?: number;
  readonly minimum?: number;
}

export interface ArrayUniqueness<T> {
  readonly key: (value: T) => string | number;
  readonly expectedType?: string;
}

export interface ParseArraySnapshotOptions<T> {
  readonly cardinality?: ArrayCardinality;
  readonly item: ArrayItemParser<T>;
  readonly uniqueness?: ArrayUniqueness<T>;
}

function validateCardinalityConfiguration(cardinality: ArrayCardinality): void {
  const { maximum, minimum } = cardinality;
  if (minimum !== undefined && (!Number.isSafeInteger(minimum) || minimum < 0)) {
    throw new Error('Array minimum must be a non-negative safe integer');
  }
  if (maximum !== undefined && (!Number.isSafeInteger(maximum) || maximum < 0)) {
    throw new Error('Array maximum must be a non-negative safe integer');
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new Error('Array minimum must not exceed its maximum');
  }
}

/**
 * Copy an untrusted array without invoking Proxy traps or element accessors.
 *
 * The returned array is always a fresh, dense, ordinary Array. Item validation,
 * cardinality, and schema uniqueness are applied before the snapshot is exposed.
 */
export function parseArraySnapshot<T>(value: unknown, fieldPath: string, options: ParseArraySnapshotOptions<T>): T[] {
  const cardinality = options.cardinality ?? {};
  validateCardinalityConfiguration(cardinality);
  const values = snapshotDenseArrayValues(value, fieldPath);
  const { length } = values;

  const { maximum, minimum } = cardinality;
  if (minimum !== undefined && length < minimum) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must contain at least ${minimum} item${minimum === 1 ? '' : 's'}`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: `array with at least ${minimum} item${minimum === 1 ? '' : 's'}`,
        receivedValue: values,
        context: { actualItems: length, minimumItems: minimum },
      }
    );
  }
  if (maximum !== undefined && length > maximum) {
    throw new OcpValidationError(
      fieldPath,
      `${fieldPath} must contain at most ${maximum} item${maximum === 1 ? '' : 's'}`,
      {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: `array with at most ${maximum} item${maximum === 1 ? '' : 's'}`,
        receivedValue: values,
        context: { actualItems: length, maximumItems: maximum },
      }
    );
  }

  const parsed: T[] = [];
  const firstIndexByKey = new Map<string | number, number>();
  for (let index = 0; index < length; index += 1) {
    const itemPath = diagnosticPropertyPath(fieldPath, String(index));
    const { [index]: itemValue } = values;
    const item = options.item(itemValue, { fieldPath: itemPath, index });
    if (options.uniqueness !== undefined) {
      const key = options.uniqueness.key(item);
      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex !== undefined) {
        throw new OcpValidationError(itemPath, `${itemPath} duplicates array item ${firstIndex}`, {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: options.uniqueness.expectedType ?? 'unique array item',
          receivedValue: item,
          context: { duplicateIndex: index, duplicateOfIndex: firstIndex },
        });
      }
      firstIndexByKey.set(key, index);
    }
    parsed.push(item);
  }

  return parsed;
}

/** Validate one exact string array item without trimming or coercion. */
export function parseStringArrayItem(value: unknown, context: ArrayItemContext): string {
  if (typeof value !== 'string') {
    throw new OcpValidationError(context.fieldPath, `${context.fieldPath} must be a string`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
      context: { index: context.index },
    });
  }
  return value;
}
