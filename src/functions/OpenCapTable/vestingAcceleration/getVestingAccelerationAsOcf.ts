import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingAcceleration } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingAccelerationToNative } from './damlToOcf';

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
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.vestingAcceleration,
  });
  const data = extractAndDecodeDamlEntityData('vestingAcceleration', createArgument);
  const native = damlVestingAccelerationToNative(data);
  return {
    vestingAcceleration: native,
    contractId: params.contractId,
  };
}
