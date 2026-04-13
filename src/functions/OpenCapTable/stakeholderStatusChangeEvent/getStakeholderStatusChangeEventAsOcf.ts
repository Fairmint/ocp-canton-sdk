/**
 * DAML to OCF converter for StakeholderStatusChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';
import { isRecord } from '../../../utils/typeConversions';
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
  date: string;
  stakeholder_id: string;
  new_status: Fairmint.OpenCapTable.OCF.Stakeholder.OcfStakeholderStatusType;
  comments: string[];
}

interface DamlStakeholderStatusChangeEventContract {
  event_data?: DamlStakeholderStatusChangeEventData;
  status_change_data?: DamlStakeholderStatusChangeEventData;
}

function isDamlStakeholderStatusChangeEventData(value: unknown): value is DamlStakeholderStatusChangeEventData {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.stakeholder_id === 'string' &&
    typeof value.new_status === 'string' &&
    Array.isArray(value.comments) &&
    value.comments.every((comment) => typeof comment === 'string')
  );
}

function isDamlStakeholderStatusChangeEventContract(value: unknown): value is DamlStakeholderStatusChangeEventContract {
  if (!isRecord(value)) return false;

  const eventData = value.event_data;
  const statusChangeData = value.status_change_data;

  if (eventData !== undefined && !isDamlStakeholderStatusChangeEventData(eventData)) {
    return false;
  }
  if (statusChangeData !== undefined && !isDamlStakeholderStatusChangeEventData(statusChangeData)) {
    return false;
  }

  return eventData !== undefined || statusChangeData !== undefined;
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
  if (!isDamlStakeholderStatusChangeEventContract(createArgument)) {
    throw new OcpContractError('Invalid stakeholder status event contract payload', {
      contractId: params.contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const contract: DamlStakeholderStatusChangeEventContract = createArgument;
  const data: DamlStakeholderStatusChangeEventData | undefined = contract.event_data ?? contract.status_change_data;
  if (data === undefined) {
    throw new OcpContractError('Missing stakeholder status event data', {
      contractId: params.contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const event: OcfStakeholderStatusChangeEvent = {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id: data.id,
    date: data.date.split('T')[0],
    stakeholder_id: data.stakeholder_id,
    new_status: damlStakeholderStatusToNative(data.new_status),
    ...(data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
