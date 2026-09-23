/**
 * OCF (Open Cap Table Format) comparison utilities.
 *
 * Provides semantic equality comparison for OCF objects with normalization to handle common variations in numeric
 * precision and empty values.
 *
 * @module ocfComparison
 */

import { tryIsoDateToDateString } from './typeConversions';

/**
 * Default internal fields added by the database/SDK that should be ignored during comparison.
 * These are not part of the OCF specification.
 */
export const DEFAULT_INTERNAL_FIELDS = [
  '__v', // MongoDB version key
  '_id', // MongoDB document ID
  '_source', // Fixture source marker
  'issuer', // Internal issuer reference
  'tx_hash', // Blockchain transaction hash
  'createdAt', // Database timestamp
  'updatedAt', // Database timestamp
  'is_onchain_synced', // Sync status flag
  'vestings', // Computed vesting schedule (derived data)
] as const;

/**
 * Deprecated OCF fields that may differ between source and round-tripped data.
 * These fields may be upgraded or removed during processing.
 */
export const DEFAULT_DEPRECATED_FIELDS = [
  'option_grant_type', // Deprecated in favor of compensation_type
  'current_relationship', // Deprecated in favor of current_relationships (Stakeholder)
  'stock_class_id', // Deprecated in favor of stock_class_ids (StockPlan)
] as const;

/**
 * Options for OCF comparison.
 */
export interface OcfComparisonOptions {
  /**
   * Fields to ignore during comparison. Defaults to empty array (compare all fields).
   * Use DEFAULT_INTERNAL_FIELDS to ignore internal database/SDK fields.
   */
  ignoredFields?: readonly string[];

  /**
   * Deprecated fields that may differ between source and destination.
   * Defaults to empty array (compare all fields).
   * Use DEFAULT_DEPRECATED_FIELDS to ignore deprecated OCF fields.
   */
  deprecatedFields?: readonly string[];

  /**
   * Whether to report differences for debugging. When true, differences are logged to console.
   * Default: false
   */
  reportDifferences?: boolean;
}

/**
 * Result of an OCF comparison with details about any differences found.
 */
export interface OcfComparisonResult {
  /** Whether the objects are semantically equal. */
  equal: boolean;
  /** List of paths where differences were found. */
  differences: string[];
}

/**
 * Normalize a value for OCF comparison.
 *
 * Handles common variations that should be considered equal:
 *
 * - Numbers (JS number type) are converted to fixed precision strings
 * - Numeric strings are converted to the same fixed precision format
 * - This ensures `22500` (number) and `"22500"` (string) compare as equal
 * - Whitespace is trimmed from strings
 * - Date strings are normalized to YYYY-MM-DD (strips time portion from ISO timestamps)
 *
 * @param value - Value to normalize
 * @returns Normalized value for comparison
 */
function normalizeOcfValue(value: unknown): unknown {
  // Normalize JS numbers to the same fixed-precision string format as numeric strings.
  // DB JSONB can store amounts as numbers (e.g., 22500) while DAML readback returns
  // strings (e.g., "22500"). Without this, they would always fail the type check.
  //
  // Precision note: toFixed(10) is safe for OCF monetary values (share prices,
  // quantities, etc.) which are well within IEEE 754 safe integer range.
  // Values beyond Number.MAX_SAFE_INTEGER would lose precision before reaching
  // this code, but OCF amounts don't approach that range.
  if (typeof value === 'number' && isFinite(value)) {
    return value.toFixed(10);
  }

  if (typeof value === 'string') {
    // Trim whitespace to avoid mismatches due to leading/trailing spaces
    const trimmed = value.trim();

    // Normalize date strings before numeric parsing.
    // Date-only strings like "2024-01-15" would fail Number() anyway, but
    // ISO timestamps like "2024-01-15T00:00:00.000Z" also fail Number(),
    // so both fall through to the return. Without this normalization,
    // "2024-01-15" !== "2024-01-15T00:00:00.000Z" causes phantom edits
    // during replication.
    const normalizedDate = tryIsoDateToDateString(trimmed);
    if (normalizedDate !== null) {
      return normalizedDate;
    }

    // Try to parse as a number after trimming
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      // Convert to fixed precision for consistent comparison
      return num.toFixed(10);
    }

    return trimmed;
  }
  return value;
}

