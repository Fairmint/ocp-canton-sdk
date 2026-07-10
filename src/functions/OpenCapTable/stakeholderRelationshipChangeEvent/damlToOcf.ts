/**
 * DAML to OCF converters for StakeholderRelationshipChangeEvent entities.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types';
import { damlStakeholderRelationshipToNative } from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';

/**
 * DAML StakeholderRelationshipChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStakeholderRelationshipChangeData = DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>;

/**
 * Convert DAML StakeholderRelationshipChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder relationship change event data object
 * @returns The native OCF StakeholderRelationshipChangeEvent object
 */
export function damlStakeholderRelationshipChangeEventToNative(
  d: DamlStakeholderRelationshipChangeData
): OcfStakeholderRelationshipChangeEvent {
  const common = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: d.id,
    date: damlTimeToDateString(d.date, 'stakeholderRelationshipChangeEvent.date'),
    stakeholder_id: d.stakeholder_id,
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  } as const;
  const relationshipStarted = d.relationship_started
    ? damlStakeholderRelationshipToNative(d.relationship_started)
    : undefined;
  const relationshipEnded = d.relationship_ended
    ? damlStakeholderRelationshipToNative(d.relationship_ended)
    : undefined;

  if (relationshipStarted) {
    return {
      ...common,
      relationship_started: relationshipStarted,
      ...(relationshipEnded ? { relationship_ended: relationshipEnded } : {}),
    };
  }
  if (relationshipEnded) return { ...common, relationship_ended: relationshipEnded };

  throw new OcpValidationError(
    'stakeholderRelationshipChangeEvent',
    'At least one relationship_started or relationship_ended value is required',
    {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d,
    }
  );
}
