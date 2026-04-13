/**
 * DAML to OCF converter for StakeholderRelationshipChangeEvent.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStakeholderRelationshipChangeEvent, StakeholderRelationshipType } from '../../../types/native';
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';
import { isRecord } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/** Parameters for getting a stakeholder relationship change event as OCF */
export type GetStakeholderRelationshipChangeEventAsOcfParams = GetByContractIdParams;

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
  relationshipEnded: StakeholderRelationshipType | null,
  contractId: string
): Pick<OcfStakeholderRelationshipChangeEvent, 'relationship_started' | 'relationship_ended'> {
  if (!relationshipStarted && !relationshipEnded) {
    throw new OcpContractError('Missing stakeholder relationship change data', {
      contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  return {
    ...(relationshipStarted ? { relationship_started: relationshipStarted } : {}),
    ...(relationshipEnded ? { relationship_ended: relationshipEnded } : {}),
  };
}

function isDamlStakeholderRelationshipChangeEventData(
  value: unknown
): value is DamlStakeholderRelationshipChangeEventData {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.stakeholder_id === 'string' &&
    (typeof value.relationship_started === 'string' || value.relationship_started === null) &&
    (typeof value.relationship_ended === 'string' || value.relationship_ended === null) &&
    Array.isArray(value.comments) &&
    value.comments.every((comment) => typeof comment === 'string')
  );
}

function isDamlStakeholderRelationshipChangeEventContract(
  value: unknown
): value is DamlStakeholderRelationshipChangeEventContract {
  if (!isRecord(value)) return false;

  const eventData = value.event_data;
  const relationshipChangeData = value.relationship_change_data;

  if (eventData !== undefined && !isDamlStakeholderRelationshipChangeEventData(eventData)) {
    return false;
  }
  if (relationshipChangeData !== undefined && !isDamlStakeholderRelationshipChangeEventData(relationshipChangeData)) {
    return false;
  }

  return eventData !== undefined || relationshipChangeData !== undefined;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStakeholderRelationshipChangeEventAsOcf',
  });
  if (!isDamlStakeholderRelationshipChangeEventContract(createArgument)) {
    throw new OcpContractError('Invalid stakeholder relationship event contract payload', {
      contractId: params.contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const contract: DamlStakeholderRelationshipChangeEventContract = createArgument;
  const data: DamlStakeholderRelationshipChangeEventData | undefined =
    contract.event_data ?? contract.relationship_change_data;
  if (data === undefined) {
    throw new OcpContractError('Missing stakeholder relationship event data', {
      contractId: params.contractId,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }

  const relationshipFields = mapRelationshipsToLatestFields(
    data.relationship_started ? damlStakeholderRelationshipToNative(data.relationship_started) : null,
    data.relationship_ended ? damlStakeholderRelationshipToNative(data.relationship_ended) : null,
    params.contractId
  );

  const event: OcfStakeholderRelationshipChangeEvent = {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: data.id,
    date: data.date.split('T')[0],
    stakeholder_id: data.stakeholder_id,
    ...relationshipFields,
    ...(data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
