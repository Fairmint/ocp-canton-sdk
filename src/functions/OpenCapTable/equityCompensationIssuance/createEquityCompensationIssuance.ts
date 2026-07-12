import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import type { CompensationType, OcfEquityCompensationIssuance, TerminationWindow } from '../../../types';
import { dateStringToDAMLTime, nullableDateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { nativeNonnegativeSafeIntegerToDaml } from '../shared/damlIntegers';
import { nativeMonetaryToDamlNumeric10, ocfNumericToDamlNumeric10 } from '../shared/damlNumerics';
import {
  canonicalOptionalBooleanToDaml,
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
  securityLawExemptionsToDaml,
  validateCanonicalObjectType,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';
import { validateEquityCompensationPricing } from './equityCompensationPricing';

/** Exact canonical OCF input accepted by the direct writer. */
export type EquityCompensationIssuanceInput = OcfEquityCompensationIssuance;

export function compensationTypeToDaml(t: CompensationType): Fairmint.OpenCapTable.Types.Vesting.OcfCompensationType {
  switch (t) {
    case 'OPTION_NSO':
      return 'OcfCompensationTypeOptionNSO';
    case 'OPTION_ISO':
      return 'OcfCompensationTypeOptionISO';
    case 'OPTION':
      return 'OcfCompensationTypeOption';
    case 'RSU':
      return 'OcfCompensationTypeRSU';
    case 'CSAR':
      return 'OcfCompensationTypeCSAR';
    case 'SSAR':
      return 'OcfCompensationTypeSSAR';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown compensation type: ${toSafeDiagnosticText(exhaustiveCheck)}`, {
        source: 'equityCompensationIssuance.compensation_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

export const terminationWindowReasonMap: Record<
  TerminationWindow['reason'],
  Fairmint.OpenCapTable.Types.Vesting.OcfTerminationWindowType
> = {
  VOLUNTARY_OTHER: 'OcfTermVoluntaryOther',
  VOLUNTARY_GOOD_CAUSE: 'OcfTermVoluntaryGoodCause',
  VOLUNTARY_RETIREMENT: 'OcfTermVoluntaryRetirement',
  INVOLUNTARY_OTHER: 'OcfTermInvoluntaryOther',
  INVOLUNTARY_DEATH: 'OcfTermInvoluntaryDeath',
  INVOLUNTARY_DISABILITY: 'OcfTermInvoluntaryDisability',
  INVOLUNTARY_WITH_CAUSE: 'OcfTermInvoluntaryWithCause',
};

export const terminationWindowPeriodTypeMap: Record<
  TerminationWindow['period_type'],
  Fairmint.OpenCapTable.Types.Vesting.OcfPeriodType
> = {
  DAYS: 'OcfPeriodDays',
  MONTHS: 'OcfPeriodMonths',
  YEARS: 'OcfPeriodYears',
};

function terminationWindowReasonToDaml(
  value: unknown,
  fieldPath: string
): Fairmint.OpenCapTable.Types.Vesting.OcfTerminationWindowType {
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(terminationWindowReasonMap, value)) {
    return terminationWindowReasonMap[value as TerminationWindow['reason']];
  }
  throw new OcpValidationError(fieldPath, `Unknown termination-window reason: ${toSafeDiagnosticText(value)}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType: Object.keys(terminationWindowReasonMap).join(' | '),
    receivedValue: value,
  });
}

function terminationWindowPeriodTypeToDaml(
  value: unknown,
  fieldPath: string
): Fairmint.OpenCapTable.Types.Vesting.OcfPeriodType {
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(terminationWindowPeriodTypeMap, value)) {
    return terminationWindowPeriodTypeMap[value as TerminationWindow['period_type']];
  }
  throw new OcpValidationError(fieldPath, `Unknown termination-window period type: ${toSafeDiagnosticText(value)}`, {
    code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    expectedType: Object.keys(terminationWindowPeriodTypeMap).join(' | '),
    receivedValue: value,
  });
}

