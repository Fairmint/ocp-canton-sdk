import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { OcfStockLegendTemplate } from '../../../types';
import { cleanComments } from '../../../utils/typeConversions';

export function stockLegendTemplateDataToDaml(
  data: OcfStockLegendTemplate
): Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData {
  if (!data.id) throw new Error('stockLegendTemplate.id is required');
  return {
    id: data.id,
    name: data.name,
    text: data.text,
    comments: cleanComments(data.comments),
  };
}
