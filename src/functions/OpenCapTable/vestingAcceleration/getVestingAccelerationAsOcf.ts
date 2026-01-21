import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { OcfVestingAcceleration } from '../../../types/native';
import { damlVestingAccelerationToNative, type DamlVestingAccelerationData } from './damlToOcf';

export interface GetVestingAccelerationAsOcfParams {
  contractId: string;
}

export interface GetVestingAccelerationAsOcfResult {
  vestingAcceleration: OcfVestingAcceleration & { object_type: 'TX_VESTING_ACCELERATION' };
  contractId: string;
}

/**
 * Retrieve a vesting acceleration transaction contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The vesting acceleration data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/vesting/VestingAcceleration.schema.json
 */
export async function getVestingAccelerationAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingAccelerationAsOcfParams
): Promise<GetVestingAccelerationAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('No createArgument found for contract');
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasVestingAccelerationData(arg: unknown): arg is { vesting_acceleration_data: DamlVestingAccelerationData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'vesting_acceleration_data' in record &&
      typeof record.vesting_acceleration_data === 'object'
    );
  }

  if (!hasVestingAccelerationData(createArgument)) {
    throw new Error('Unexpected createArgument shape for VestingAcceleration');
  }

  const native = damlVestingAccelerationToNative(createArgument.vesting_acceleration_data);
  return {
    vestingAcceleration: {
      object_type: 'TX_VESTING_ACCELERATION' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
