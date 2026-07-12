import type { OcfStockPlanPoolAdjustment } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import { canonicalizeAdministrativeAdjustmentWriterNumeric } from '../capTable/administrativeAdjustmentValidation';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalDateToDaml } from '../shared/damlText';
import {
  nonEmptyCommentsToDaml,
  requirePlainWriterInput,
  requireWriterString,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';

export function stockPlanPoolAdjustmentDataToDaml(
  d: OcfStockPlanPoolAdjustment
): DamlDataTypeFor<'stockPlanPoolAdjustment'> {
  const input = requirePlainWriterInput(d, 'stockPlanPoolAdjustment');
  const result = {
    id: requireWriterString(input.id, 'stockPlanPoolAdjustment.id'),
    date: dateStringToDAMLTime(input.date, 'stockPlanPoolAdjustment.date'),
    stock_plan_id: requireWriterString(input.stock_plan_id, 'stockPlanPoolAdjustment.stock_plan_id'),
    shares_reserved: canonicalizeAdministrativeAdjustmentWriterNumeric(
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
    comments: nonEmptyCommentsToDaml(input.comments, 'stockPlanPoolAdjustment.comments'),
  } satisfies DamlDataTypeFor<'stockPlanPoolAdjustment'>;
  validateCanonicalWriterInput(
    'stockPlanPoolAdjustment',
    'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    input,
    'stockPlanPoolAdjustment'
  );
  return result;
}
