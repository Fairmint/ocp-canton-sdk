import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingAcceleration } from '../../../types/native';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingAccelerationToNative, type DamlVestingAccelerationData } from './damlToOcf';

export type GetVestingAccelerationAsOcfParams = GetByContractIdParams;

export interface GetVestingAccelerationAsOcfResult {
  vestingAcceleration: OcfVestingAcceleration;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingAccelerationAsOcf',
  });

  const accelerationData = extractGeneratedCreateArgumentData(createArgument, 'VestingAcceleration.createArgument', {
    dataField: 'acceleration_data',
  });

  const native = damlVestingAccelerationToNative(accelerationData as unknown as DamlVestingAccelerationData);
  return {
    vestingAcceleration: native,
    contractId: params.contractId,
  };
}
