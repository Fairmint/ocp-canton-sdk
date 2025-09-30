import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlValuationDataToNative } from '../../utils/typeConversions';

export interface OcfValuation {
  object_type: 'VALUATION';
  id?: string;
  provider?: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
  price_per_share: { amount: string; currency: string };
  effective_date: string;
  valuation_type: '409A';
}

export interface GetValuationAsOcfParams {
  contractId: string;
}

export interface GetValuationAsOcfResult {
  valuation: OcfValuation;
  contractId: string;
}

/**
 * Retrieve a valuation contract and return it as an OCF JSON object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/Valuation.schema.json
 */
export async function getValuationAsOcf(
  client: LedgerJsonApiClient,
  params: GetValuationAsOcfParams
): Promise<GetValuationAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;

  function hasValuationData(arg: unknown): arg is { valuation_data: Fairmint.OpenCapTable.Valuation.OcfValuationData } {
    return typeof arg === 'object' && arg !== null && 'valuation_data' in arg && typeof (arg as any).valuation_data === 'object';
  }
  if (!hasValuationData(createArgument)) {
    throw new Error('Valuation data not found in contract create argument');
  }

  const native = damlValuationDataToNative(createArgument.valuation_data);
  const { id, stock_class_id, ...nativeWithoutId } = native as any;

  const ocf: OcfValuation = {
    object_type: 'VALUATION',
    id,
    ...nativeWithoutId,
    comments: Array.isArray((native as any).comments) ? (native as any).comments : [],
    price_per_share: {
      amount: typeof native.price_per_share.amount === 'number' ? String(native.price_per_share.amount) : native.price_per_share.amount,
      currency: native.price_per_share.currency
    }
  };

  return { valuation: ocf, contractId: params.contractId };
}
