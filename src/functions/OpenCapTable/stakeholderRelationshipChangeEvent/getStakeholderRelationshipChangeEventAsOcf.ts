/**
 * DAML to OCF converter for StakeholderRelationshipChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfStakeholderRelationshipChangeEvent } from '../../../types/native';
import { damlStakeholderRelationshipToNative } from '../../../utils/enumConversions';

/** Parameters for getting a stakeholder relationship change event as OCF */
export interface GetStakeholderRelationshipChangeEventAsOcfParams {
  /** The contract ID of the StakeholderRelationshipChangeEvent on the ledger */
  contractId: string;
}

/** Result of getting a stakeholder relationship change event as OCF */
export interface GetStakeholderRelationshipChangeEventAsOcfResult {
  /** The OCF-formatted stakeholder relationship change event */
  event: OcfStakeholderRelationshipChangeEvent;
  /** The contract ID */
  contractId: string;
}

/** Type for DAML StakeholderRelationshipChangeEvent createArgument */
interface DamlStakeholderRelationshipChangeEventData {
  id: string;
  date: string;
  stakeholder_id: string;
  new_relationships: string[];
  comments: string[];
}

interface DamlStakeholderRelationshipChangeEventContract {
  relationship_change_data: DamlStakeholderRelationshipChangeEventData;
}

/**
 * Read a StakeholderRelationshipChangeEvent contract from the ledger and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient for ledger access
 * @param params - Parameters including the contract ID
 * @returns The OCF-formatted event and contract ID
 */
export async function getStakeholderRelationshipChangeEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStakeholderRelationshipChangeEventAsOcfParams
): Promise<GetStakeholderRelationshipChangeEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });

  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }

  const contract = res.created.createdEvent.createArgument as DamlStakeholderRelationshipChangeEventContract;
  const data = contract.relationship_change_data;

  const event: OcfStakeholderRelationshipChangeEvent = {
    id: data.id,
    date: data.date.split('T')[0],
    stakeholder_id: data.stakeholder_id,
    new_relationships: data.new_relationships.map(damlStakeholderRelationshipToNative),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
