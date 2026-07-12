import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { DeepReadonly } from '../../../types/common';
import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
  OcfStockRepurchase,
} from '../../../types/native';
import { requireStringArray } from './ocfValues';

type StockCorporateAction =
  | OcfStockClassConversionRatioAdjustment
  | OcfStockClassSplit
  | OcfStockConsolidation
  | OcfStockReissuance
  | OcfStockRepurchase;

function required(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(fieldPath: string, expectedType: string, receivedValue: unknown): never {
  throw new OcpValidationError(fieldPath, `${fieldPath} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

/** Enforce the non-empty DAML Text refinements shared by stock corporate actions. */
export function requireStockCorporateActionText(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) required(fieldPath, 'non-empty string', value);
  if (typeof value !== 'string') invalidType(fieldPath, 'non-empty string', value);
  if (value.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must be non-empty`, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

/** Decode/encode an optional Text whose present DAML value must be non-empty. */
export function optionalStockCorporateActionText(value: unknown, fieldPath: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireStockCorporateActionText(value, fieldPath);
}

/** Encode a canonical optional Text as the exact generated DAML Optional representation. */
export function optionalStockCorporateActionTextToDaml(value: unknown, fieldPath: string): string | null {
  return optionalStockCorporateActionText(value, fieldPath) ?? null;
}

/** Validate comments: the list may be empty, but every DAML Text element must be non-empty. */
export function requireStockCorporateActionComments(value: unknown, fieldPath: string): string[] {
  return requireStringArray(value, fieldPath).map((comment, index) =>
    requireStockCorporateActionText(comment, `${fieldPath}[${index}]`)
  );
}

/** Encode optional canonical comments using the exact required generated DAML list. */
export function stockCorporateActionCommentsToDaml(value: unknown, fieldPath: string): string[] {
  if (value === undefined) return [];
  return requireStockCorporateActionComments(value, fieldPath);
}

/**
 * Validate a required identifier list against OCF cardinality and pinned DAML uniqueness/text refinements.
 */
export function requireStockCorporateActionIdentifiers(value: unknown, fieldPath: string): [string, ...string[]] {
  const identifiers = requireStringArray(value, fieldPath).map((identifier, index) =>
    requireStockCorporateActionText(identifier, `${fieldPath}[${index}]`)
  );
  if (identifiers.length === 0) {
    throw new OcpValidationError(fieldPath, `${fieldPath} must contain at least one identifier`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
      expectedType: 'non-empty array of unique, non-empty strings',
      receivedValue: identifiers,
    });
  }

  const firstIndexByIdentifier = new Map<string, number>();
  for (let index = 0; index < identifiers.length; index += 1) {
    const identifier = identifiers[index];
    if (identifier === undefined) throw new TypeError('Validated corporate-action identifier disappeared');
    const duplicateOfIndex = firstIndexByIdentifier.get(identifier);
    if (duplicateOfIndex !== undefined) {
      throw new OcpValidationError(`${fieldPath}[${index}]`, `${fieldPath} identifiers must be unique`, {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: 'unique identifier',
        receivedValue: identifier,
        context: { duplicateIndex: index, duplicateOfIndex },
      });
    }
    firstIndexByIdentifier.set(identifier, index);
  }

  const [first, ...remaining] = identifiers;
  if (first === undefined) throw new TypeError('Non-empty corporate-action identifier validation returned empty');
  return [first, ...remaining];
}

function cloneAndFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value === null || typeof value !== 'object') return value as DeepReadonly<Value>;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as DeepReadonly<Value>;
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new TypeError('Constructed corporate-action event must contain only data properties');
    }
    Object.defineProperty(clone, key, {
      configurable: false,
      enumerable: true,
      value: cloneAndFreeze(descriptor.value),
      writable: false,
    });
  }
  return Object.freeze(clone) as DeepReadonly<Value>;
}

/** Return a detached, recursively frozen stock corporate-action read snapshot. */
export function freezeStockCorporateActionEvent<T extends StockCorporateAction>(event: T): DeepReadonly<T> {
  return cloneAndFreeze(event);
}