/**
 * Check if a value should be treated as undefined/empty for comparison purposes.
 *
 * Handles OCF-specific patterns where empty/null/placeholder values should match:
 *
 * - Null, undefined
 * - Empty strings or whitespace-only strings
 * - Empty arrays or arrays where all elements are undefined-like
 * - Empty objects or objects where all values are undefined-like
 * - ShareNumberRange objects with 0-0 range (placeholder)
 *
 * @param value - Value to check
 * @returns True if value should be treated as undefined
 */
function isUndefinedLike(value: unknown): boolean {
  // Null or undefined
  if (value === undefined || value === null) return true;

  // Blank string (including whitespace-only)
  if (typeof value === 'string' && value.trim() === '') return true;

  // Helper: detect a ShareNumberRange object with both start/end equal to zero
  const isZeroShareRange = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false;
    const obj = v as Record<string, unknown>;
    const startRaw = obj['starting_share_number'];
    const endRaw = obj['ending_share_number'];
    // Both keys must exist
    if (startRaw === undefined || endRaw === undefined) return false;
    const parseToNumber = (x: unknown): number => {
      if (typeof x === 'number') return x;
      if (typeof x === 'string') {
        const n = Number(x.trim());
        return isNaN(n) ? NaN : n;
      }
      return NaN;
    };
    const start = parseToNumber(startRaw);
    const end = parseToNumber(endRaw);
    return !isNaN(start) && !isNaN(end) && start === 0 && end === 0;
  };

  // Arrays: treat as undefined-like if empty or every element is undefined-like
  // Also treat arrays composed entirely of 0-0 share number ranges as undefined-like placeholders
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (value.every((v) => isUndefinedLike(v))) return true;
    if (value.every((v) => isZeroShareRange(v))) return true;
    return false;
  }

  // Objects: treat as undefined-like if empty or every property is undefined-like
  // Also treat a single 0-0 ShareNumberRange object as undefined-like placeholder
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return true;
    if (isZeroShareRange(value)) return true;
    return keys.every((k) => isUndefinedLike(obj[k]));
  }

  return false;
}

/**
 * Schema-default equivalence rules.
 *
 * OCF data reaches this SDK from differently-shaped producers: the database may store
 * explicit values that Canton legacy contracts omit (or vice versa) because an OCF
 * schema default (or a semantically identical default shape) applies on one side.
 * These rules describe OCF schema-level equivalences where two differently-shaped
 * payloads are semantically identical, so `ocfCompare` and `diffOcfObjects` can treat
 * them as equal instead of reporting benign drift.
 *
 * Each rule has:
 * - a stable `id` (useful for logs, tests, and debugging),
 * - a `match` path matcher against the dotted comparison path (`exact` for equality,
 *   `suffix` for "path equals or ends with `.<path>`" on dotted-segment boundaries),
 * - a pure, side-agnostic `isEquivalent(valA, valB)` predicate that returns true when
 *   the two values should be treated as schema-default equivalent.
 *
 * Rules must stay narrow: a rule that fires too broadly can mask real drift in the
 * Gate A parity check.
 */
export interface SchemaDefaultEquivalenceRule {
  /** Stable identifier for the rule (used in logs, tests, and debugging). */
  readonly id: string;
  /** Human-readable rationale for why the shapes are semantically equivalent. */
  readonly description: string;
  /** Path matcher applied to the dotted comparison path. */
  readonly match: SchemaDefaultEquivalencePathMatcher;
  /** Pure predicate: true when this value pair is schema-default equivalent. */
  readonly isEquivalent: (valA: unknown, valB: unknown) => boolean;
}

