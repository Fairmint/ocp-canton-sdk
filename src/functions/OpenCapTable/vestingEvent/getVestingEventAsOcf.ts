import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfVestingEvent } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlVestingEventToNative } from './damlToOcf';

export type GetVestingEventAsOcfParams = GetByContractIdParams;

export interface GetVestingEventAsOcfResult {
  readonly event: OcfVestingEvent;
  readonly contractId: string;
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
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getVestingEventAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.vestingEvent,
  });
  const vestingData = extractAndDecodeDamlEntityData('vestingEvent', createArgument);
  const event = damlVestingEventToNative(vestingData);
  return { event, contractId };
}
