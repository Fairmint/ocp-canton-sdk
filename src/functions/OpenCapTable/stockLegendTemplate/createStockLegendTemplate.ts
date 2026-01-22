import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { OcfStockLegendTemplate } from '../../../types';
import { cleanComments } from '../../../utils/typeConversions';

export function stockLegendTemplateDataToDaml(
  data: OcfStockLegendTemplate
): Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData {
  if (!data.id)
    throw new OcpValidationError('stockLegendTemplate.id', 'stockLegendTemplate.id is required', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  return {
    id: data.id,
    name: data.name,
    text: data.text,
    comments: cleanComments(data.comments),
  };
}