/** Matcher for a rule's dotted path: exact equality or dotted-segment suffix match. */
export type SchemaDefaultEquivalencePathMatcher =
  { readonly kind: 'exact'; readonly path: string } | { readonly kind: 'suffix'; readonly path: string };

/**
 * Data-driven table consulted by {@link isSchemaDefaultEquivalent}.
 *
 * Order matters only for readability; every matching rule whose predicate returns
 * true makes the pair equivalent.
 */
export const SCHEMA_DEFAULT_EQUIVALENCE_RULES: readonly SchemaDefaultEquivalenceRule[] = [
  {
    id: 'portion-remainder-false-default',
    description:
      'OCF VestingConditionPortion.remainder defaults to false, so an explicit false is equivalent to the field being omitted (undefined-like).',
    match: { kind: 'suffix', path: 'portion.remainder' },
    isEquivalent: (valA, valB) =>
      (valA === false && isUndefinedLike(valB)) || (valB === false && isUndefinedLike(valA)),
  },
  {
    id: 'conversion-rights-single-1to1-ratio',
    description:
      'A stock class (or warrant) conversion_rights array holding exactly one complete 1:1 RATIO_CONVERSION right ' +
      '(NORMAL rounding and a present conversion_price) is economically identical to having no conversion right at ' +
      'all, so it is equivalent to the field being absent or empty. Rights with converts_to_future_round: true, a ' +
      'non-NORMAL rounding_type, a missing price, or a non-1:1 ratio change semantics and are NOT equivalent.',
    match: { kind: 'suffix', path: 'conversion_rights' },
    isEquivalent: (valA, valB) => isOneToOneRatioConversionRightsPair(valA, valB),
  },
];

// Freeze the exported table, rules, and matchers so consumers cannot mutate comparison
// semantics process-wide (ocfCompare reads these same objects; see Copilot review).
for (const rule of SCHEMA_DEFAULT_EQUIVALENCE_RULES) {
  Object.freeze(rule);
  Object.freeze(rule.match);
}
Object.freeze(SCHEMA_DEFAULT_EQUIVALENCE_RULES);

/**
 * Match a dotted comparison path against a rule's matcher.
 *
 * Suffix matches only fire on segment boundaries (`x.portion.remainder` matches,
 * `x.notportion.remainder` does not).
 */
function pathMatchesRule(path: string, rule: SchemaDefaultEquivalenceRule): boolean {
  if (rule.match.kind === 'exact') return path === rule.match.path;
  return path === rule.match.path || path.endsWith(`.${rule.match.path}`);
}

/**
 * Coerce a string|number ratio component and check whether it is numerically 1.
 *
 * Accepts `1`, `'1'`, `'1.00'`, `' 1 '` etc.; rejects non-numeric or non-1 values.
 */
function isNumericOne(value: unknown): boolean {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(num) && num === 1;
}

/**
 * Check whether a single conversion right is a 1:1 RATIO_CONVERSION right.
 *
 * A right counts as 1:1 RATIO_CONVERSION iff:
 * - `type` is `STOCK_CLASS_CONVERSION_RIGHT` or absent (tolerant of untyped payloads),
 * - `conversion_mechanism.type` is `RATIO_CONVERSION`,
 * - the ratio numerator and denominator are both numerically 1 (string or number).
 *
 * A right with `converts_to_future_round: true` changes semantics (it converts into a
 * round that does not exist yet) and is explicitly NOT schema-default equivalent.
 */
