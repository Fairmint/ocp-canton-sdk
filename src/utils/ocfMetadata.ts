import { ENTITY_REGISTRY, OCF_DATA_FIELD } from '../functions/OpenCapTable/capTable/batchTypes';
import type { OcfEntityDataMap, OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';

/** OCF object types covered by the template-metadata registry: every entity kind in the entity registry. */
export type OcfMetadataObjectType = OcfEntityDataMap[OcfEntityType]['object_type'];

/** Metadata about each OCF object type including template IDs and data paths */
interface OcfTypeMetadata {
  /** DAML template ID */
  templateId: string;
  /** Path to extract the OCF ID from a created contract's arguments */
  ocfIdPath: readonly [dataFieldName: string, ...remainingPath: string[]];
}

function buildOcfMetadata(): Record<OcfMetadataObjectType, OcfTypeMetadata> {
  const entries = Object.values(ENTITY_REGISTRY).map((entry): [OcfMetadataObjectType, OcfTypeMetadata] => [
    entry.objectType,
    { templateId: entry.templateId, ocfIdPath: [OCF_DATA_FIELD, 'id'] },
  ]);
  return Object.fromEntries(entries) as Record<OcfMetadataObjectType, OcfTypeMetadata>;
}

/**
 * Central registry of OCF type metadata. Maps each OCF object type to its DAML template ID and OCF ID extraction path,
 * derived from the entity registry so the two cannot drift. Every v35 OCF template keeps its record in `ocf_data`.
 */
export const OCF_METADATA: Record<OcfMetadataObjectType, OcfTypeMetadata> = buildOcfMetadata();

/** Get metadata for a specific OCF object type */
export function getOcfMetadata(type: OcfMetadataObjectType): OcfTypeMetadata {
  return OCF_METADATA[type];
}

/** Get all supported OCF object types */
export function getAllOcfTypes(): OcfMetadataObjectType[] {
  return Object.keys(OCF_METADATA) as OcfMetadataObjectType[];
}

/** Check if a given string is a valid OCF object type */
export function isValidOcfType(type: string): type is OcfMetadataObjectType {
  return type in OCF_METADATA;
}
