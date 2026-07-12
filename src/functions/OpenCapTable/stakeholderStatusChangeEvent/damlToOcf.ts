/** DAML to OCF conversion for StakeholderStatusChangeEvent data. */

import type { OcfStakeholderStatusChangeEvent } from '../../../types';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';

/** Exact generated DAML payload accepted by the status-event reader. */
export type DamlStakeholderStatusChangeData = DamlDataTypeFor<'stakeholderStatusChangeEvent'>;

/** Decode generated status-event data and project it to canonical OCF. */
export function damlStakeholderStatusChangeEventToNative(
  input: DamlStakeholderStatusChangeData
): OcfStakeholderStatusChangeEvent {
  const path = 'stakeholderStatusChangeEvent';
  const data = decodeDamlEntityData('stakeholderStatusChangeEvent', input);
  return {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id: data.id,
    date: damlTimeToDateString(data.date, `${path}.date`),
    stakeholder_id: data.stakeholder_id,
    new_status: damlStakeholderStatusToNative(data.new_status, `${path}.new_status`),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
