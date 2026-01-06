import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, StockLegendTemplateOcfData } from '../../../types';
import { cleanComments } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockLegendTemplateDataToDaml(
  data: StockLegendTemplateOcfData
): Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData {
  if (!data.id) throw new Error('stockLegendTemplate.id is required');
  return {
    id: data.id,
    name: data.name,
    text: data.text,
    comments: cleanComments(data.comments),
  };
}

/** @deprecated Use AddStockLegendTemplateParams and buildAddStockLegendTemplateCommand instead. */
export interface CreateStockLegendTemplateParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  templateData: StockLegendTemplateOcfData;
}

/** @deprecated Use buildAddStockLegendTemplateCommand instead. */
export function buildCreateStockLegendTemplateCommand(
  params: CreateStockLegendTemplateParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockLegendTemplate',
    choiceArgument: {
      template_data: stockLegendTemplateDataToDaml(params.templateData),
    },
  });
}
