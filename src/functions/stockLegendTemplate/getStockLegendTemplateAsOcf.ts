import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlStockLegendTemplateDataToNative } from '../../utils/typeConversions';

export interface OcfStockLegendTemplate {
  object_type: 'STOCK_LEGEND_TEMPLATE';
  id?: string;
  name: string;
  text: string;
  comments?: string[];
}

export interface GetStockLegendTemplateAsOcfParams {
  contractId: string;
}

export interface GetStockLegendTemplateAsOcfResult {
  stockLegendTemplate: OcfStockLegendTemplate;
  contractId: string;
}

export async function getStockLegendTemplateAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockLegendTemplateAsOcfParams
): Promise<GetStockLegendTemplateAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const createArgument = eventsResponse.created.createdEvent.createArgument;

  function hasTemplateData(arg: unknown): arg is { template_data: Fairmint.OpenCapTable.StockLegendTemplate.OcfStockLegendTemplateData } {
    return typeof arg === 'object' && arg !== null && 'template_data' in arg && typeof (arg as any).template_data === 'object';
  }
  if (!hasTemplateData(createArgument)) {
    throw new Error('Template data not found in contract create argument');
  }

  const native = damlStockLegendTemplateDataToNative(createArgument.template_data);
  const { id, ...nativeWithoutId } = native as any;

  const ocf: OcfStockLegendTemplate = {
    object_type: 'STOCK_LEGEND_TEMPLATE',
    id,
    ...nativeWithoutId
  };

  return { stockLegendTemplate: ocf, contractId: params.contractId };
}
