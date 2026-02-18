/**
 * DAML to OCF converter for StakeholderRelationshipChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfStakeholderRelationshipChangeEvent, StakeholderRelationshipType } from '../../../types/native';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';

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
  relationship_started: DamlStakeholderRelationshipType | null;
  relationship_ended: DamlStakeholderRelationshipType | null;
  comments: string[];
}

interface DamlStakeholderRelationshipChangeEventContract {
  event_data?: DamlStakeholderRelationshipChangeEventData;
  relationship_change_data?: DamlStakeholderRelationshipChangeEventData;
}

function mapRelationshipsToLatestFields(
  relationshipStarted: StakeholderRelationshipType | null,
  relationshipEnded: StakeholderRelationshipType | null
): Pick<OcfStakeholderRelationshipChangeEvent, 'relationship_started' | 'relationship_ended'> {
  if (!relationshipStarted && !relationshipEnded) {
    throw new OcpContractError('Missing stakeholder relationship change data', {
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  return {
    ...(relationshipStarted ? { relationship_started: relationshipStarted } : {}),
    ...(relationshipEnded ? { relationship_ended: relationshipEnded } : {}),
  };
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

  const contract = res.created.createdEvent.createArgument as DamlStakeholderRelationshipChangeEventContract;
  const data = contract.event_data ?? contract.relationship_change_data;
  if (!data) {
    throw new OcpContractError('Missing stakeholder relationship event data', {
      contractId: params.contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const relationshipFields = mapRelationshipsToLatestFields(
    data.relationship_started ? damlStakeholderRelationshipToNative(data.relationship_started) : null,
    data.relationship_ended ? damlStakeholderRelationshipToNative(data.relationship_ended) : null
  );

  const event: OcfStakeholderRelationshipChangeEvent = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: data.id,
    date: data.date.split('T')[0],
    stakeholder_id: data.stakeholder_id,
    ...relationshipFields,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
