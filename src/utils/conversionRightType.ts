/**
 * The `type` an OCF conversion right has when its producer leaves it out.
 *
 * OCF makes a conversion right's `type` an optional const: only `conversion_mechanism` is required. The writers read an
 * absent type as the right their position implies, and the readers always emit it, so the absent and the explicit
 * forms are the same right. Comparison uses the same rule, so a source that omits the type is not re-edited forever.
 *
 * @module conversionRightType
 */

/** The `type` discriminators of the three OCF conversion rights. */
export type ConversionRightTypeName =
  'STOCK_CLASS_CONVERSION_RIGHT' | 'WARRANT_CONVERSION_RIGHT' | 'CONVERTIBLE_CONVERSION_RIGHT';

/**
 * The conversion mechanisms that belong to exactly one OCF conversion right. A mechanism several rights share (custom,
 * percent of capitalization, fixed amount) is absent: an untyped right with one of them matches more than one branch of
 * OCF's `oneOf`, which the schema refuses.
 */
export const CONVERSION_RIGHT_TYPE_BY_MECHANISM: ReadonlyMap<string, ConversionRightTypeName> = new Map([
  ['RATIO_CONVERSION', 'STOCK_CLASS_CONVERSION_RIGHT'],
  ['VALUATION_BASED_CONVERSION', 'WARRANT_CONVERSION_RIGHT'],
  ['PPS_BASED_CONVERSION', 'WARRANT_CONVERSION_RIGHT'],
  ['SAFE_CONVERSION', 'CONVERTIBLE_CONVERSION_RIGHT'],
  ['CONVERTIBLE_NOTE_CONVERSION', 'CONVERTIBLE_CONVERSION_RIGHT'],
]);

/** The type an untyped right takes from its mechanism, when the mechanism belongs to exactly one right. */
export function conversionRightTypeOfMechanism(
  right: Readonly<Record<string, unknown>>
): ConversionRightTypeName | undefined {
  const mechanism = right.conversion_mechanism;
  if (mechanism === null || typeof mechanism !== 'object' || Array.isArray(mechanism)) return undefined;
  const mechanismType = (mechanism as { type?: unknown }).type;
  return typeof mechanismType === 'string' ? CONVERSION_RIGHT_TYPE_BY_MECHANISM.get(mechanismType) : undefined;
}

/**
 * The type an untyped conversion right at `rightPath` (a dotted comparison path such as `conversion_rights[0]` or
 * `exercise_triggers[1].conversion_right`) is written and read back as, or `undefined` when the path is not a conversion
 * right or the writers refuse the untyped right:
 *
 * - a stock class's `conversion_rights[n]`: STOCK_CLASS_CONVERSION_RIGHT;
 * - a convertible's `conversion_triggers[n].conversion_right`: CONVERTIBLE_CONVERSION_RIGHT (the DAML convertible
 *   trigger holds only that right);
 * - a warrant's `exercise_triggers[n].conversion_right`: the right its mechanism belongs to
 *   ({@link CONVERSION_RIGHT_TYPE_BY_MECHANISM}).
 */
export function impliedConversionRightType(
  rightPath: string,
  right: Readonly<Record<string, unknown>>
): ConversionRightTypeName | undefined {
  if (/(?:^|\.)conversion_rights\[\d+\]$/.test(rightPath)) return 'STOCK_CLASS_CONVERSION_RIGHT';
  if (/(?:^|\.)conversion_triggers\[\d+\]\.conversion_right$/.test(rightPath)) return 'CONVERTIBLE_CONVERSION_RIGHT';
  if (/(?:^|\.)exercise_triggers\[\d+\]\.conversion_right$/.test(rightPath)) {
    return conversionRightTypeOfMechanism(right);
  }
  return undefined;
}

/**
 * Whether two versions of the conversion right at `rightPath` differ only in that one omits `type` and the other has
 * the type the omitted one implies ({@link impliedConversionRightType}).
 */
export function isImpliedConversionRightTypePair(
  rightPath: string,
  rightA: Readonly<Record<string, unknown>>,
  rightB: Readonly<Record<string, unknown>>
): boolean {
  const typeA = rightA.type;
  const typeB = rightB.type;
  if ((typeA === undefined) === (typeB === undefined)) return false;
  const [untyped, explicitType] = typeA === undefined ? [rightA, typeB] : [rightB, typeA];
  return impliedConversionRightType(rightPath, untyped) === explicitType;
}
