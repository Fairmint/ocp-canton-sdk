import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfEquityCompensationAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * OCF Equity Compensation Acceptance event with object_type discriminator.
 */
export interface OcfEquityCompensationAcceptanceEvent extends OcfEquityCompensationAcceptance {
  object_type: 'TX_EQUITY_COMPENSATION_ACCEPTANCE';
}

export type GetEquityCompensationAcceptanceAsOcfParams = GetByContractIdParams;

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

function hasEquityCompensationAcceptanceData(arg: unknown): arg is EquityCompensationAcceptanceCreateArgument {
  const record = arg as { acceptance_data?: unknown };
  return typeof record.acceptance_data === 'object' && record.acceptance_data !== null;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationAcceptanceAsOcf',
  });
  if (!hasEquityCompensationAcceptanceData(createArgument)) {
    throw new OcpParseError('EquityCompensationAcceptance data not found in contract create argument', {
      source: 'EquityCompensationAcceptance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const contract = createArgument;
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
