import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfWarrantCancellation } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeCancellationData } from '../shared/cancellationReader';
import { readSingleContract } from '../shared/singleContractRead';
import { damlWarrantCancellationToNative } from './damlToOcf';

/**
 * OCF Warrant Cancellation Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/cancellation/WarrantCancellation.schema.json
 */
export type OcfWarrantCancellationEvent = OcfWarrantCancellation;

export type GetWarrantCancellationAsOcfParams = GetByContractIdParams;

export interface GetWarrantCancellationAsOcfResult {
  event: OcfWarrantCancellationEvent;
  contractId: string;
}

/**
 * Get a warrant cancellation contract and convert it to OCF format.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param params - Parameters containing the contract ID
 * @returns The warrant cancellation event in OCF format
 */
export async function getWarrantCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantCancellationAsOcfParams
): Promise<GetWarrantCancellationAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantCancellationAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantCancellation,
  });
  const data = extractAndDecodeCancellationData('warrantCancellation', createArgument);
  const event = damlWarrantCancellationToNative(data);
  return { event, contractId: params.contractId };
}
