import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfStockRepurchaseEvent {
  object_type: 'STOCK_REPURCHASE';
  id?: string;
  stock_class: string;
  owner: string;
  quantity: string;
  date: string;
}

export interface GetStockRepurchaseEventAsOcfParams { contractId: string }
export interface GetStockRepurchaseEventAsOcfResult { event: OcfStockRepurchaseEvent; contractId: string }

/**
 * Retrieve a Stock Repurchase event and return it as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/repurchase/StockRepurchase.schema.json
 */
export async function getStockRepurchaseEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockRepurchaseEventAsOcfParams
): Promise<GetStockRepurchaseEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const event: OcfStockRepurchaseEvent = {
    object_type: 'STOCK_REPURCHASE',
    id: (arg as any).id,
    stock_class: arg.stock_class,
    owner: arg.owner,
    quantity: arg.quantity,
    date: (arg.date as string).split('T')[0]
  };
  return { event, contractId: params.contractId };
}
