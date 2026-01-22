import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfConvertibleAcceptance } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * OCF Convertible Acceptance event with object_type discriminator.
 */
export interface OcfConvertibleAcceptanceEvent extends OcfConvertibleAcceptance {
  object_type: 'TX_CONVERTIBLE_ACCEPTANCE';
}

export interface GetConvertibleAcceptanceAsOcfParams {
  contractId: string;
}

export interface GetConvertibleAcceptanceAsOcfResult {
  event: OcfConvertibleAcceptanceEvent;
  contractId: string;
}

/**
 * DAML ConvertibleAcceptance contract createArgument structure.
 */
interface ConvertibleAcceptanceCreateArgument {
  acceptance_data: {
    id: string;
    date: string;
    security_id: string;
    comments: string[];
  };
}

/**
 * Retrieve a Convertible Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted convertible acceptance event
 */
export async function getConvertibleAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleAcceptanceAsOcfParams
): Promise<GetConvertibleAcceptanceAsOcfResult> {
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

  const contract = res.created.createdEvent.createArgument as ConvertibleAcceptanceCreateArgument;
  const data = contract.acceptance_data;

  const event: OcfConvertibleAcceptanceEvent = {
    object_type: 'TX_CONVERTIBLE_ACCEPTANCE',
    id: data.id,
    date: damlTimeToDateString(data.date),
    security_id: data.security_id,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
