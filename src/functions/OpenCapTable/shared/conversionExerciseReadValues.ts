import type { DeepReadonly } from '../../../types/common';
import type {
  CapitalizationDefinition,
  NonEmptyArray,
  OcfConvertibleConversion,
  OcfEquityCompensationExercise,
  OcfStockConversion,
  OcfWarrantExercise,
} from '../../../types/native';
import {
  requireConversionExerciseText,
  requireConversionExerciseTextArray,
  requireExactConversionExerciseInput,
  requireNonEmptyConversionExerciseTextArray,
} from './conversionExerciseValues';

type OcfConversionExerciseEvent =
  | OcfConvertibleConversion
  | OcfEquityCompensationExercise
  | OcfStockConversion
  | OcfWarrantExercise;

const CAPITALIZATION_FIELDS = [
  'include_stock_class_ids',
  'include_stock_plans_ids',
  'include_security_ids',
  'exclude_security_ids',
] as const satisfies ReadonlyArray<keyof CapitalizationDefinition>;

/** Validate a required non-empty Text returned by a generated conversion/exercise decoder. */
export function requireGeneratedConversionExerciseText(value: unknown, fieldPath: string): string {
  return requireConversionExerciseText(value, fieldPath);
}

/** Decode a generated Optional Text and enforce the pinned non-empty Some invariant. */
export function generatedOptionalConversionExerciseText(value: unknown, fieldPath: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireConversionExerciseText(value, fieldPath);
}

/** Decode a generated comments list, which may be empty but may not contain empty Text values. */
export function requireGeneratedConversionExerciseComments(value: unknown, fieldPath: string): string[] {
  return requireConversionExerciseTextArray(value, fieldPath);
}

/** Decode a generated result list whose pinned contract validator requires at least one identifier. */
export function requireGeneratedConversionExerciseResultIds(value: unknown, fieldPath: string): NonEmptyArray<string> {
  return requireNonEmptyConversionExerciseTextArray(value, fieldPath);
}

/** Decode the equity-exercise result list, whose pinned contract permits zero results. */
export function requireGeneratedEquityExerciseResultIds(value: unknown, fieldPath: string): string[] {
  return requireConversionExerciseTextArray(value, fieldPath);
}

/** Decode and freeze the optional capitalization definition used by convertible conversions. */
export function generatedConversionCapitalizationDefinition(
  value: unknown,
  fieldPath: string
): CapitalizationDefinition | undefined {
  if (value === null || value === undefined) return undefined;
  const definition = requireExactConversionExerciseInput(value, fieldPath, CAPITALIZATION_FIELDS);
  return Object.freeze({
    include_stock_class_ids: Object.freeze(
      requireConversionExerciseTextArray(definition.include_stock_class_ids, `${fieldPath}.include_stock_class_ids`)
    ),
    include_stock_plans_ids: Object.freeze(
      requireConversionExerciseTextArray(definition.include_stock_plans_ids, `${fieldPath}.include_stock_plans_ids`)
    ),
    include_security_ids: Object.freeze(
      requireConversionExerciseTextArray(definition.include_security_ids, `${fieldPath}.include_security_ids`)
    ),
    exclude_security_ids: Object.freeze(
      requireConversionExerciseTextArray(definition.exclude_security_ids, `${fieldPath}.exclude_security_ids`)
    ),
  }) as unknown as CapitalizationDefinition;
}

/** Detach and deeply freeze one canonical conversion/exercise read result. */
export function freezeConversionExerciseEvent<T extends OcfConversionExerciseEvent>(event: T): DeepReadonly<T> {
  const snapshot: Record<string, unknown> = {
    ...event,
    resulting_security_ids: Object.freeze([...event.resulting_security_ids]),
  };

  if (event.comments !== undefined) snapshot.comments = Object.freeze([...event.comments]);
  if ('capitalization_definition' in event) {
    const definition = event.capitalization_definition;
    snapshot.capitalization_definition = Object.freeze({
      include_stock_class_ids: Object.freeze([...definition.include_stock_class_ids]),
      include_stock_plans_ids: Object.freeze([...definition.include_stock_plans_ids]),
      include_security_ids: Object.freeze([...definition.include_security_ids]),
      exclude_security_ids: Object.freeze([...definition.exclude_security_ids]),
    });
  }

  return Object.freeze(snapshot) as DeepReadonly<T>;
}
