import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  CompensationType,
  OcfEquityCompensationIssuance,
  PeriodType,
  TerminationWindowReason,
} from '../../../types/native';
import { assertSafeGeneratedDamlJson } from '../../../utils/generatedDamlValidation';
import {
  damlTimeToDateString,
  isRecord,
  nonEmptyArrayOrUndefined,
  nullableDamlTimeToDateString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { parseDamlNumeric10 } from '../shared/damlNumerics';
import { readSingleContract } from '../shared/singleContractRead';
import { validateEquityCompensationPricingFromDaml } from './equityCompensationPricing';

export type DamlEquityCompensationIssuanceData = DamlDataTypeFor<'equityCompensationIssuance'>;

export interface GetEquityCompensationIssuanceAsOcfParams extends GetByContractIdParams {}
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

function requireCollectionRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new OcpValidationError(fieldPath, 'Must be an object', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'object',
      receivedValue: value,
    });
  }
  return value;
}

function requireCollectionString(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function requireCollectionText(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function requireEntityString(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw new OcpValidationError(fieldPath, 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  if (typeof value !== 'string') {
    throw new OcpValidationError(fieldPath, 'Must be a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'string',
      receivedValue: value,
    });
  }
  return value;
}

function optionalCollection(value: unknown, fieldPath: string): unknown[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new OcpValidationError(fieldPath, 'Must be an array', {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'array | null',
      receivedValue: value,
    });
  }
  return value.length > 0 ? value : undefined;
}

/**
 * Converts DAML equity compensation issuance data to native OCF format.
 * Used by both getEquityCompensationIssuanceAsOcf and the damlToOcf dispatcher.
 */
export function damlEquityCompensationIssuanceDataToNative(
  input: DamlEquityCompensationIssuanceData
): OcfEquityCompensationIssuance {
  const d = decodeDamlEntityData('equityCompensationIssuance', input);

  assertSafeGeneratedDamlJson(d.vestings, 'equityCompensationIssuance.vestings');
  const vestings = nonEmptyArrayOrUndefined(d.vestings, 'equityCompensationIssuance.vestings', (vesting, { index }) => {
    const fieldPath = `equityCompensationIssuance.vestings[${index}]`;
    if (!isRecord(vesting)) {
      throw new OcpValidationError(fieldPath, 'Must be an object', {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'object',
        receivedValue: vesting,
      });
    }
    if (typeof vesting.amount !== 'string' && typeof vesting.amount !== 'number') {
      throw new OcpValidationError(`${fieldPath}.amount`, `Must be string or number, got ${typeof vesting.amount}`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: vesting.amount,
      });
    }
    return {
      date: damlTimeToDateString(vesting.date, `${fieldPath}.date`),
      amount: parseDamlNumeric10(vesting.amount, `${fieldPath}.amount`),
    };
  });

  const terminationWindows = optionalCollection(
    d.termination_exercise_windows,
    'equityCompensationIssuance.termination_exercise_windows'
  );
  const termination_exercise_windows = terminationWindows
    ? terminationWindows.map((rawWindow, index) => {
        const windowPath = `equityCompensationIssuance.termination_exercise_windows[${index}]`;
        const window = requireCollectionRecord(rawWindow, windowPath);
        const reasonValue = requireCollectionString(window.reason, `${windowPath}.reason`);
        const reason = twMapReason[reasonValue];
        if (!reason) {
          throw new OcpValidationError(`${windowPath}.reason`, `Unknown reason: ${reasonValue}`, {
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
            receivedValue: reasonValue,
          });
        }
        const periodTypeValue = requireCollectionString(window.period_type, `${windowPath}.period_type`);
        const periodType = twMapPeriodType[periodTypeValue];
        if (!periodType) {
          throw new OcpValidationError(`${windowPath}.period_type`, `Unknown period_type: ${periodTypeValue}`, {
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
            receivedValue: periodTypeValue,
          });
        }
        return {
          reason,
          period: parseDamlSafeInteger(window.period, `${windowPath}.period`),
          period_type: periodType,
        };
      })
    : undefined;

  const comments = d.comments.length > 0 ? d.comments : undefined;

  // Validate required fields
  const id = requireEntityString(d.id, 'equityCompensationIssuance.id');
  const securityId = requireEntityString(d.security_id, 'equityCompensationIssuance.security_id');
  const customId = requireEntityString(d.custom_id, 'equityCompensationIssuance.custom_id');
  const stakeholderId = requireEntityString(d.stakeholder_id, 'equityCompensationIssuance.stakeholder_id');
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
  const pricing = validateEquityCompensationPricingFromDaml(
    compensationType,
    d.exercise_price,
    d.base_price,
    'equityCompensationIssuance'
  );

  // Map security_law_exemptions if present
  const securityLawExemptions = optionalCollection(
    d.security_law_exemptions,
    'equityCompensationIssuance.security_law_exemptions'
  );
  const security_law_exemptions = securityLawExemptions
    ? securityLawExemptions.map((rawExemption, index) => {
        const exemptionPath = `equityCompensationIssuance.security_law_exemptions[${index}]`;
        const exemption = requireCollectionRecord(rawExemption, exemptionPath);
        return {
          description: requireCollectionText(exemption.description, `${exemptionPath}.description`),
          jurisdiction: requireCollectionText(exemption.jurisdiction, `${exemptionPath}.jurisdiction`),
        };
      })
    : undefined;

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
    id,
    date: damlTimeToDateString(d.date, 'equityCompensationIssuance.date'),
    security_id: securityId,
    custom_id: customId,
    stakeholder_id: stakeholderId,
    ...pricing,
    quantity: parseDamlNumeric10(d.quantity, 'equityCompensationIssuance.quantity'),
    expiration_date: nullableDamlTimeToDateString(d.expiration_date, 'equityCompensationIssuance.expiration_date'),
    termination_exercise_windows: termination_exercise_windows ?? [],
    ...(d.early_exercisable !== null ? { early_exercisable: d.early_exercisable } : {}),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(typeof d.consideration_text === 'string' ? { consideration_text: d.consideration_text } : {}),
    ...(typeof d.vesting_terms_id === 'string' ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(typeof d.stock_class_id === 'string' ? { stock_class_id: d.stock_class_id } : {}),
    ...(typeof d.stock_plan_id === 'string' ? { stock_plan_id: d.stock_plan_id } : {}),
    security_law_exemptions: security_law_exemptions ?? [],
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };
}

export async function getEquityCompensationIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationIssuanceAsOcfParams
): Promise<GetEquityCompensationIssuanceAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getEquityCompensationIssuanceAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.equityCompensationIssuance,
  });
  const native = damlEquityCompensationIssuanceDataToNative(
    extractAndDecodeDamlEntityData('equityCompensationIssuance', createArgument)
  );
  return { event: native, contractId };
}
