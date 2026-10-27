import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockHoldCancellation } from '../../../types/native';
import { getEntityAsOcf } from '../capTable/damlToOcf';

/**
 * OCF Stock Hold Cancellation with object_type discriminator (Fairmint OCF extension):
 * https://raw.githubusercontent.com/Fairmint/open-captable-protocol-daml/main/ocf-extension/schema/objects/transactions/hold/StockHoldCancellation.schema.json
 */
export type OcfStockHoldCancellationEvent = OcfStockHoldCancellation;

export type GetStockHoldCancellationAsOcfParams = GetByContractIdParams;

export interface GetStockHoldCancellationAsOcfResult {
  event: OcfStockHoldCancellationEvent;
  contractId: string;
}

/**
 * Read a StockHoldCancellation contract and return it as an OCF TX_STOCK_HOLD_CANCELLATION object.
 *
 * The register writes hold cancellations itself; there is no writer for this record.
 */
export async function getStockHoldCancellationAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockHoldCancellationAsOcfParams
): Promise<GetStockHoldCancellationAsOcfResult> {
  const { contractId, ...options } = params;
  const { data } = await getEntityAsOcf(client, 'stockHoldCancellation', contractId, options);
  return { event: data, contractId };
}
