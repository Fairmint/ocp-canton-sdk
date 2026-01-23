import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfVestingStart } from '../../../types/native';
import { damlVestingStartToNative, type DamlVestingStartData } from './damlToOcf';

export interface GetVestingStartAsOcfParams {
  contractId: string;
}

export interface GetVestingStartAsOcfResult {
  vestingStart: OcfVestingStart & { object_type: 'TX_VESTING_START' };
  contractId: string;
}

/**
 * Retrieve a vesting start transaction contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The vesting start data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/vesting/VestingStart.schema.json
 */
export async function getVestingStartAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingStartAsOcfParams
): Promise<GetVestingStartAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('No createArgument found for contract', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasVestingStartData(arg: unknown): arg is { vesting_start_data: DamlVestingStartData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'vesting_start_data' in record &&
      typeof record.vesting_start_data === 'object'
    );
  }

  if (!hasVestingStartData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for VestingStart', {
      source: 'VestingStart.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlVestingStartToNative(createArgument.vesting_start_data);
  return {
    vestingStart: {
      object_type: 'TX_VESTING_START' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
