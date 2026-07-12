import type { OcfStockPlanPoolAdjustment } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import { canonicalizeAdministrativeAdjustmentNumeric } from '../capTable/administrativeAdjustmentValidation';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalDateToDaml, requiredTextToDaml } from '../shared/damlText';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

export function stockPlanPoolAdjustmentDataToDaml(
  d: OcfStockPlanPoolAdjustment
): DamlDataTypeFor<'stockPlanPoolAdjustment'> {
  const input = requirePlainWriterInput(d, 'stockPlanPoolAdjustment');
  const result = {
    id: requiredTextToDaml(input.id, 'stockPlanPoolAdjustment.id'),
    date: dateStringToDAMLTime(input.date, 'stockPlanPoolAdjustment.date'),
    stock_plan_id: requiredTextToDaml(input.stock_plan_id, 'stockPlanPoolAdjustment.stock_plan_id'),
    shares_reserved: canonicalizeAdministrativeAdjustmentNumeric(
      input.shares_reserved,
      'stockPlanPoolAdjustment.shares_reserved'
    ),
    board_approval_date: canonicalOptionalDateToDaml(
      input.board_approval_date,
      'stockPlanPoolAdjustment.board_approval_date'
    ),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      input.stockholder_approval_date,
      'stockPlanPoolAdjustment.stockholder_approval_date'
    ),
    comments: commentsToDaml(input.comments, 'stockPlanPoolAdjustment.comments'),
  } satisfies DamlDataTypeFor<'stockPlanPoolAdjustment'>;
  validateCanonicalWriterInput(
    'stockPlanPoolAdjustment',
    'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    input,
    'stockPlanPoolAdjustment'
  );
  return result;
}
