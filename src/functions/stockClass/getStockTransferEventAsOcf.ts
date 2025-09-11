import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfStockTransferEvent {
  object_type: 'STOCK_TRANSFER';
  id?: string;
  stock_class: string;
  from_owner: string;
  to_owner: string;
  quantity: string;
  date: string;
}

export interface GetStockTransferEventAsOcfParams { contractId: string }
export interface GetStockTransferEventAsOcfResult { event: OcfStockTransferEvent; contractId: string }

/**
 * Retrieve a Stock Transfer event and return it as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/transfer/StockTransfer.schema.json
 */
export async function getStockTransferEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockTransferEventAsOcfParams
): Promise<GetStockTransferEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const event: OcfStockTransferEvent = {
    object_type: 'STOCK_TRANSFER',
    id: arg.ocf_id,
    stock_class: arg.stock_class,
    from_owner: arg.from_owner,
    to_owner: arg.to_owner,
    quantity: arg.quantity,
    date: (arg.date as string).split('T')[0]
  };
  return { event, contractId: params.contractId };
}
