import type { OcfIssuerAuthorizedSharesAdjustment } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import { canonicalizeAdministrativeAdjustmentNumeric } from '../capTable/administrativeAdjustmentValidation';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { canonicalOptionalDateToDaml, requiredTextToDaml } from '../shared/damlText';
import { commentsToDaml, requirePlainWriterInput, validateCanonicalWriterInput } from '../shared/ocfWriterValidation';

export function issuerAuthorizedSharesAdjustmentDataToDaml(
  d: OcfIssuerAuthorizedSharesAdjustment
): DamlDataTypeFor<'issuerAuthorizedSharesAdjustment'> {
  const input = requirePlainWriterInput(d, 'issuerAuthorizedSharesAdjustment');
  const result = {
    id: requiredTextToDaml(input.id, 'issuerAuthorizedSharesAdjustment.id'),
    date: dateStringToDAMLTime(input.date, 'issuerAuthorizedSharesAdjustment.date'),
    issuer_id: requiredTextToDaml(input.issuer_id, 'issuerAuthorizedSharesAdjustment.issuer_id'),
    new_shares_authorized: canonicalizeAdministrativeAdjustmentNumeric(
      input.new_shares_authorized,
      'issuerAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    board_approval_date: canonicalOptionalDateToDaml(
      input.board_approval_date,
      'issuerAuthorizedSharesAdjustment.board_approval_date'
    ),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      input.stockholder_approval_date,
      'issuerAuthorizedSharesAdjustment.stockholder_approval_date'
    ),
    comments: commentsToDaml(input.comments, 'issuerAuthorizedSharesAdjustment.comments'),
  } satisfies DamlDataTypeFor<'issuerAuthorizedSharesAdjustment'>;
  validateCanonicalWriterInput(
    'issuerAuthorizedSharesAdjustment',
    'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    input,
    'issuerAuthorizedSharesAdjustment'
  );
  return result;
}
