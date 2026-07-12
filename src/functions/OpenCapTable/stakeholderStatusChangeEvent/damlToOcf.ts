/**
 * DAML to OCF converters for StakeholderStatusChangeEvent entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStakeholderStatusChangeEvent } from '../../../types';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import {
  assertSafeGeneratedDamlJson,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML StakeholderStatusChangeEvent data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlStakeholderStatusChangeData =
  Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData;

/**
 * Convert DAML StakeholderStatusChangeEvent data to native OCF format.
 *
 * @param d - The DAML stakeholder status change event data object
 * @returns The native OCF StakeholderStatusChangeEvent object
 * @throws OcpParseError if the status is unknown
 */
export function damlStakeholderStatusChangeEventToNative(
  d: DamlStakeholderStatusChangeData,
  source = 'stakeholderStatusChangeEvent'
): OcfStakeholderStatusChangeEvent {
  assertSafeGeneratedDamlJson(d, source);
  const data = requireGeneratedRecord(d, source);
  rejectUnknownGeneratedFields(data, source, ['id', 'date', 'stakeholder_id', 'new_status', 'comments']);
  const id = requireGeneratedString(data.id, `${source}.id`);
  const date = requireGeneratedString(data.date, `${source}.date`);
  const stakeholderId = requireGeneratedString(data.stakeholder_id, `${source}.stakeholder_id`);
  const newStatus = requireGeneratedString(data.new_status, `${source}.new_status`);
  const comments = requireGeneratedStringArray(data.comments, `${source}.comments`);

  return {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id,
    date: damlTimeToDateString(date, `${source}.date`),
    stakeholder_id: stakeholderId,
    new_status: damlStakeholderStatusToNative(
      newStatus as Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType,
      `${source}.new_status`
    ),
    ...(comments.length > 0 ? { comments } : {}),
  };
}
