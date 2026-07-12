import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types';
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

export function stockClassAuthorizedSharesAdjustmentDataToDaml(
  d: OcfStockClassAuthorizedSharesAdjustment
): DamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'> {
  const input = requirePlainWriterInput(d, 'stockClassAuthorizedSharesAdjustment');
  const result = {
    id: requireWriterString(input.id, 'stockClassAuthorizedSharesAdjustment.id'),
    date: dateStringToDAMLTime(input.date, 'stockClassAuthorizedSharesAdjustment.date'),
    stock_class_id: requireWriterString(input.stock_class_id, 'stockClassAuthorizedSharesAdjustment.stock_class_id'),
    new_shares_authorized: canonicalizeAdministrativeAdjustmentWriterNumeric(
      input.new_shares_authorized,
      'stockClassAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    board_approval_date: canonicalOptionalDateToDaml(
      input.board_approval_date,
      'stockClassAuthorizedSharesAdjustment.board_approval_date'
    ),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      input.stockholder_approval_date,
      'stockClassAuthorizedSharesAdjustment.stockholder_approval_date'
    ),
    comments: nonEmptyCommentsToDaml(input.comments, 'stockClassAuthorizedSharesAdjustment.comments'),
  } satisfies DamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'>;
  validateCanonicalWriterInput(
    'stockClassAuthorizedSharesAdjustment',
    'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    input,
    'stockClassAuthorizedSharesAdjustment'
  );
  return result;
}