function isOneToOneRatioConversionRight(right: unknown): boolean {
  if (!right || typeof right !== 'object' || Array.isArray(right)) return false;
  const obj = right as Record<string, unknown>;

  // Tolerant on the discriminator: accept the canonical type or an absent type.
  if (obj['type'] !== undefined && obj['type'] !== 'STOCK_CLASS_CONVERSION_RIGHT') return false;

  const mechanism = obj['conversion_mechanism'];
  if (!mechanism || typeof mechanism !== 'object' || Array.isArray(mechanism)) return false;
  const mechanismObj = mechanism as Record<string, unknown>;
  if (mechanismObj['type'] !== 'RATIO_CONVERSION') return false;

  const { ratio } = mechanismObj;
  if (!ratio || typeof ratio !== 'object' || Array.isArray(ratio)) return false;
  const ratioObj = ratio as Record<string, unknown>;
  if (!isNumericOne(ratioObj['numerator']) || !isNumericOne(ratioObj['denominator'])) return false;

  // Require the complete intended right shape before treating it as schema-default:
  // OCF mandates rounding_type (only NORMAL is part of the 1:1 default shape — CEILING/FLOOR
  // change fractional-share semantics) and conversion_price.
  if (mechanismObj['rounding_type'] !== 'NORMAL') return false;
  const conversionPrice = mechanismObj['conversion_price'];
  if (
    !conversionPrice ||
    typeof conversionPrice !== 'object' ||
    Array.isArray(conversionPrice) ||
    (conversionPrice as Record<string, unknown>)['amount'] === undefined ||
    (conversionPrice as Record<string, unknown>)['currency'] === undefined
  ) {
    return false;
  }

  // converts_to_future_round: true means the right converts into a future round —
  // that is real economics, not a schema default.
  if (obj['converts_to_future_round'] === true) return false;

  return true;
}

/**
 * Check whether a conversion_rights value pair is schema-default equivalent:
 * one side undefined-like (absent/null/empty array) and the other side an array
 * holding exactly one 1:1 RATIO_CONVERSION right. Pure and side-agnostic.
 */
function isOneToOneRatioConversionRightsPair(valA: unknown, valB: unknown): boolean {
  const aUndefinedLike = isUndefinedLike(valA);
  const bUndefinedLike = isUndefinedLike(valB);

  // Both sides absent/empty: trivially equivalent (also handled generically upstream).
  if (aUndefinedLike && bUndefinedLike) return true;

  // Exactly one side must be undefined-like; the other must hold exactly one 1:1 right.
  if (aUndefinedLike !== bUndefinedLike) {
    const rights = aUndefinedLike ? valB : valA;
    if (Array.isArray(rights) && rights.length === 1 && isOneToOneRatioConversionRight(rights[0])) {
      return true;
    }
  }

  return false;
}

/**
 * Check semantic equivalence for schema-defaulted fields.
 *
 * Consults the data-driven {@link SCHEMA_DEFAULT_EQUIVALENCE_RULES} table: for each
 * rule whose path matcher matches the dotted comparison path, the rule's pure
 * predicate decides whether the two differently-shaped values are semantically
 * identical at the OCF schema level.
 *
 * Examples:
 * - OCF `VestingConditionPortion.remainder`: omitted and `false` are equivalent
 *   because the schema default is false.
 * - `conversion_rights`: an array with exactly one complete 1:1 RATIO_CONVERSION right
 *   (NORMAL rounding, present conversion_price) is equivalent to the field being
 *   absent or empty (1:1 ratio ≡ no right).
 */
export function isSchemaDefaultEquivalent(path: string, valA: unknown, valB: unknown): boolean {
  for (const rule of SCHEMA_DEFAULT_EQUIVALENCE_RULES) {
    if (!pathMatchesRule(path, rule)) continue;
    if (rule.isEquivalent(valA, valB)) return true;
  }
  return false;
}

/**
 * Deep equality comparison for OCF objects with normalization.
 *
 * This comparison:
 *
 * - Normalizes numeric strings to fixed precision
 * - Treats empty arrays/objects as equivalent to undefined
 * - Trims string whitespace
 * - Recursively compares nested objects
 * - Optionally ignores internal/deprecated fields
 *
 * @param a - First OCF object
 * @param b - Second OCF object
 * @param options - Comparison options
 * @returns True if objects are semantically equal
 */
export function ocfDeepEqual(a: unknown, b: unknown, options?: OcfComparisonOptions): boolean {
  const result = ocfCompare(a, b, options);
  return result.equal;
}

