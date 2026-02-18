import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
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
    throw new OcpContractError('No createArgument found for contract', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasVestingAccelerationData(arg: unknown): arg is {
    acceleration_data?: DamlVestingAccelerationData;
    vesting_acceleration_data?: DamlVestingAccelerationData;
  } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      ((record.acceleration_data !== null && typeof record.acceleration_data === 'object') ||
        (record.vesting_acceleration_data !== null && typeof record.vesting_acceleration_data === 'object'))
    );
  }

  if (!hasVestingAccelerationData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for VestingAcceleration', {
      source: 'VestingAcceleration.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const accelerationData = createArgument.acceleration_data ?? createArgument.vesting_acceleration_data;
  if (!accelerationData || typeof accelerationData !== 'object') {
    throw new OcpParseError('Unexpected createArgument shape for VestingAcceleration', {
      source: 'VestingAcceleration.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlVestingAccelerationToNative(accelerationData);
  return {
    vestingAcceleration: {
      object_type: 'TX_VESTING_ACCELERATION' as const,
      ...native,
    },
    contractId: params.contractId,
  };
}
