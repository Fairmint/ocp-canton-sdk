/**
 * Decode one OCF record's `ocf_data` through its generated codec.
 *
 * Kept apart from the `damlToOcf` dispatcher so that the register's readers can decode a payload without loading the
 * single-contract read path the dispatcher depends on.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { decodeGeneratedDaml, requireGeneratedRecord } from '../../../utils/generatedDamlValidation';
import { isRecord } from '../../../utils/typeConversions';
import { damlOptionalStakeholderRelationshipToNative } from '../stakeholderRelationshipChangeEvent/damlToOcf';
import {
  ENTITY_REGISTRY,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
  type DamlRecordDataFor,
  type OcfEntityType,
} from './batchTypes';

/** Decode unknown ledger JSON into the exact generated DAML payload for an entity kind. */
export function decodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  input: unknown
): DamlDataTypeFor<EntityType>;
export function decodeDamlEntityData(entityType: OcfEntityType, input: unknown): DamlDataTypeFor<OcfEntityType> {
  const { recordTag } = ENTITY_REGISTRY[entityType];
  const { OcfRecordData } = Fairmint.OpenCapTable.OcfRecords;
  const rootPath = `damlToOcf.${entityType}`;
  if (entityType === 'stakeholderRelationshipChangeEvent') {
    const relationship = requireGeneratedRecord(input, rootPath);
    for (const field of ['relationship_started', 'relationship_ended'] as const) {
      damlOptionalStakeholderRelationshipToNative(relationship[field], `${rootPath}.${field}`);
    }
  }
  // The register addresses every OCF record through the generated `OcfRecordData` variant; decoding the payload as the
  // variant for this entity kind uses the generated codec of exactly that record.
  return decodeGeneratedDaml(
    input,
    {
      decode: (value) => {
        const record = OcfRecordData.decoder.runWithException({ tag: recordTag, value });
        if (record.tag !== recordTag) {
          throw new OcpParseError(`Decoded record tag ${record.tag} does not match ${recordTag}`, {
            source: rootPath,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
          });
        }
        return record.value;
      },
      // The variant is rebuilt from the same entity tag; the union of payloads cannot be correlated with it by type.
      encode: (value) => {
        const encoded = OcfRecordData.encode({ tag: recordTag, value } as DamlRecordDataFor<OcfEntityType>);
        return isRecord(encoded) ? encoded.value : encoded;
      },
    },
    rootPath,
    { context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] } }
  );
}
