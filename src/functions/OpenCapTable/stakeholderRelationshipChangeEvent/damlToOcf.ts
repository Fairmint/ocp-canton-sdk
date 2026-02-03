/**
 * DAML to OCF converters for StakeholderRelationshipChangeEvent entities.
 */

import type { OcfStakeholderRelationshipChangeEvent } from '../../../types';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML StakeholderRelationshipChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlStakeholderRelationshipChangeData {
  id: string;
  date: string;
  stakeholder_id: string;
  new_relationships: string[];
  comments: string[];
}

/**
 * Convert DAML StakeholderRelationshipChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder relationship change event data object
 * @returns The native OCF StakeholderRelationshipChangeEvent object
 */
export function damlStakeholderRelationshipChangeEventToNative(
  d: DamlStakeholderRelationshipChangeData
): OcfStakeholderRelationshipChangeEvent {
  return {
    id: d.id,
    date: damlTimeToDateString(d.date),
    stakeholder_id: d.stakeholder_id,
    new_relationships: d.new_relationships.map((rel) =>
      damlStakeholderRelationshipToNative(rel as DamlStakeholderRelationshipType)
    ),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