/**
 * Compare two OCF objects and return detailed results.
 *
 * @param a - First OCF object (typically the source/expected value)
 * @param b - Second OCF object (typically the result/actual value)
 * @param options - Comparison options
 * @returns Comparison result with equality status and list of differences
 *
 * @example
 * ```typescript
 * const result = ocfCompare(sourceFixture, readBackData, {
 *   ignoredFields: DEFAULT_INTERNAL_FIELDS,
 *   reportDifferences: true
 * });
 *
 * if (!result.equal) {
 *   console.log('Differences found:', result.differences);
 * }
 * ```
 */
export function ocfCompare(a: unknown, b: unknown, options?: OcfComparisonOptions): OcfComparisonResult {
  const ignoredFields = new Set(options?.ignoredFields ?? []);
  const deprecatedFields = new Set(options?.deprecatedFields ?? []);
  const allIgnored = new Set([...ignoredFields, ...deprecatedFields]);
  const reportDifferences = options?.reportDifferences ?? false;

  const differences: string[] = [];

  function compare(valA: unknown, valB: unknown, path: string): boolean {
    // Consider empty arrays equivalent to undefined
    if (isUndefinedLike(valA) && isUndefinedLike(valB)) return true;

    // Handle null/undefined
    if (valA === valB) return true;
    if (valA == null || valB == null) {
      differences.push(`${path}: ${JSON.stringify(valA)} !== ${JSON.stringify(valB)}`);
      return false;
    }

    // Handle different types - but try normalization first for number/string pairs.
    // DB JSONB can store numeric values as JS numbers while DAML readback returns strings.
    if (typeof valA !== typeof valB) {
      // If one is a number and the other is a string, try normalizing both before rejecting
      if (
        (typeof valA === 'number' && typeof valB === 'string') ||
        (typeof valA === 'string' && typeof valB === 'number')
      ) {
        const normalizedA = normalizeOcfValue(valA);
        const normalizedB = normalizeOcfValue(valB);
        if (normalizedA === normalizedB) return true;
      }
      differences.push(`${path}: type mismatch (${typeof valA} vs ${typeof valB})`);
      return false;
    }

    // Handle objects and arrays
    if (typeof valA === 'object' && typeof valB === 'object') {
      const objA = valA as Record<string, unknown>;
      const objB = valB as Record<string, unknown>;

      // Handle arrays
      if (Array.isArray(valA) && Array.isArray(valB)) {
        if (valA.length !== valB.length) {
          // Check if difference is just undefined-like elements
          const filteredA = valA.filter((v) => !isUndefinedLike(v));
          const filteredB = valB.filter((v) => !isUndefinedLike(v));
          if (filteredA.length !== filteredB.length) {
            differences.push(`${path}: array length mismatch (${valA.length} vs ${valB.length})`);
            return false;
          }
        }

        let allMatch = true;
        const maxLen = Math.max(valA.length, valB.length);
        for (let i = 0; i < maxLen; i++) {
          if (!compare(valA[i], valB[i], `${path}[${i}]`)) {
            allMatch = false;
          }
        }
        return allMatch;
      }

      // Get all keys, excluding ignored fields
      const keysA = Object.keys(objA).filter((k) => !allIgnored.has(k));
      const keysB = Object.keys(objB).filter((k) => !allIgnored.has(k));
      const allKeys = Array.from(new Set([...keysA, ...keysB]));

      let allMatch = true;

      // Check if all keys match
      for (const key of allKeys) {
        const childValA = objA[key];
        const childValB = objB[key];
        const childPath = path ? `${path}.${key}` : key;

        if (isSchemaDefaultEquivalent(childPath, childValA, childValB)) continue;

        // Treat empty arrays as undefined-like and skip if both are undefined-like
        if (isUndefinedLike(childValA) && isUndefinedLike(childValB)) continue;

        // If one is undefined-like and the other isn't, they don't match
        if (isUndefinedLike(childValA) !== isUndefinedLike(childValB)) {
          differences.push(`${childPath}: one side is empty/undefined`);
          allMatch = false;
          continue;
        }

        // Recursively compare values
        if (!compare(childValA, childValB, childPath)) {
          allMatch = false;
        }
      }

      return allMatch;
    }

    // Handle primitive values with normalization
    const normalizedA = normalizeOcfValue(valA);
    const normalizedB = normalizeOcfValue(valB);

    if (normalizedA !== normalizedB) {
      differences.push(`${path}: ${JSON.stringify(valA)} !== ${JSON.stringify(valB)}`);
      return false;
    }

    return true;
  }

  const equal = compare(a, b, '');

  if (reportDifferences && differences.length > 0) {
    // eslint-disable-next-line no-console
    console.log('OCF comparison differences:');
    for (const diff of differences) {
      // eslint-disable-next-line no-console
      console.log(`  - ${diff}`);
    }
  }

  return { equal, differences };
}

