import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfWarrantAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { damlDateToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * OCF Warrant Acceptance event with object_type discriminator.
 */
export interface OcfWarrantAcceptanceEvent extends OcfWarrantAcceptance {
  object_type: 'TX_WARRANT_ACCEPTANCE';
}

export type GetWarrantAcceptanceAsOcfParams = GetByContractIdParams;

export interface GetWarrantAcceptanceAsOcfResult {
  event: OcfWarrantAcceptanceEvent;
  contractId: string;
}

/**
 * DAML WarrantAcceptance contract createArgument structure.
 */
interface WarrantAcceptanceCreateArgument {
  ocf_data: {
    id: string;
    date: string;
    security_id: string;
    comments: string[];
  };
}

function hasWarrantAcceptanceData(arg: unknown): arg is WarrantAcceptanceCreateArgument {
  const record = arg as { ocf_data?: unknown };
  return typeof record.ocf_data === 'object' && record.ocf_data !== null;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantAcceptanceAsOcf',
  });
  if (!hasWarrantAcceptanceData(createArgument)) {
    throw new OcpParseError('WarrantAcceptance data not found in contract create argument', {
      source: 'WarrantAcceptance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const contract = createArgument;
  const data = contract.ocf_data;

  const event: OcfWarrantAcceptanceEvent = {
    object_type: 'TX_WARRANT_ACCEPTANCE',
    id: data.id,
    date: damlDateToDateString(data.date, 'warrantAcceptance.date'),
    security_id: data.security_id,
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };

  return { event, contractId: params.contractId };
}
