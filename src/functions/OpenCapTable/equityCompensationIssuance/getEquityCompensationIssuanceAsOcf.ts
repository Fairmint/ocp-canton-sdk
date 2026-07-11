import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { PkgEquityCompensationIssuanceOcfData } from '../../../types/daml';
import type {
  CompensationType,
  OcfEquityCompensationIssuance,
  PeriodType,
  TerminationWindowReason,
} from '../../../types/native';
import {
  damlMonetaryToNativeWithValidation,
  damlTimeToDateString,
  nonEmptyArrayOrUndefined,
  normalizeNumericString,
  nullableDamlTimeToDateString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { readSingleContract } from '../shared/singleContractRead';
import { validateEquityCompensationPricing } from './equityCompensationPricing';

export type DamlEquityCompensationIssuanceData = PkgEquityCompensationIssuanceOcfData;
export type GetEquityCompensationIssuanceAsOcfParams = GetByContractIdParams;
export interface GetEquityCompensationIssuanceAsOcfResult {
  event: OcfEquityCompensationIssuance;
  contractId: string;
}

// Compensation type DAML→OCF mapping
const compMap: Partial<Record<string, CompensationType>> = {
  OcfCompensationTypeOptionNSO: 'OPTION_NSO',
  OcfCompensationTypeOptionISO: 'OPTION_ISO',
  OcfCompensationTypeOption: 'OPTION',
  OcfCompensationTypeRSU: 'RSU',
  OcfCompensationTypeCSAR: 'CSAR',
  OcfCompensationTypeSSAR: 'SSAR',
};

// Termination window reason DAML→OCF mapping
const twMapReason: Partial<Record<string, TerminationWindowReason>> = {
  OcfTermVoluntaryOther: 'VOLUNTARY_OTHER',
  OcfTermVoluntaryGoodCause: 'VOLUNTARY_GOOD_CAUSE',
  OcfTermVoluntaryRetirement: 'VOLUNTARY_RETIREMENT',
  OcfTermInvoluntaryOther: 'INVOLUNTARY_OTHER',
  OcfTermInvoluntaryDeath: 'INVOLUNTARY_DEATH',
  OcfTermInvoluntaryDisability: 'INVOLUNTARY_DISABILITY',
  OcfTermInvoluntaryWithCause: 'INVOLUNTARY_WITH_CAUSE',
};

// Termination window period type DAML→OCF mapping
const twMapPeriodType: Partial<Record<string, PeriodType>> = {
  OcfPeriodDays: 'DAYS',
  OcfPeriodMonths: 'MONTHS',
  OcfPeriodYears: 'YEARS',
};

/**
 * Converts DAML equity compensation issuance data to native OCF format.
 * Used by both getEquityCompensationIssuanceAsOcf and the damlToOcf dispatcher.
 */
export function damlEquityCompensationIssuanceDataToNative(
  d: DamlEquityCompensationIssuanceData
): OcfEquityCompensationIssuance {
  const exercisePrice = damlMonetaryToNativeWithValidation(
    d.exercise_price,
    'equityCompensationIssuance.exercise_price'
  );
  const basePrice = damlMonetaryToNativeWithValidation(d.base_price, 'equityCompensationIssuance.base_price');

  const vestings = nonEmptyArrayOrUndefined(
    d.vestings.map((vesting, index) => ({
      date: damlTimeToDateString(vesting.date, `equityCompensationIssuance.vestings[${index}].date`),
      amount: normalizeNumericString(vesting.amount, `equityCompensationIssuance.vestings[${index}].amount`),
    })),
    'equityCompensationIssuance.vestings'
  );

  const termination_exercise_windows =
    d.termination_exercise_windows.length > 0
      ? d.termination_exercise_windows.map((window, index) => {
          const reason = twMapReason[window.reason];
          if (!reason) {
            throw new OcpValidationError('termination_exercise_window.reason', `Unknown reason: ${window.reason}`, {
              code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
              receivedValue: window.reason,
            });
          }
          const periodType = twMapPeriodType[window.period_type];
          if (!periodType) {
            throw new OcpValidationError(
              'termination_exercise_window.period_type',
              `Unknown period_type: ${window.period_type}`,
              {
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
                receivedValue: window.period_type,
              }
            );
          }
          const period = parseDamlSafeInteger(
            window.period,
            `equityCompensationIssuance.termination_exercise_windows.${index}.period`,
            'numeric'
          );
          return { reason, period, period_type: periodType };
        })
      : undefined;

  const comments = d.comments.length > 0 ? d.comments : undefined;

  // Validate required fields
  if (typeof d.id !== 'string' || !d.id) {
    throw new OcpValidationError('equityCompensationIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  }
  if (typeof d.security_id !== 'string' || !d.security_id) {
    throw new OcpValidationError('equityCompensationIssuance.security_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.security_id,
    });
  }
  if (typeof d.custom_id !== 'string' || !d.custom_id) {
    throw new OcpValidationError('equityCompensationIssuance.custom_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.custom_id,
    });
  }
  if (typeof d.stakeholder_id !== 'string' || !d.stakeholder_id) {
    throw new OcpValidationError('equityCompensationIssuance.stakeholder_id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.stakeholder_id,
    });
  }
  const compensationType = compMap[d.compensation_type];
  if (!compensationType) {
    throw new OcpValidationError(
      'equityCompensationIssuance.compensation_type',
      `Unknown compensation type: ${d.compensation_type}`,
      {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        receivedValue: d.compensation_type,
      }
    );
  }
  const pricing = validateEquityCompensationPricing(
    compensationType,
    exercisePrice,
    basePrice,
    'equityCompensationIssuance'
  );

  // Map security_law_exemptions if present
  const security_law_exemptions = d.security_law_exemptions.map((exemption) => ({
    description: exemption.description,
    jurisdiction: exemption.jurisdiction,
  }));

  const boardApprovalDate = optionalDamlTimeToDateString(
    d.board_approval_date,
    'equityCompensationIssuance.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'equityCompensationIssuance.stockholder_approval_date'
  );

  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: d.id,
    date: damlTimeToDateString(d.date, 'equityCompensationIssuance.date'),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    ...pricing,
    quantity: normalizeNumericString(d.quantity, 'equityCompensationIssuance.quantity'),
    expiration_date: nullableDamlTimeToDateString(d.expiration_date, 'equityCompensationIssuance.expiration_date'),
    termination_exercise_windows: termination_exercise_windows ?? [],
    ...(d.early_exercisable !== null && d.early_exercisable !== undefined
      ? { early_exercisable: Boolean(d.early_exercisable) }
      : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(typeof d.consideration_text === 'string' && d.consideration_text
      ? { consideration_text: d.consideration_text }
      : {}),
    ...(typeof d.vesting_terms_id === 'string' && d.vesting_terms_id ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(typeof d.stock_class_id === 'string' && d.stock_class_id ? { stock_class_id: d.stock_class_id } : {}),
    ...(typeof d.stock_plan_id === 'string' && d.stock_plan_id ? { stock_plan_id: d.stock_plan_id } : {}),
    security_law_exemptions,
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };
}

export async function getEquityCompensationIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationIssuanceAsOcfParams
): Promise<GetEquityCompensationIssuanceAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationIssuance,
  });
  const data = extractAndDecodeDamlEntityData('equityCompensationIssuance', createArgument);
  const native = damlEquityCompensationIssuanceDataToNative(data);
  return { event: native, contractId: params.contractId };
}