export function equityCompensationIssuanceDataToDaml(
  d: EquityCompensationIssuanceInput
): DamlDataTypeFor<'equityCompensationIssuance'> {
  const input = requirePlainWriterInput(d, 'equityCompensationIssuance');
  validateCanonicalObjectType(
    'equityCompensationIssuance',
    'TX_EQUITY_COMPENSATION_ISSUANCE',
    input,
    'equityCompensationIssuance'
  );
  const pricing = validateEquityCompensationPricing(
    d.compensation_type,
    d.exercise_price,
    d.base_price,
    'equityCompensationIssuance'
  );
  const vestings = optionalWriterArray(d.vestings, 'equityCompensationIssuance.vestings').map((value, index) => {
    const fieldPath = `equityCompensationIssuance.vestings[${index}]`;
    const vesting = requirePlainWriterInput(value, fieldPath);
    return {
      date: dateStringToDAMLTime(vesting.date, `${fieldPath}.date`),
      amount: requirePositiveOcfDecimal(vesting.amount, `${fieldPath}.amount`),
    };
  });
  const terminationExerciseWindows = requireWriterArray(
    d.termination_exercise_windows,
    'equityCompensationIssuance.termination_exercise_windows'
  ).map((value, index) => {
    const fieldPath = `equityCompensationIssuance.termination_exercise_windows[${index}]`;
    const window = requirePlainWriterInput(value, fieldPath);
    return {
      reason: terminationWindowReasonToDaml(window.reason, `${fieldPath}.reason`),
      period: nativeNonnegativeSafeIntegerToDaml(window.period, `${fieldPath}.period`),
      period_type: terminationWindowPeriodTypeToDaml(window.period_type, `${fieldPath}.period_type`),
    };
  });

  const result: DamlDataTypeFor<'equityCompensationIssuance'> = {
    id: requiredNonEmptyTextToDaml(d.id, 'equityCompensationIssuance.id'),
    security_id: requiredNonEmptyTextToDaml(d.security_id, 'equityCompensationIssuance.security_id'),
    custom_id: requiredNonEmptyTextToDaml(d.custom_id, 'equityCompensationIssuance.custom_id'),
    stakeholder_id: requiredNonEmptyTextToDaml(d.stakeholder_id, 'equityCompensationIssuance.stakeholder_id'),
    date: dateStringToDAMLTime(d.date, 'equityCompensationIssuance.date'),
    board_approval_date: canonicalOptionalDateToDaml(
      d.board_approval_date,
      'equityCompensationIssuance.board_approval_date'
    ),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      d.stockholder_approval_date,
      'equityCompensationIssuance.stockholder_approval_date'
    ),
    consideration_text: canonicalOptionalNonEmptyTextToDaml(
      d.consideration_text,
      'equityCompensationIssuance.consideration_text'
    ),
    security_law_exemptions: securityLawExemptionsToDaml(
      d.security_law_exemptions,
      'equityCompensationIssuance.security_law_exemptions'
    ).map((exemption, index) => ({
      description: requiredNonEmptyTextToDaml(
        exemption.description,
        `equityCompensationIssuance.security_law_exemptions[${index}].description`
      ),
      jurisdiction: requiredNonEmptyTextToDaml(
        exemption.jurisdiction,
        `equityCompensationIssuance.security_law_exemptions[${index}].jurisdiction`
      ),
    })),
    stock_plan_id: canonicalOptionalNonEmptyTextToDaml(d.stock_plan_id, 'equityCompensationIssuance.stock_plan_id'),
    stock_class_id: canonicalOptionalNonEmptyTextToDaml(d.stock_class_id, 'equityCompensationIssuance.stock_class_id'),
    vesting_terms_id: canonicalOptionalNonEmptyTextToDaml(
      d.vesting_terms_id,
      'equityCompensationIssuance.vesting_terms_id'
    ),
    compensation_type: compensationTypeToDaml(d.compensation_type),
    quantity: ocfNumericToDamlNumeric10(d.quantity, 'equityCompensationIssuance.quantity'),
    exercise_price: pricing.exercise_price
      ? nativeMonetaryToDamlNumeric10(pricing.exercise_price, 'equityCompensationIssuance.exercise_price')
      : null,
    base_price: pricing.base_price
      ? nativeMonetaryToDamlNumeric10(pricing.base_price, 'equityCompensationIssuance.base_price')
      : null,
    early_exercisable: canonicalOptionalBooleanToDaml(
      d.early_exercisable,
      'equityCompensationIssuance.early_exercisable'
    ),
    vestings,
    expiration_date: nullableDateStringToDAMLTime(d.expiration_date, 'equityCompensationIssuance.expiration_date'),
    termination_exercise_windows: terminationExerciseWindows,
    comments: commentsToDaml(d.comments, 'equityCompensationIssuance.comments').map((comment, index) =>
      requiredNonEmptyTextToDaml(comment, `equityCompensationIssuance.comments[${index}]`)
    ),
  };

  validateCanonicalWriterInput(
    'equityCompensationIssuance',
    'TX_EQUITY_COMPENSATION_ISSUANCE',
    input,
    'equityCompensationIssuance'
  );
  return result;
}
