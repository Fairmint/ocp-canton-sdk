import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { StockLegendTemplateOcfData } from '../../../types/native';

/** Type alias for DAML StockLegendTemplate contract createArgument */
type StockLegendTemplateCreateArgument = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate;
type DamlStockLegendTemplateOcfData = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData;

function damlStockLegendTemplateDataToNative(damlData: DamlStockLegendTemplateOcfData): StockLegendTemplateOcfData {
  return {
    id: damlData.id,
    name: damlData.name,
    text: damlData.text,
    comments: damlData.comments,
  };
}

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
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  const contract = eventsResponse.created.createdEvent.createArgument as StockLegendTemplateCreateArgument;
  const native = damlStockLegendTemplateDataToNative(contract.template_data);

  const ocf: OcfStockLegendTemplate = {
    object_type: 'STOCK_LEGEND_TEMPLATE',
    ...native,
  };

  return { stockLegendTemplate: ocf, contractId: params.contractId };
}
