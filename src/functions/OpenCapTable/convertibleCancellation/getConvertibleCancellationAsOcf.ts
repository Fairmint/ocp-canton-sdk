import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfConvertibleCancellation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlConvertibleCancellationToNative } from './damlToOcf';

/**
 * OCF Convertible Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/ConvertibleCancellation.schema.json
 *
 * Note: Convertible cancellations don't have a quantity field since convertibles are monetary instruments (SAFEs,
 * convertible notes) rather than share-based securities.
 */
export type OcfConvertibleCancellationEvent = OcfConvertibleCancellation;

export type GetConvertibleCancellationAsOcfParams = GetByContractIdParams;

export interface GetConvertibleCancellationAsOcfResult {
  readonly event: OcfConvertibleCancellationEvent;
  readonly contractId: string;
}

/**
 * Get a convertible cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The convertible cancellation event in OCF format
 */
export async function getConvertibleCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleCancellationAsOcfParams
): Promise<GetConvertibleCancellationAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getConvertibleCancellationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.convertibleCancellation,
  });
  const data = extractAndDecodeDamlEntityData('convertibleCancellation', createArgument);
  const event = damlConvertibleCancellationToNative(data as Parameters<typeof damlConvertibleCancellationToNative>[0]);
  return { event, contractId };
}