/**
 * Generate detailed diffs between two OCF objects with normalization.
 *
 * Uses the same normalization logic as ocfCompare (isUndefinedLike, normalizeOcfValue)
 * but produces simplified human-readable diff strings instead of a structured result.
 *
 * Note: Unlike ocfCompare, this function does not support ignoredFields or deprecatedFields options.
 * Use ocfCompare with reportDifferences: true if you need field filtering.
 *
 * @param a - First object (typically ledger/source data)
 * @param b - Second object (typically database/destination data)
 * @param path - Current path in the object tree (for recursive calls)
 * @returns Array of diff descriptions
 *
 * @example
 * ```typescript
 * const diffs = diffOcfObjects(ledgerData, dbData);
 * if (diffs.length > 0) {
 *   console.log('Differences found:', diffs);
 * }
 * ```
 */
export function diffOcfObjects(a: unknown, b: unknown, path = ''): string[] {
  const diffs: string[] = [];

  // Consider empty arrays equivalent to undefined
  if (isUndefinedLike(a) && isUndefinedLike(b)) {
    return diffs;
  }

  if (typeof a !== typeof b) {
    // If one is a number and the other is a string, try normalizing both before rejecting
    if ((typeof a === 'number' && typeof b === 'string') || (typeof a === 'string' && typeof b === 'number')) {
      const normalizedA = normalizeOcfValue(a);
      const normalizedB = normalizeOcfValue(b);
      if (normalizedA === normalizedB) return diffs;
    }
    diffs.push(`${path || '(root)'}: type mismatch (${typeof a} vs ${typeof b})`);
    return diffs;
  }

  if (typeof a === 'object' && a && b && typeof b === 'object') {
    // Handle arrays with proper [index] path format
    if (Array.isArray(a) && Array.isArray(b)) {
      // Check for length mismatch (filtering undefined-like elements)
      const filteredA = a.filter((v) => !isUndefinedLike(v));
      const filteredB = b.filter((v) => !isUndefinedLike(v));
      if (filteredA.length !== filteredB.length) {
        diffs.push(`${path || '(root)'}: array length mismatch (${a.length} vs ${b.length})`);
      }

      // Compare array elements
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        const subPath = path ? `${path}[${i}]` : `[${i}]`;
        const av = a[i];
        const bv = b[i];

        if (isUndefinedLike(av) && isUndefinedLike(bv)) continue;
        if (!isUndefinedLike(av) && isUndefinedLike(bv)) {
          diffs.push(`${subPath}: present in ledger only -> ${JSON.stringify(av)}`);
          continue;
        }
        if (isUndefinedLike(av) && !isUndefinedLike(bv)) {
          diffs.push(`${subPath}: present in DB only -> ${JSON.stringify(bv)}`);
          continue;
        }
        diffs.push(...diffOcfObjects(av, bv, subPath));
      }
      return diffs;
    }

    // Handle objects
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    // Get all keys
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    const keys = Array.from(new Set([...keysA, ...keysB])).sort();

    for (const key of keys) {
      const subPath = path ? `${path}.${key}` : key;
      const av = objA[key];
      const bv = objB[key];

      if (isSchemaDefaultEquivalent(subPath, av, bv)) continue;

      if (isUndefinedLike(av) && isUndefinedLike(bv)) continue;
      if (!isUndefinedLike(av) && isUndefinedLike(bv)) {
        diffs.push(`${subPath}: present in ledger only -> ${JSON.stringify(av)}`);
        continue;
      }
      if (isUndefinedLike(av) && !isUndefinedLike(bv)) {
        diffs.push(`${subPath}: present in DB only -> ${JSON.stringify(bv)}`);
        continue;
      }
      diffs.push(...diffOcfObjects(av, bv, subPath));
    }
    return diffs;
  }

  // Compare primitive values with normalization
  const normalizedA = normalizeOcfValue(a);
  const normalizedB = normalizeOcfValue(b);

  if (normalizedA !== normalizedB) {
    diffs.push(`${path || '(root)'}: ${JSON.stringify(normalizedA)} != ${JSON.stringify(normalizedB)}`);
  }
  return diffs;
}

