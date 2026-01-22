/**
 * OCF (Open Cap Table Format) comparison utilities.
 *
 * Provides semantic equality comparison for OCF objects with normalization to handle common variations in numeric
 * precision and empty values.
 *
 * @module ocfComparison
 */

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
] as const;

/**
 * Options for OCF comparison.
 */
export interface OcfComparisonOptions {
  /**
   * Fields to ignore during comparison. Defaults to DEFAULT_INTERNAL_FIELDS.
   * Set to empty array to compare all fields.
   */
  ignoredFields?: readonly string[];

  /**
   * Deprecated fields that may differ between source and destination.
   * Defaults to DEFAULT_DEPRECATED_FIELDS.
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
 * - Numbers as strings are converted to fixed precision
 * - Whitespace is trimmed from strings
 *
 * @param value - Value to normalize
 * @returns Normalized value for comparison
 */
function normalizeOcfValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // Trim whitespace to avoid mismatches due to leading/trailing spaces
    const trimmed = value.trim();

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
  const ignoredFields = new Set(options?.ignoredFields ?? DEFAULT_INTERNAL_FIELDS);
  const deprecatedFields = new Set(options?.deprecatedFields ?? DEFAULT_DEPRECATED_FIELDS);
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

    // Handle different types
    if (typeof valA !== typeof valB) {
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

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (toRemove.has(key)) continue;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripInternalFields(value as Record<string, unknown>, fieldsToRemove);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripInternalFields(item as Record<string, unknown>, fieldsToRemove)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}
