import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

interface DamlDataWithId extends Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData {
  id: string;
}

function damlStockLegendTemplateDataToNative(
  damlData: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData
): Omit<OcfStockLegendTemplateOutput, 'object_type'> {
  const dataWithId = damlData as DamlDataWithId;
  return {
    id: dataWithId.id,
    name: damlData.name || '',
    text: damlData.text || '',
    comments: Array.isArray((damlData as unknown as { comments?: unknown }).comments)
      ? (damlData as unknown as { comments: string[] }).comments
      : [],
  };
}

interface OcfStockLegendTemplateOutput {
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
  stockLegendTemplate: OcfStockLegendTemplateOutput;
  contractId: string;
}

export async function getStockLegendTemplateAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockLegendTemplateAsOcfParams
): Promise<GetStockLegendTemplateAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const { createArgument } = eventsResponse.created.createdEvent;

  interface HasTemplateData {
    template_data: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData;
  }

  function hasTemplateData(arg: unknown): arg is HasTemplateData {
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'template_data' in arg &&
      typeof (arg as { template_data: unknown }).template_data === 'object'
    );
  }
  if (!hasTemplateData(createArgument)) {
    throw new Error('Template data not found in contract create argument');
  }

  const native = damlStockLegendTemplateDataToNative(createArgument.template_data);

  const ocf: OcfStockLegendTemplateOutput = {
    object_type: 'STOCK_LEGEND_TEMPLATE',
    ...native,
  };

  return { stockLegendTemplate: ocf, contractId: params.contractId };
}
