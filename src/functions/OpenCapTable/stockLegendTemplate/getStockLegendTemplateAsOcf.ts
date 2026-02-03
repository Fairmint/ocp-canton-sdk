import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';

/** Type alias for DAML StockLegendTemplate contract createArgument */
type StockLegendTemplateCreateArgument = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate;
type DamlStockLegendTemplateOcfData = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData;

export function damlStockLegendTemplateDataToNative(
  damlData: DamlStockLegendTemplateOcfData
): Omit<OcfStockLegendTemplateOutput, 'object_type'> {
  if (!damlData.name) {
    throw new OcpValidationError('stockLegendTemplate.name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (!damlData.text) {
    throw new OcpValidationError('stockLegendTemplate.text', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  return {
    id: damlData.id,
    name: damlData.name,
    text: damlData.text,
    ...(Array.isArray(damlData.comments) && damlData.comments.length ? { comments: damlData.comments } : {}),
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
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = eventsResponse.created.createdEvent.createArgument as StockLegendTemplateCreateArgument;
  const native = damlStockLegendTemplateDataToNative(contract.template_data);

  const ocf: OcfStockLegendTemplateOutput = {
    object_type: 'STOCK_LEGEND_TEMPLATE',
    ...native,
  };

  return { stockLegendTemplate: ocf, contractId: params.contractId };
}
