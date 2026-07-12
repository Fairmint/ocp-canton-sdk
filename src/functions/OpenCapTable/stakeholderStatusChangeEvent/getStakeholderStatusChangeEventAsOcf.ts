/**
 * DAML to OCF converter for StakeholderStatusChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/** Parameters for getting a stakeholder status change event as OCF */
export type GetStakeholderStatusChangeEventAsOcfParams = GetByContractIdParams;

/** Result of getting a stakeholder status change event as OCF */
export interface GetStakeholderStatusChangeEventAsOcfResult {
  /** The OCF-formatted stakeholder status change event */
  event: OcfStakeholderStatusChangeEvent;
  /** The contract ID */
  contractId: string;
}

/** Type for DAML StakeholderStatusChangeEvent createArgument */
interface DamlStakeholderStatusChangeEventData {
  id: string;
  date?: unknown;
  stakeholder_id: string;
  new_status: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType;
  comments: string[];
}

/**
 * Read a StakeholderStatusChangeEvent contract from the ledger and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient for ledger access
 * @param params - Parameters including the contract ID
 * @returns The OCF-formatted event and contract ID
 */
export async function getStakeholderStatusChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderStatusChangeEventAsOcfParams
): Promise<GetStakeholderStatusChangeEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderStatusChangeEventAsOcf',
  });
  const data = extractGeneratedCreateArgumentData(createArgument, 'StakeholderStatusChangeEvent.createArgument', {
    dataField: 'event_data',
  }) as unknown as DamlStakeholderStatusChangeEventData;

  const event: OcfStakeholderStatusChangeEvent = {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stakeholderStatusChangeEvent.date'),
    stakeholder_id: data.stakeholder_id,
    new_status: damlStakeholderStatusToNative(data.new_status),
    ...(data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
