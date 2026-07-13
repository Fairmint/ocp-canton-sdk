/** Database sentinel used to represent an absent UUID reference. */
export const ZERO_UUID = '00000000-0000-0000-0000-000000000000' as const;

/**
 * Recursively normalize the exact all-zero UUID sentinel to absence.
 *
 * Object properties containing the sentinel are omitted. Array positions are
 * retained as `undefined` so required array members still fail OCF schema
 * validation instead of being silently removed.
 */
export function normalizeZeroUuidSentinels(value: string): string | undefined;
export function normalizeZeroUuidSentinels(value: readonly unknown[]): readonly unknown[];
export function normalizeZeroUuidSentinels(value: Record<string, unknown>): Record<string, unknown>;
export function normalizeZeroUuidSentinels(value: unknown): unknown;
export function normalizeZeroUuidSentinels(value: unknown): unknown {
  if (value === ZERO_UUID) return undefined;

  if (Array.isArray(value)) {
    let result: unknown[] | undefined;

    for (const [index, item] of value.entries()) {
      const normalizedItem = normalizeZeroUuidSentinels(item);
      if (normalizedItem !== item) {
        result ??= value.slice();
        result[index] = normalizedItem;
      }
    }

    return result ?? value;
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    let result: Record<string, unknown> | undefined;

    for (const [key, item] of Object.entries(source)) {
      if (item === ZERO_UUID) {
        result ??= { ...source };
        delete result[key];
        continue;
      }

      const normalizedItem = normalizeZeroUuidSentinels(item);
      if (normalizedItem !== item) {
        result ??= { ...source };
        result[key] = normalizedItem;
      }
    }

    return result ?? value;
  }

  return value;
}
