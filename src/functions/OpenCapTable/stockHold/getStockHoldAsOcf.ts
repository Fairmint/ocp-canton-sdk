import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockHold } from '../../../types/native';
import { getEntityAsOcf } from '../capTable/damlToOcf';

/**
 * OCF Stock Hold with object_type discriminator (Fairmint OCF extension):
 * https://raw.githubusercontent.com/Fairmint/open-captable-protocol-daml/main/ocf-extension/schema/objects/transactions/hold/StockHold.schema.json
 */
export type OcfStockHoldEvent = OcfStockHold;

export type GetStockHoldAsOcfParams = GetByContractIdParams;

export interface GetStockHoldAsOcfResult {
  event: OcfStockHoldEvent;
  contractId: string;
}

/**
 * Read a StockHold contract and return it as an OCF TX_STOCK_HOLD object.
 *
 * The register writes holds itself; there is no writer for this record.
 */
export async function getStockHoldAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockHoldAsOcfParams
): Promise<GetStockHoldAsOcfResult> {
  const { contractId, ...options } = params;
  const { data } = await getEntityAsOcf(client, 'stockHold', contractId, options);
  return { event: data, contractId };
}
