import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingStart } from '../../../types/native';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingStartToNative, type DamlVestingStartData } from './damlToOcf';

export type GetVestingStartAsOcfParams = GetByContractIdParams;

export interface GetVestingStartAsOcfResult {
  vestingStart: OcfVestingStart;
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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingStartAsOcf',
  });

  const vestingData = extractGeneratedCreateArgumentData(createArgument, 'VestingStart.createArgument', {
    dataField: 'vesting_data',
  });

  const native = damlVestingStartToNative(vestingData as unknown as DamlVestingStartData);
  return {
    vestingStart: native,
    contractId: params.contractId,
  };
}
