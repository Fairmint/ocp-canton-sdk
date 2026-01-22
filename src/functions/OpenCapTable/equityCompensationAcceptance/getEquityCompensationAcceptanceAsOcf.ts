import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { OcfEquityCompensationAcceptance } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * OCF Equity Compensation Acceptance event with object_type discriminator.
 */
export interface OcfEquityCompensationAcceptanceEvent extends OcfEquityCompensationAcceptance {
  object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE';
}

export interface GetEquityCompensationAcceptanceAsOcfParams {
  contractId: string;
}

export interface GetEquityCompensationAcceptanceAsOcfResult {
  event: OcfEquityCompensationAcceptanceEvent;
  contractId: string;
}

/**
 * DAML EquityCompensationAcceptance contract createArgument structure.
 */
interface EquityCompensationAcceptanceCreateArgument {
  acceptance_data: {
    id: string;
    date: string;
    security_id: string;
    comments: string[];
  };
}

/**
 * Retrieve an Equity Compensation Acceptance contract and convert to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contractId
 * @returns The OCF-formatted equity compensation acceptance event
 */
export async function getEquityCompensationAcceptanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationAcceptanceAsOcfParams
): Promise<GetEquityCompensationAcceptanceAsOcfResult> {
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

  const contract = res.created.createdEvent.createArgument as EquityCompensationAcceptanceCreateArgument;
  const data = contract.acceptance_data;

  const event: OcfEquityCompensationAcceptanceEvent = {
    object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    id: data.id,
    date: damlTimeToDateString(data.date),
    security_id: data.security_id,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
