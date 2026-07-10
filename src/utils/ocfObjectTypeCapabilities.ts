import {
  mapOcfObjectTypeToEntityType,
  type OcfEntityType,
  type OcfReadableObjectType,
} from '../functions/OpenCapTable/capTable/batchTypes';
import { normalizeObjectType } from './planSecurityAliases';

/** OCF types that are schema-valid but have no OpenCapTable ledger entity. */
export const OCF_SCHEMA_ONLY_OBJECT_TYPES = ['FINANCING'] as const;

/** A schema-valid OCF type that is intentionally not materialized on the ledger. */
export type OcfSchemaOnlyObjectType = (typeof OCF_SCHEMA_ONLY_OBJECT_TYPES)[number];

/** Capability metadata for an OCF discriminator. */
export type OcfObjectTypeCapability =
  | Readonly<{
      support: 'ledger-backed';
      objectType: string;
      canonicalObjectType: OcfReadableObjectType;
      entityType: OcfEntityType;
    }>
  | Readonly<{
      support: 'schema-only';
      objectType: OcfSchemaOnlyObjectType;
    }>
  | Readonly<{
      support: 'unsupported';
      objectType: string;
    }>;

function isSchemaOnlyObjectType(objectType: string): objectType is OcfSchemaOnlyObjectType {
  return (OCF_SCHEMA_ONLY_OBJECT_TYPES as readonly string[]).includes(objectType);
}

/**
 * Classify an OCF discriminator without logging, throwing, or touching the network.
 *
 * Current-schema PlanSecurity wrappers are normalized to the ledger's canonical
 * EquityCompensation form. Unknown or non-schema strings remain explicitly unsupported.
 */
export function getOcfObjectTypeCapability(objectType: string): OcfObjectTypeCapability {
  if (isSchemaOnlyObjectType(objectType)) {
    return { support: 'schema-only', objectType };
  }

  const canonicalObjectType = normalizeObjectType(objectType);
  const entityType = mapOcfObjectTypeToEntityType(canonicalObjectType);
  if (entityType === null) {
    return { support: 'unsupported', objectType };
  }

  return {
    support: 'ledger-backed',
    objectType,
    canonicalObjectType: canonicalObjectType as OcfReadableObjectType,
    entityType,
  };
}
