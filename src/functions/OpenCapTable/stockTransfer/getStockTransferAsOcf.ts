import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockTransferOutput } from '../../../types/output';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockTransferToNative } from './damlToOcf';

/**
 * OCF Stock Transfer Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/transfer/StockTransfer.schema.json
 */
export type OcfStockTransferEvent = OcfStockTransferOutput;

export type GetStockTransferAsOcfParams = GetByContractIdParams;

export interface GetStockTransferAsOcfResult {
  readonly event: OcfStockTransferEvent;
  readonly contractId: string;
}

export async function getStockTransferAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockTransferAsOcfParams
): Promise<GetStockTransferAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockTransferAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockTransfer,
  });
  const data = extractAndDecodeDamlEntityData('stockTransfer', createArgument);
  const event = damlStockTransferToNative(data as Parameters<typeof damlStockTransferToNative>[0]);
  return Object.freeze({ event, contractId });
}