/**
 * Error interface for OCF mismatch errors with diff information.
 */
export interface OcfMismatchError extends Error {
  /** List of differences between the two OCF objects */
  ocfDiffs: string[];
  /** The ledger/source OCF data */
  ledgerOcfJson: unknown;
  /** The database/destination OCF data */
  dbOcfJson: unknown;
}

/**
 * Type guard to check if an error is an OCF mismatch error.
 *
 * @param error - Error to check
 * @returns True if error is an OcfMismatchError
 */
export function isOcfMismatchError(error: unknown): error is OcfMismatchError {
  return error instanceof Error && 'ocfDiffs' in error && 'ledgerOcfJson' in error && 'dbOcfJson' in error;
}

/**
 * Create an enhanced error with OCF diff information.
 *
 * @param message - Error message
 * @param diffs - Array of diff descriptions from diffOcfObjects
 * @param ledgerData - The ledger/source OCF data
 * @param dbData - The database/destination OCF data
 * @returns An OcfMismatchError with the diff information attached
 *
 * @example
 * ```typescript
 * const diffs = diffOcfObjects(ledgerData, dbData);
 * if (diffs.length > 0) {
 *   throw createOcfMismatchError('OCF data mismatch', diffs, ledgerData, dbData);
 * }
 * ```
 */
export function createOcfMismatchError(
  message: string,
  diffs: string[],
  ledgerData: unknown,
  dbData: unknown
): OcfMismatchError {
  const error = new Error(message) as OcfMismatchError;
  error.ocfDiffs = diffs;
  error.ledgerOcfJson = ledgerData;
  error.dbOcfJson = dbData;
  return error;
}

/**
 * Strip internal and deprecated fields from an OCF object for cleaner comparison.
 *
 * @param obj - The OCF object to clean
 * @param fieldsToRemove - Fields to remove (defaults to DEFAULT_INTERNAL_FIELDS + DEFAULT_DEPRECATED_FIELDS)
 * @returns A new object with the specified fields removed
 */
export function stripInternalFields<T extends Record<string, unknown>>(
  obj: T,
  fieldsToRemove?: readonly string[]
): Partial<T> {
  const toRemove = new Set(fieldsToRemove ?? [...DEFAULT_INTERNAL_FIELDS, ...DEFAULT_DEPRECATED_FIELDS]);

  // Helper to process array items (handles nested arrays recursively)
  const processArrayItem = (item: unknown): unknown => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    if (Array.isArray(item)) {
      return item.map(processArrayItem);
    }
    return stripInternalFields(item as Record<string, unknown>, fieldsToRemove);
  };

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (toRemove.has(key)) continue;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripInternalFields(value as Record<string, unknown>, fieldsToRemove);
    } else if (Array.isArray(value)) {
      result[key] = value.map(processArrayItem);
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}
