import type { Vesting } from '../../types/native';
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfEquityCompensationIssuanceEvent {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  compensation_type: 'OPTION_NSO' | 'OPTION_ISO' | 'OPTION' | 'RSU' | 'CSAR' | 'SSAR';
  quantity: string;
  exercise_price?: { amount: string; currency: string };
  base_price?: { amount: string; currency: string };
  early_exercisable?: boolean;
  expiration_date?: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  consideration_text?: string;
  vesting_terms_id?: string;
  stock_class_id?: string;
  stock_plan_id?: string;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  termination_exercise_windows?: Array<{
    reason: string;
    period: number;
    period_type: 'DAYS' | 'MONTHS';
  }>;
  comments?: string[];
  vestings?: Vesting[];
}

export interface GetEquityCompensationIssuanceEventAsOcfParams {
  contractId: string;
}
export interface GetEquityCompensationIssuanceEventAsOcfResult {
  event: OcfEquityCompensationIssuanceEvent;
  contractId: string;
}

export async function getEquityCompensationIssuanceEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationIssuanceEventAsOcfParams
): Promise<GetEquityCompensationIssuanceEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as Record<string, unknown>;
  const d = (arg.issuance_data ?? arg) as Record<string, unknown>;

  const compMap: Record<string, OcfEquityCompensationIssuanceEvent['compensation_type']> = {
    OcfCompensationTypeOptionNSO: 'OPTION_NSO',
    OcfCompensationTypeOptionISO: 'OPTION_ISO',
    OcfCompensationTypeOption: 'OPTION',
    OcfCompensationTypeRSU: 'RSU',
    OcfCompensationTypeCSAR: 'CSAR',
    OcfCompensationTypeSSAR: 'SSAR',
  };

  const twMapReason: Record<string, string> = {
    OcfTermVoluntaryOther: 'VOLUNTARY_OTHER',
    OcfTermVoluntaryGoodCause: 'VOLUNTARY_GOOD_CAUSE',
    OcfTermVoluntaryRetirement: 'VOLUNTARY_RETIREMENT',
    OcfTermInvoluntaryOther: 'INVOLUNTARY_OTHER',
    OcfTermInvoluntaryDeath: 'INVOLUNTARY_DEATH',
    OcfTermInvoluntaryDisability: 'INVOLUNTARY_DISABILITY',
    OcfTermInvoluntaryWithCause: 'INVOLUNTARY_WITH_CAUSE',
  };
  const twMapPeriodType: Record<string, 'DAYS' | 'MONTHS'> = {
    OcfPeriodDays: 'DAYS',
    OcfPeriodMonths: 'MONTHS',
  };

  const mapMonetary = (price: unknown): { amount: string; currency: string } | undefined => {
    if (!price || typeof price !== 'object') return undefined;
    const p = price as Record<string, unknown>;
    const amount = typeof p.amount === 'number' ? String(p.amount) : String(p.amount);
    const currency = String(p.currency);
    return { amount, currency };
  };

  const exercise_price = d.exercise_price ? mapMonetary(d.exercise_price) : undefined;
  const base_price = d.base_price ? mapMonetary(d.base_price) : undefined;

  const vestings =
    Array.isArray(d.vestings) && d.vestings.length > 0
      ? ((d.vestings as Array<{ date: string; amount: string | number }>).map((v) => ({
          date: v.date.split('T')[0],
          amount: typeof v.amount === 'number' ? String(v.amount) : String(v.amount),
        })) as Vesting[])
      : undefined;

  const termination_exercise_windows =
    Array.isArray(d.termination_exercise_windows) && d.termination_exercise_windows.length > 0
      ? (d.termination_exercise_windows as Array<{ reason: string; period: string | number; period_type: string }>).map(
          (w) => ({
            reason: twMapReason[w.reason] || 'VOLUNTARY_OTHER',
            period: typeof w.period === 'string' ? Number(w.period) : w.period,
            period_type: twMapPeriodType[w.period_type],
          })
        )
      : undefined;

  const comments = Array.isArray(d.comments) && d.comments.length > 0 ? (d.comments as string[]) : undefined;

  const event: OcfEquityCompensationIssuanceEvent = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: String(d.id),
    date: (d.date as string).split('T')[0],
    security_id: String(d.security_id),
    custom_id: String(d.custom_id),
    stakeholder_id: String(d.stakeholder_id),
    compensation_type: compMap[(d.compensation_type as string) || 'OcfCompensationTypeOption'],
    quantity: typeof d.quantity === 'number' ? String(d.quantity) : String(d.quantity),
    ...(exercise_price ? { exercise_price } : {}),
    ...(base_price ? { base_price } : {}),
    ...(d.early_exercisable !== null && d.early_exercisable !== undefined
      ? { early_exercisable: !!d.early_exercisable }
      : {}),
    ...(d.expiration_date ? { expiration_date: (d.expiration_date as string).split('T')[0] } : {}),
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
    security_law_exemptions: (d.security_law_exemptions as Array<{ description: string; jurisdiction: string }>).map(
      (ex) => ({
        description: ex.description,
        jurisdiction: ex.jurisdiction,
      })
    ),
    ...(vestings ? { vestings } : {}),
    ...(termination_exercise_windows ? { termination_exercise_windows } : {}),
    ...(comments ? { comments } : {}),
  };

  return { event, contractId: params.contractId };
}
