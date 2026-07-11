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

type OcfLedgerBackedCapability<ObjectType extends OcfLedgerBackedObjectType> =
  ObjectType extends OcfLedgerBackedObjectType
    ? Readonly<{
        support: 'ledger-backed';
        objectType: ObjectType;
        canonicalObjectType: CanonicalReadableObjectType<ObjectType>;
        entityType: OcfEntityTypeForObjectType<CanonicalReadableObjectType<ObjectType>>;
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
    : [Extract<KnownOcfObjectType, ObjectType>] extends [never]
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
