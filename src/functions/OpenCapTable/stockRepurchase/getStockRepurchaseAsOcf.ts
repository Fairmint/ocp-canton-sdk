import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockRepurchase } from '../../../types/native';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';
import { damlStockRepurchaseToNative } from './damlToOcf';

/**
 * OCF Stock Repurchase Event with object_type discriminator OCF:
 * https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export type OcfStockRepurchaseEvent = OcfStockRepurchase;

export type GetStockRepurchaseAsOcfParams = GetByContractIdParams;

export interface GetStockRepurchaseAsOcfResult {
  event: OcfStockRepurchaseEvent;
  contractId: string;
}

export async function getStockRepurchaseAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockRepurchaseAsOcfParams
): Promise<GetStockRepurchaseAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockRepurchaseAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockRepurchase,
  });
  const data = extractAndDecodeDamlEntityData('stockRepurchase', createArgument);
  const event = damlStockRepurchaseToNative(data);
  return { event, contractId: params.contractId };
}
