import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpValidationError } from '../../../errors';
import type {
  CompensationType,
  OcfEquityCompensationIssuance,
  PeriodType,
  TerminationWindowReason,
  Vesting,
} from '../../../types/native';
import { damlMonetaryToNativeWithValidation, normalizeNumericString } from '../../../utils/typeConversions';

export interface GetEquityCompensationIssuanceAsOcfParams {
  contractId: string;
}
export interface GetEquityCompensationIssuanceAsOcfResult {
  event: OcfEquityCompensationIssuance & { object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' };
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
const twMapReason: Record<string, TerminationWindowReason> = {
  OcfTermVoluntaryOther: 'VOLUNTARY_OTHER',
  OcfTermVoluntaryGoodCause: 'VOLUNTARY_GOOD_CAUSE',
  OcfTermVoluntaryRetirement: 'VOLUNTARY_RETIREMENT',
  OcfTermInvoluntaryOther: 'INVOLUNTARY_OTHER',
  OcfTermInvoluntaryDeath: 'INVOLUNTARY_DEATH',
  OcfTermInvoluntaryDisability: 'INVOLUNTARY_DISABILITY',
  OcfTermInvoluntaryWithCause: 'INVOLUNTARY_WITH_CAUSE',
};

// Termination window period type DAML→OCF mapping
const twMapPeriodType: Record<string, PeriodType> = {
  OcfPeriodDays: 'DAYS',
  OcfPeriodMonths: 'MONTHS',
};

/**
 * Converts DAML equity compensation issuance data to native OCF format.
 * Used by both getEquityCompensationIssuanceAsOcf and the damlToOcf dispatcher.
 */
export function damlEquityCompensationIssuanceDataToNative(d: Record<string, unknown>): OcfEquityCompensationIssuance {
  const exercise_price = damlMonetaryToNativeWithValidation(
    d.exercise_price as Record<string, unknown> | null | undefined
  );
  const base_price = damlMonetaryToNativeWithValidation(d.base_price as Record<string, unknown> | null | undefined);

  const vestings =
    Array.isArray(d.vestings) && d.vestings.length > 0
      ? ((d.vestings as Array<{ date: string; amount?: unknown }>).map((v) => {
          // Validate vesting amount
          if (typeof v.amount !== 'string' && typeof v.amount !== 'number') {
            throw new OcpValidationError('vesting.amount', `Must be string or number, got ${typeof v.amount}`, {
              code: OcpErrorCodes.INVALID_TYPE,
              expectedType: 'string | number',
              receivedValue: v.amount,
            });
          }
          // Convert to string after validation
          const amountStr = typeof v.amount === 'number' ? v.amount.toString() : v.amount;
          return {
            date: v.date.split('T')[0],
            amount: normalizeNumericString(amountStr),
          };
        }) as Vesting[])
      : undefined;

  const termination_exercise_windows =
    Array.isArray(d.termination_exercise_windows) && d.termination_exercise_windows.length > 0
      ? (d.termination_exercise_windows as Array<{ reason: string; period: string | number; period_type: string }>).map(
          (w) => ({
            reason: twMapReason[w.reason] ?? 'VOLUNTARY_OTHER',
            period: typeof w.period === 'string' ? Number(w.period) : w.period,
            period_type: twMapPeriodType[w.period_type],
          })
        )
      : undefined;

  const comments = Array.isArray(d.comments) && d.comments.length > 0 ? (d.comments as string[]) : undefined;

  // Validate required fields
  if (typeof d.id !== 'string' || !d.id) {
    throw new OcpValidationError('equityCompensationIssuance.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.id,
    });
  }
  if (typeof d.date !== 'string' || !d.date) {
    throw new OcpValidationError('equityCompensationIssuance.date', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: d.date,
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
  if (typeof d.compensation_type !== 'string' || !d.compensation_type) {
    throw new OcpValidationError(
      'equityCompensationIssuance.compensation_type',
      'Required field is missing or invalid',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: d.compensation_type,
      }
    );
  }
  if (d.quantity === undefined || d.quantity === null) {
    throw new OcpValidationError('equityCompensationIssuance.quantity', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
  if (typeof d.quantity !== 'string' && typeof d.quantity !== 'number') {
    throw new OcpValidationError(
      'equityCompensationIssuance.quantity',
      `Must be string or number, got ${typeof d.quantity}`,
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'string | number',
        receivedValue: d.quantity,
      }
    );
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

  // Map security_law_exemptions if present
  const security_law_exemptions =
    Array.isArray(d.security_law_exemptions) && d.security_law_exemptions.length > 0
      ? (d.security_law_exemptions as Array<{ description: string; jurisdiction: string }>).map((ex) => ({
          description: ex.description,
          jurisdiction: ex.jurisdiction,
        }))
      : undefined;

  return {
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    compensation_type: compensationType,
    quantity: normalizeNumericString(typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity),
    ...(d.expiration_date ? { expiration_date: (d.expiration_date as string).split('T')[0] } : {}),
    ...(termination_exercise_windows ? { termination_exercise_windows } : {}),
    ...(exercise_price ? { exercise_price } : {}),
    ...(base_price ? { base_price } : {}),
    ...(d.early_exercisable !== null && d.early_exercisable !== undefined
      ? { early_exercisable: Boolean(d.early_exercisable) }
      : {}),
    ...(d.board_approval_date ? { board_approval_date: (d.board_approval_date as string).split('T')[0] } : {}),
    ...(d.stockholder_approval_date
      ? { stockholder_approval_date: (d.stockholder_approval_date as string).split('T')[0] }
      : {}),
    ...(typeof d.consideration_text === 'string' && d.consideration_text
      ? { consideration_text: d.consideration_text }
      : {}),
    ...(typeof d.vesting_terms_id === 'string' && d.vesting_terms_id ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(typeof d.stock_class_id === 'string' && d.stock_class_id ? { stock_class_id: d.stock_class_id } : {}),
    ...(typeof d.stock_plan_id === 'string' && d.stock_plan_id ? { stock_plan_id: d.stock_plan_id } : {}),
    ...(security_law_exemptions ? { security_law_exemptions } : {}),
    ...(vestings ? { vestings } : {}),
    ...(comments ? { comments } : {}),
  };
}

export async function getEquityCompensationIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationIssuanceAsOcfParams
): Promise<GetEquityCompensationIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const arg = res.created.createdEvent.createArgument as Record<string, unknown>;
  const d = (arg.issuance_data ?? arg) as Record<string, unknown>;

  const native = damlEquityCompensationIssuanceDataToNative(d);
  // Add object_type to create the full event type
  const event = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
    ...native,
  };

  return { event, contractId: params.contractId };
}
