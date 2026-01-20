/**
 * OCF (Open Cap Table Format) comparison utilities.
 *
 * Provides semantic equality comparison for OCF objects with normalization to handle common variations in numeric
 * precision and empty values.
 *
 * @module ocfComparison
 */

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
 *
 * @example
 *   `ocfDeepEqual({
 *   quantity: '100.0000000000' }, { quantity: '100' })` returns `true`
 *
 * @param a - First OCF object
 * @param b - Second OCF object
 * @returns True if objects are semantically equal
 */
export function ocfDeepEqual(a: unknown, b: unknown): boolean {
  // Consider empty arrays equivalent to undefined
  if (isUndefinedLike(a) && isUndefinedLike(b)) return true;

  // Handle null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;

  // Handle different types
  if (typeof a !== typeof b) return false;

  // Handle objects and arrays
  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    // Get all keys
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    const allKeys = Array.from(new Set([...keysA, ...keysB]));

    // Check if all keys match
    for (const key of allKeys) {
      const valA = objA[key];
      const valB = objB[key];

      // Treat empty arrays as undefined-like and skip if both are undefined-like
      if (isUndefinedLike(valA) && isUndefinedLike(valB)) continue;

      // If one is undefined-like and the other isn't, they don't match
      if (isUndefinedLike(valA) !== isUndefinedLike(valB)) return false;

      // Recursively compare values
      if (!ocfDeepEqual(valA, valB)) return false;
    }

    return true;
  }

  // Handle primitive values with normalization
  const normalizedA = normalizeOcfValue(a);
  const normalizedB = normalizeOcfValue(b);

  return normalizedA === normalizedB;
}
