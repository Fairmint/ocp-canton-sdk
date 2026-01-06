import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { StockLegendTemplateOcfData } from '../../../types';
import { cleanComments } from '../../../utils/typeConversions';

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
