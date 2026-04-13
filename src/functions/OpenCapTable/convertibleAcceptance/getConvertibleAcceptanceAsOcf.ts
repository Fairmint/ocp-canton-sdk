import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfConvertibleAcceptance } from '../../../types';
import type { GetByContractIdParams } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * OCF Convertible Acceptance event with object_type discriminator.
 */
export interface OcfConvertibleAcceptanceEvent extends OcfConvertibleAcceptance {
  object_type: 'TX_CONVERTIBLE_ACCEPTANCE';
}

export type GetConvertibleAcceptanceAsOcfParams = GetByContractIdParams;

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

function hasConvertibleAcceptanceData(arg: unknown): arg is ConvertibleAcceptanceCreateArgument {
  const record = arg as { acceptance_data?: unknown };
  return typeof record.acceptance_data === 'object' && record.acceptance_data !== null;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleAcceptanceAsOcf',
  });
  if (!hasConvertibleAcceptanceData(createArgument)) {
    throw new OcpParseError('ConvertibleAcceptance data not found in contract create argument', {
      source: 'ConvertibleAcceptance.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const contract = createArgument;
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
