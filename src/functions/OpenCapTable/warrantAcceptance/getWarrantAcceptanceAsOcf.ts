import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfWarrantAcceptance } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * OCF Warrant Acceptance event with object_type discriminator.
 */
export interface OcfWarrantAcceptanceEvent extends OcfWarrantAcceptance {
  object_type: 'TX_WARRANT_ACCEPTANCE';
}

export interface GetWarrantAcceptanceAsOcfParams {
  contractId: string;
}

export interface GetWarrantAcceptanceAsOcfResult {
  event: OcfWarrantAcceptanceEvent;
  contractId: string;
}

/**
 * DAML WarrantAcceptance contract createArgument structure.
 */
interface WarrantAcceptanceCreateArgument {
  acceptance_data: {
    id: string;
    date: string;
    security_id: string;
    comments: string[];
  };
}

/**
 * Retrieve a Warrant Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted warrant acceptance event
 */
export async function getWarrantAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantAcceptanceAsOcfParams
): Promise<GetWarrantAcceptanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created) {
    throw new Error('Missing created event');
  }
  if (!res.created.createdEvent.createArgument) {
    throw new Error('Missing createArgument');
  }

  const contract = res.created.createdEvent.createArgument as WarrantAcceptanceCreateArgument;
  const data = contract.acceptance_data;

  const event: OcfWarrantAcceptanceEvent = {
    object_type: 'TX_WARRANT_ACCEPTANCE',
    id: data.id,
    date: damlTimeToDateString(data.date),
    security_id: data.security_id,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
