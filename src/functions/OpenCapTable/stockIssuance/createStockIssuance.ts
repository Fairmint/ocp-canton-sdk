import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { OcfStockIssuance, StockIssuanceType } from '../../../types/native';
import { damlNumeric10ToScaledBigInt } from '../../../utils/damlNumeric';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { nativeMonetaryToDamlNumeric10 } from '../shared/damlNumerics';
import {
  canonicalOptionalDateToDaml,
  canonicalOptionalNonEmptyTextToDaml,
  requiredNonEmptyTextToDaml,
} from '../shared/damlText';
import { requirePositiveOcfDecimal } from '../shared/ocfValues';
import {
  commentsToDaml,
  optionalWriterArray,
  requirePlainWriterInput,
  requireWriterArray,
  validateCanonicalObjectType,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';

/** Exact canonical OCF input accepted by the direct writer. */
export type StockIssuanceInput = OcfStockIssuance;

function stockIssuanceTypeToDaml(value: unknown): DamlDataTypeFor<'stockIssuance'>['issuance_type'] {
  if (value === undefined) return null;
  switch (value as StockIssuanceType) {
    case 'RSA':
      return 'OcfStockIssuanceRSA';
    case 'FOUNDERS_STOCK':
      return 'OcfStockIssuanceFounders';
    default:
      throw new OcpParseError('Unknown stock issuance type', {
        source: 'stockIssuance.issuance_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        context: { receivedValue: value },
      });
  }
}

function securityLawExemptionsToDaml(value: unknown): DamlDataTypeFor<'stockIssuance'>['security_law_exemptions'] {
  return requireWriterArray(value, 'stockIssuance.security_law_exemptions').map((item, index) => {
    const path = `stockIssuance.security_law_exemptions[${index}]`;
    const record = requirePlainWriterInput(item, path);
    return {
      description: requiredNonEmptyTextToDaml(record.description, `${path}.description`),
      jurisdiction: requiredNonEmptyTextToDaml(record.jurisdiction, `${path}.jurisdiction`),
    };
  });
}

function shareNumberRangesToDaml(value: unknown): DamlDataTypeFor<'stockIssuance'>['share_numbers_issued'] {
  return optionalWriterArray(value, 'stockIssuance.share_numbers_issued').map((item, index) => {
    const path = `stockIssuance.share_numbers_issued[${index}]`;
    const record = requirePlainWriterInput(item, path);
    const startingShareNumber = requirePositiveOcfDecimal(
      record.starting_share_number,
      `${path}.starting_share_number`
    );
    const endingShareNumber = requirePositiveOcfDecimal(record.ending_share_number, `${path}.ending_share_number`);
    if (damlNumeric10ToScaledBigInt(endingShareNumber) < damlNumeric10ToScaledBigInt(startingShareNumber)) {
      throw new OcpValidationError(`${path}.ending_share_number`, 'Ending share number must not precede the start', {
        code: OcpErrorCodes.OUT_OF_RANGE,
        expectedType: 'DAML Numeric(10) greater than or equal to starting_share_number',
        receivedValue: record.ending_share_number,
      });
    }
    return { starting_share_number: startingShareNumber, ending_share_number: endingShareNumber };
  });
}

function vestingsToDaml(value: unknown): DamlDataTypeFor<'stockIssuance'>['vestings'] {
  return optionalWriterArray(value, 'stockIssuance.vestings').map((item, index) => {
    const path = `stockIssuance.vestings[${index}]`;
    const record = requirePlainWriterInput(item, path);
    return {
      date: dateStringToDAMLTime(record.date, `${path}.date`),
      amount: requirePositiveOcfDecimal(record.amount, `${path}.amount`),
    };
  });
}

function stockLegendIdsToDaml(value: unknown): string[] {
  return requireWriterArray(value, 'stockIssuance.stock_legend_ids').map((item, index) =>
    requiredNonEmptyTextToDaml(item, `stockIssuance.stock_legend_ids[${index}]`)
  );
}

/** Convert one canonical OCF stock issuance into the exact generated DAML payload. */
export function stockIssuanceDataToDaml(input: StockIssuanceInput): DamlDataTypeFor<'stockIssuance'> {
  const d = requirePlainWriterInput(input, 'stockIssuance');
  validateCanonicalObjectType('stockIssuance', 'TX_STOCK_ISSUANCE', d, 'stockIssuance');
  const result: DamlDataTypeFor<'stockIssuance'> = {
    id: requiredNonEmptyTextToDaml(d.id, 'stockIssuance.id'),
    custom_id: requiredNonEmptyTextToDaml(d.custom_id, 'stockIssuance.custom_id'),
    date: dateStringToDAMLTime(d.date, 'stockIssuance.date'),
    quantity: requirePositiveOcfDecimal(d.quantity, 'stockIssuance.quantity'),
    security_id: requiredNonEmptyTextToDaml(d.security_id, 'stockIssuance.security_id'),
    share_price: nativeMonetaryToDamlNumeric10(d.share_price, 'stockIssuance.share_price'),
    stakeholder_id: requiredNonEmptyTextToDaml(d.stakeholder_id, 'stockIssuance.stakeholder_id'),
    stock_class_id: requiredNonEmptyTextToDaml(d.stock_class_id, 'stockIssuance.stock_class_id'),
    comments: commentsToDaml(d.comments, 'stockIssuance.comments').map((comment, index) =>
      requiredNonEmptyTextToDaml(comment, `stockIssuance.comments[${index}]`)
    ),
    security_law_exemptions: securityLawExemptionsToDaml(d.security_law_exemptions),
    share_numbers_issued: shareNumberRangesToDaml(d.share_numbers_issued),
    stock_legend_ids: stockLegendIdsToDaml(d.stock_legend_ids),
    vestings: vestingsToDaml(d.vestings),
    board_approval_date: canonicalOptionalDateToDaml(d.board_approval_date, 'stockIssuance.board_approval_date'),
    consideration_text: canonicalOptionalNonEmptyTextToDaml(d.consideration_text, 'stockIssuance.consideration_text'),
    cost_basis:
      d.cost_basis === undefined ? null : nativeMonetaryToDamlNumeric10(d.cost_basis, 'stockIssuance.cost_basis'),
    issuance_type: stockIssuanceTypeToDaml(d.issuance_type),
    stock_plan_id: canonicalOptionalNonEmptyTextToDaml(d.stock_plan_id, 'stockIssuance.stock_plan_id'),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      d.stockholder_approval_date,
      'stockIssuance.stockholder_approval_date'
    ),
    vesting_terms_id: canonicalOptionalNonEmptyTextToDaml(d.vesting_terms_id, 'stockIssuance.vesting_terms_id'),
  };

  validateCanonicalWriterInput('stockIssuance', 'TX_STOCK_ISSUANCE', d, 'stockIssuance');
  return result;
}
