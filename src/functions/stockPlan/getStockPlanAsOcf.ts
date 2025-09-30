import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlStockPlanDataToNative } from '../../utils/typeConversions';

export interface OcfStockPlan {
  object_type: 'STOCK_PLAN';
  id?: string;
  plan_name: string;
  initial_shares_reserved: string | number;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  default_cancellation_behavior?: string;
  comments?: string[];
}

export interface GetStockPlanAsOcfParams {
  contractId: string;
}

export interface GetStockPlanAsOcfResult {
  stockPlan: OcfStockPlan;
  contractId: string;
}

/**
 * Retrieve a stock plan contract and return it as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockPlan.schema.json
 */
export async function getStockPlanAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanAsOcfParams
): Promise<GetStockPlanAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument as any;

  if (!('plan_data' in createArgument)) {
    throw new Error('plan_data not found in contract create argument');
  }

  const native = damlStockPlanDataToNative(createArgument.plan_data);
  const { id, ...nativeWithoutId } = native as any;

  const ocf: OcfStockPlan = {
    object_type: 'STOCK_PLAN',
    id,
    ...nativeWithoutId,
    comments: Array.isArray((native as any).comments) ? (native as any).comments : [],
    ...(Array.isArray((native as any).stock_class_ids) ? { stock_class_ids: (native as any).stock_class_ids } : {})
  };

  return { stockPlan: ocf, contractId: params.contractId };
}
