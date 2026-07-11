import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfEquityCompensationCancellation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlEquityCompensationCancellationToNative } from './damlToOcf';

/**
 * OCF Equity Compensation Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/EquityCompensationCancellation.schema.json
 */
export type OcfEquityCompensationCancellationEvent = OcfEquityCompensationCancellation;

export type GetEquityCompensationCancellationAsOcfParams = GetByContractIdParams;

export interface GetEquityCompensationCancellationAsOcfResult {
  event: OcfEquityCompensationCancellationEvent;
  contractId: string;
}

/**
 * Get an equity compensation cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The equity compensation cancellation event in OCF format
 */
export async function getEquityCompensationCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationCancellationAsOcfParams
): Promise<GetEquityCompensationCancellationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationCancellationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationCancellation,
  });
  const data = extractAndDecodeDamlEntityData('equityCompensationCancellation', createArgument);
  const event = damlEquityCompensationCancellationToNative(data);
  return { event, contractId: params.contractId };
}
