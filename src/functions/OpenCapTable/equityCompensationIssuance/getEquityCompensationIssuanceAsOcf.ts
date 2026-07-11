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
  normalizeOcfNumericString,
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

function requiredString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcpValidationError(fieldPath, 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function optionalString(value: unknown, fieldPath: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Optional field must be a string when present', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string or null',
      receivedValue: value,
    });
  }
  return value;
}

function optionalBoolean(value: unknown, fieldPath: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new OcpValidationError(fieldPath, 'Optional field must be a boolean when present', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'boolean or null',
      receivedValue: value,
    });
  }
  return value;
}

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
      amount: normalizeOcfNumericString(vesting.amount, `equityCompensationIssuance.vestings[${index}].amount`),
    })),
    'equityCompensationIssuance.vestings'
  );

  const termination_exercise_windows =
    d.termination_exercise_windows.length > 0
      ? d.termination_exercise_windows.map((window, index) => {
          const reason = twMapReason[window.reason];
          if (!reason) {
            throw new OcpValidationError(
              `equityCompensationIssuance.termination_exercise_windows[${index}].reason`,
              `Unknown reason: ${window.reason}`,
              {
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
                receivedValue: window.reason,
              }
            );
          }
          const periodType = twMapPeriodType[window.period_type];
          if (!periodType) {
            throw new OcpValidationError(
              `equityCompensationIssuance.termination_exercise_windows[${index}].period_type`,
              `Unknown period_type: ${window.period_type}`,
              {
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
                receivedValue: window.period_type,
              }
            );
          }
          const period = parseDamlSafeInteger(
            window.period,
            `equityCompensationIssuance.termination_exercise_windows[${index}].period`,
            'int'
          );
          return { reason, period, period_type: periodType };
        })
      : undefined;

  const comments =
    d.comments.length > 0
      ? d.comments.map((comment, index) => requiredString(comment, `equityCompensationIssuance.comments[${index}]`))
      : undefined;

  // Validate required fields
  const id = requiredString(d.id, 'equityCompensationIssuance.id');
  const securityId = requiredString(d.security_id, 'equityCompensationIssuance.security_id');
  const customId = requiredString(d.custom_id, 'equityCompensationIssuance.custom_id');
  const stakeholderId = requiredString(d.stakeholder_id, 'equityCompensationIssuance.stakeholder_id');
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
  const security_law_exemptions = d.security_law_exemptions.map((exemption, index) => ({
    description: requiredString(
      exemption.description,
      `equityCompensationIssuance.security_law_exemptions[${index}].description`
    ),
    jurisdiction: requiredString(
      exemption.jurisdiction,
      `equityCompensationIssuance.security_law_exemptions[${index}].jurisdiction`
    ),
  }));

  const boardApprovalDate = optionalDamlTimeToDateString(
    d.board_approval_date,
    'equityCompensationIssuance.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'equityCompensationIssuance.stockholder_approval_date'
  );
  const considerationText = optionalString(d.consideration_text, 'equityCompensationIssuance.consideration_text');
  const vestingTermsId = optionalString(d.vesting_terms_id, 'equityCompensationIssuance.vesting_terms_id');
  const stockClassId = optionalString(d.stock_class_id, 'equityCompensationIssuance.stock_class_id');
  const stockPlanId = optionalString(d.stock_plan_id, 'equityCompensationIssuance.stock_plan_id');
  const earlyExercisable = optionalBoolean(d.early_exercisable, 'equityCompensationIssuance.early_exercisable');

  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id,
    date: damlTimeToDateString(d.date, 'equityCompensationIssuance.date'),
    security_id: securityId,
    custom_id: customId,
    stakeholder_id: stakeholderId,
    ...pricing,
    quantity: normalizeOcfNumericString(d.quantity, 'equityCompensationIssuance.quantity'),
    expiration_date: nullableDamlTimeToDateString(d.expiration_date, 'equityCompensationIssuance.expiration_date'),
    termination_exercise_windows: termination_exercise_windows ?? [],
    ...(earlyExercisable !== undefined ? { early_exercisable: earlyExercisable } : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(considerationText !== undefined ? { consideration_text: considerationText } : {}),
    ...(vestingTermsId !== undefined ? { vesting_terms_id: vestingTermsId } : {}),
    ...(stockClassId !== undefined ? { stock_class_id: stockClassId } : {}),
    ...(stockPlanId !== undefined ? { stock_plan_id: stockPlanId } : {}),
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
