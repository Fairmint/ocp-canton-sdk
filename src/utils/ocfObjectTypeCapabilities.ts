import {
  isOcfReadableObjectType,
  mapOcfObjectTypeToEntityType,
  type OcfEntityTypeForObjectType,
  type OcfReadableObjectType,
} from '../functions/OpenCapTable/capTable/batchTypes';
import { normalizeObjectType, type NormalizedObjectType, type PlanSecurityObjectType } from './planSecurityAliases';

/** OCF types that are schema-valid but have no OpenCapTable ledger entity. */
export const OCF_SCHEMA_ONLY_OBJECT_TYPES = Object.freeze(['FINANCING'] as const);

/** A schema-valid OCF type that is intentionally not materialized on the ledger. */
export type OcfSchemaOnlyObjectType = (typeof OCF_SCHEMA_ONLY_OBJECT_TYPES)[number];

type CanonicalReadableObjectType<ObjectType extends string> = Extract<
  NormalizedObjectType<ObjectType>,
  OcfReadableObjectType
>;
type OcfLedgerBackedObjectType = OcfReadableObjectType | PlanSecurityObjectType;
type KnownOcfObjectType = OcfLedgerBackedObjectType | OcfSchemaOnlyObjectType;

/** Recover the unrefined known literal represented by an exact branded discriminator. */
type UnderlyingOcfLedgerBackedObjectType<ObjectType extends OcfLedgerBackedObjectType> = {
  [KnownObjectType in OcfLedgerBackedObjectType]: ObjectType extends KnownObjectType ? KnownObjectType : never;
}[OcfLedgerBackedObjectType];

type IsMutuallyAssignable<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

/**
 * Widen opaque string refinements inside a template while retaining its fixed text.
 *
 * TypeScript exposes a whole opaque interpolation as `${Opaque}`: inferring its
 * inner value yields `Opaque`, but the two representations are not mutually
 * assignable. Walking one fixed character at a time lets us replace just that
 * interpolation with `string`. Intrinsic transforms over an opaque string (for
 * example `Uppercase<Opaque>`) cannot be split and therefore conservatively
 * widen to `string` as well. The bounded walk also keeps unusually long string
 * literals from exceeding TypeScript's instantiation depth; any remaining tail
 * widens conservatively.
 */
type WidenOpaqueTemplate<ObjectType extends string, Depth extends readonly unknown[] = []> = Depth['length'] extends 32
  ? string
  : string extends ObjectType
    ? string
    : ObjectType extends ''
      ? ''
      : ObjectType extends `${infer Head}${infer Tail}`
        ? `${Head extends `${infer Inner}`
            ? IsMutuallyAssignable<Head, Inner> extends true
              ? Head
              : string
            : string}${WidenOpaqueTemplate<Tail, [...Depth, unknown]>}`
        : string;

type OcfLedgerBackedCapability<ObjectType extends OcfLedgerBackedObjectType> =
  ObjectType extends OcfLedgerBackedObjectType
    ? Readonly<{
        support: 'ledger-backed';
        objectType: ObjectType;
        canonicalObjectType: CanonicalReadableObjectType<UnderlyingOcfLedgerBackedObjectType<ObjectType>>;
        entityType: OcfEntityTypeForObjectType<
          CanonicalReadableObjectType<UnderlyingOcfLedgerBackedObjectType<ObjectType>>
        >;
      }>
    : never;

/** Capability metadata with canonical OCF types correlated to exact SDK entity types. */
export type OcfObjectTypeCapability =
  | OcfLedgerBackedCapability<OcfLedgerBackedObjectType>
  | Readonly<{
      support: 'schema-only';
      objectType: OcfSchemaOnlyObjectType;
    }>
  | Readonly<{
      support: 'unsupported';
      objectType: string;
    }>;

/** Capability result correlated to a literal OCF discriminator. */
export type OcfObjectTypeCapabilityFor<ObjectType extends string> = ObjectType extends KnownOcfObjectType
  ? ObjectType extends OcfSchemaOnlyObjectType
    ? Readonly<{ support: 'schema-only'; objectType: ObjectType }>
    : OcfLedgerBackedCapability<Extract<ObjectType, OcfLedgerBackedObjectType>>
  : string extends ObjectType
    ? OcfObjectTypeCapability
    : [Extract<KnownOcfObjectType, WidenOpaqueTemplate<ObjectType>>] extends [never]
      ? Readonly<{ support: 'unsupported'; objectType: ObjectType }>
      : OcfObjectTypeCapability;

function isSchemaOnlyObjectType(objectType: string): objectType is OcfSchemaOnlyObjectType {
  return (OCF_SCHEMA_ONLY_OBJECT_TYPES as readonly string[]).includes(objectType);
}

/**
 * Classify an OCF discriminator without logging, throwing, or touching the network.
 *
 * Current-schema PlanSecurity wrappers are normalized to the ledger's canonical
 * EquityCompensation form. Unknown or non-schema strings remain explicitly unsupported.
 */
export function getOcfObjectTypeCapability<const ObjectType extends string>(
  objectType: ObjectType
): OcfObjectTypeCapabilityFor<ObjectType>;
export function getOcfObjectTypeCapability(objectType: string): OcfObjectTypeCapability {
  if (isSchemaOnlyObjectType(objectType)) {
    return { support: 'schema-only', objectType };
  }

  const canonicalObjectType = normalizeObjectType(objectType);
  if (!isOcfReadableObjectType(canonicalObjectType)) {
    return { support: 'unsupported', objectType };
  }
  const entityType = mapOcfObjectTypeToEntityType(canonicalObjectType);

  return {
    support: 'ledger-backed',
    objectType,
    canonicalObjectType,
    entityType,
  } as OcfObjectTypeCapability;
}
