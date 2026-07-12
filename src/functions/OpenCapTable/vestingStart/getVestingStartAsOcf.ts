import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingStart } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingStartToNative } from './damlToOcf';

export type GetVestingStartAsOcfParams = GetByContractIdParams;

export interface GetVestingStartAsOcfResult {
  readonly event: OcfVestingStart;
  readonly contractId: string;
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
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingStartAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.vestingStart,
  });
  const vestingData = extractAndDecodeDamlEntityData('vestingStart', createArgument);
  const event = damlVestingStartToNative(vestingData);
  return { event, contractId };
}
