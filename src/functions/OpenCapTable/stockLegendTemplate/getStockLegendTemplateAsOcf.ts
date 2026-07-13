import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockLegendTemplate } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';

/** Type alias for DAML StockLegendTemplate contract createArgument */
type StockLegendTemplateCreateArgument = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate;
type DamlStockLegendTemplateOcfData = Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData;

export function damlStockLegendTemplateDataToNative(damlData: DamlStockLegendTemplateOcfData): OcfStockLegendTemplate {
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
    object_type: 'STOCK_LEGEND_TEMPLATE',
    id: damlData.id,
    name: damlData.name,
    text: damlData.text,
    ...(Array.isArray(damlData.comments) && damlData.comments.length ? { comments: damlData.comments } : {}),
  };
}

export interface GetStockLegendTemplateAsOcfParams extends GetByContractIdParams {}

export interface GetStockLegendTemplateAsOcfResult {
  stockLegendTemplate: OcfStockLegendTemplate;
  contractId: string;
}

export async function getStockLegendTemplateAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockLegendTemplateAsOcfParams
): Promise<GetStockLegendTemplateAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockLegendTemplateAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate.templateId,
  });
  const contract = createArgument as StockLegendTemplateCreateArgument;
  const stockLegendTemplate = damlStockLegendTemplateDataToNative(contract.template_data);

  return { stockLegendTemplate, contractId: params.contractId };
}
