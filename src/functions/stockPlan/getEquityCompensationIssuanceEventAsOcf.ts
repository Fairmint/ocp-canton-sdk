import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Vesting } from '../../types/native';

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
  termination_exercise_windows?: Array<{ reason: string; period: number; period_type: 'DAYS' | 'MONTHS' }>;
  comments?: string[];
  vestings?: Vesting[];
}

export interface GetEquityCompensationIssuanceEventAsOcfParams { contractId: string }
export interface GetEquityCompensationIssuanceEventAsOcfResult { event: OcfEquityCompensationIssuanceEvent; contractId: string }

export async function getEquityCompensationIssuanceEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetEquityCompensationIssuanceEventAsOcfParams
): Promise<GetEquityCompensationIssuanceEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const d = arg.issuance_data || arg;

  const compMap: Record<string, OcfEquityCompensationIssuanceEvent['compensation_type']> = {
    OcfCompensationTypeOptionNSO: 'OPTION_NSO',
    OcfCompensationTypeOptionISO: 'OPTION_ISO',
    OcfCompensationTypeOption: 'OPTION',
    OcfCompensationTypeRSU: 'RSU',
    OcfCompensationTypeCSAR: 'CSAR',
    OcfCompensationTypeSSAR: 'SSAR'
  };

  const twMapReason: Record<string, string> = {
    OcfTermVoluntaryOther: 'VOLUNTARY_OTHER',
    OcfTermVoluntaryGoodCause: 'VOLUNTARY_GOOD_CAUSE',
    OcfTermVoluntaryRetirement: 'VOLUNTARY_RETIREMENT',
    OcfTermInvoluntaryOther: 'INVOLUNTARY_OTHER',
    OcfTermInvoluntaryDeath: 'INVOLUNTARY_DEATH',
    OcfTermInvoluntaryDisability: 'INVOLUNTARY_DISABILITY',
    OcfTermInvoluntaryWithCause: 'INVOLUNTARY_WITH_CAUSE'
  };
  const twMapPeriodType: Record<string, 'DAYS' | 'MONTHS'> = {
    OcfPeriodDays: 'DAYS',
    OcfPeriodMonths: 'MONTHS'
  };

  const event: OcfEquityCompensationIssuanceEvent = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: (d as any).id,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    compensation_type: compMap[(d.compensation_type as string) || 'OcfCompensationTypeOption'],
    quantity: typeof d.quantity === 'number' ? String(d.quantity) : d.quantity,
    ...(d.exercise_price ? { exercise_price: { amount: typeof d.exercise_price.amount === 'number' ? String(d.exercise_price.amount) : d.exercise_price.amount, currency: d.exercise_price.currency } } : {}),
    ...(d.base_price ? { base_price: { amount: typeof d.base_price.amount === 'number' ? String(d.base_price.amount) : d.base_price.amount, currency: d.base_price.currency } } : {}),
    ...(d.early_exercisable !== null && d.early_exercisable !== undefined ? { early_exercisable: !!d.early_exercisable } : {}),
    ...(d.expiration_date ? { expiration_date: (d.expiration_date as string).split('T')[0] } : {}),
    ...(d.board_approval_date ? { board_approval_date: (d.board_approval_date as string).split('T')[0] } : {}),
    ...(d.stockholder_approval_date ? { stockholder_approval_date: (d.stockholder_approval_date as string).split('T')[0] } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(d.vesting_terms_id ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(d.stock_class_id ? { stock_class_id: d.stock_class_id } : {}),
    ...(d.stock_plan_id ? { stock_plan_id: d.stock_plan_id } : {}),
    security_law_exemptions: (d.security_law_exemptions as any[]).map((ex: any) => ({ description: ex.description, jurisdiction: ex.jurisdiction })),
    ...(d.vestings.length
      ? { vestings: (d.vestings as any[]).map((v: any) => ({
          date: (v.date as string).split('T')[0],
          amount: typeof v.amount === 'number' ? String(v.amount) : v.amount
        })) as Vesting[] }
      : {}),
    ...(d.termination_exercise_windows.length
      ? { termination_exercise_windows: (d.termination_exercise_windows as any[]).map((w: any) => ({
          reason: twMapReason[w.reason] || 'VOLUNTARY_OTHER',
          period: typeof w.period === 'string' ? Number(w.period) : (w.period as number),
          period_type: twMapPeriodType[w.period_type]
        })) }
      : {}),
    ...(d.comments.length ? { comments: d.comments } : {})
  };

  return { event, contractId: params.contractId };
}


