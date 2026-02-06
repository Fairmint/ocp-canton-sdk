/**
 * DAML to OCF converter for StakeholderStatusChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfStakeholderStatusChangeEvent } from '../../../types/native';
import { damlStakeholderStatusToNative } from '../../../utils/enumConversions';

/** Parameters for getting a stakeholder status change event as OCF */
export interface GetStakeholderStatusChangeEventAsOcfParams {
  /** The contract ID of the StakeholderStatusChangeEvent on the ledger */
  contractId: string;
}

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
  new_status: string;
  comments: string[];
}

interface DamlStakeholderStatusChangeEventContract {
  status_change_data: DamlStakeholderStatusChangeEventData;
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
  const res = await client.getEventsByContractId({ contractId: params.contractId });

  if (!res.created) {
    throw new OcpContractError('Missing created event', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  if (!res.created.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const contract = res.created.createdEvent.createArgument as DamlStakeholderStatusChangeEventContract;
  const data = contract.status_change_data;

  const event: OcfStakeholderStatusChangeEvent = {
    id: data.id,
    date: data.date.split('T')[0],
    stakeholder_id: data.stakeholder_id,
    new_status: damlStakeholderStatusToNative(data.new_status),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
