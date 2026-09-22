import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingEvent } from '../../../types/native';
import { extractGeneratedCreateArgumentData } from '../../../utils/generatedDamlValidation';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingEventToNative, type DamlVestingEventData } from './damlToOcf';

export type GetVestingEventAsOcfParams = GetByContractIdParams;

export interface GetVestingEventAsOcfResult {
  vestingEvent: OcfVestingEvent;
  contractId: string;
}

/**
 * Retrieve a vesting event transaction contract and return it as an OCF JSON object.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The vesting event data in OCF format along with the contract ID
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/vesting/VestingEvent.schema.json
 */
export async function getVestingEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetVestingEventAsOcfParams
): Promise<GetVestingEventAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingEventAsOcf',
  });

  const vestingData = extractGeneratedCreateArgumentData(createArgument, 'VestingEvent.createArgument', {
    dataField: 'vesting_data',
  });

  const native = damlVestingEventToNative(
    vestingData as unknown as DamlVestingEventData,
    'VestingEvent.createArgument.vesting_data'
  );
  return {
    vestingEvent: native,
    contractId: params.contractId,
  };
}
