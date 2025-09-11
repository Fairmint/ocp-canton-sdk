import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfStockIssuanceEvent {
  object_type: 'STOCK_ISSUANCE';
  id?: string;
  stock_class: string;
  recipient: string;
  quantity: string;
  date: string;
}

export interface GetStockIssuanceEventAsOcfParams {
  contractId: string;
}

export interface GetStockIssuanceEventAsOcfResult {
  event: OcfStockIssuanceEvent;
  contractId: string;
}

/**
 * Retrieve a Stock Issuance event and return it as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/issuance/StockIssuance.schema.json
 */
export async function getStockIssuanceEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockIssuanceEventAsOcfParams
): Promise<GetStockIssuanceEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const event: OcfStockIssuanceEvent = {
    object_type: 'STOCK_ISSUANCE',
    id: arg.ocf_id,
    stock_class: arg.stock_class,
    recipient: arg.recipient,
    quantity: arg.quantity,
    date: (arg.date as string).split('T')[0]
  };
  return { event, contractId: params.contractId };
}
