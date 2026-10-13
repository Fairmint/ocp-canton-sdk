/**
 * Return a value after proving that it is neither `null` nor `undefined`.
 *
 * This is intentionally small and internal. It is useful at script and test
 * boundaries where an earlier assertion (for example, an array length check)
 * cannot be carried through an indexed access by TypeScript.
 */
export function requireDefined<T>(value: T | null | undefined, context: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${context} to be defined`);
  }

  return value;
}

/** Return the first array element or fail with a contextual invariant message. */
export function requireFirst<T>(values: readonly T[], context: string): T {
  return requireDefined(values[0], context);
}
