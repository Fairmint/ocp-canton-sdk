/** DAML to OCF conversion for StakeholderRelationshipChangeEvent data. */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEventOutput } from '../../../types';
import { damlStakeholderRelationshipToNative } from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { freezeStakeholderEvent } from '../shared/stakeholderEventValues';

/** Exact generated DAML payload accepted by the relationship-event reader. */
export type DamlStakeholderRelationshipChangeData = DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>;

/** Decode generated relationship-event data and project it to canonical OCF. */
export function damlStakeholderRelationshipChangeEventToNative(
  input: DamlStakeholderRelationshipChangeData
): OcfStakeholderRelationshipChangeEventOutput {
  const path = 'stakeholderRelationshipChangeEvent';
  const data = decodeDamlEntityData('stakeholderRelationshipChangeEvent', input);
  const relationshipStarted =
    data.relationship_started === null ? undefined : damlStakeholderRelationshipToNative(data.relationship_started);
  const relationshipEnded =
    data.relationship_ended === null ? undefined : damlStakeholderRelationshipToNative(data.relationship_ended);

  const common = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: data.id,
    date: damlTimeToDateString(data.date, `${path}.date`),
    stakeholder_id: data.stakeholder_id,
    ...(data.comments.length > 0 ? { comments: [...data.comments] } : {}),
  } as const;

  if (relationshipStarted !== undefined) {
    return freezeStakeholderEvent({
      ...common,
      relationship_started: relationshipStarted,
      ...(relationshipEnded !== undefined ? { relationship_ended: relationshipEnded } : {}),
    });
  }

  if (relationshipEnded !== undefined)
    return freezeStakeholderEvent({ ...common, relationship_ended: relationshipEnded });

  throw new OcpValidationError(path, 'At least one relationship_started or relationship_ended value is required', {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType: 'relationship_started and/or relationship_ended',
    receivedValue: data,
  });
}
