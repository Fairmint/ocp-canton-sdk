import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfWarrantTransfer } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlWarrantTransferToNative } from './damlToOcf';

/**
 * OCF Warrant Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/WarrantTransfer.schema.json
 */
export type OcfWarrantTransferEvent = OcfWarrantTransfer;

export type GetWarrantTransferAsOcfParams = GetByContractIdParams;

export interface GetWarrantTransferAsOcfResult {
  event: OcfWarrantTransferEvent;
  contractId: string;
}

export async function getWarrantTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantTransferAsOcfParams
): Promise<GetWarrantTransferAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getWarrantTransferAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.warrantTransfer,
  });
  const data = extractAndDecodeDamlEntityData('warrantTransfer', createArgument);
  const event = damlWarrantTransferToNative(data);
  return { event, contractId };
}
