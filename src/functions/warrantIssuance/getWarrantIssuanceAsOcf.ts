import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfWarrantIssuanceEvent {
  object_type: 'TX_WARRANT_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  quantity: string;
  exercise_price: { amount: string; currency: string } | null;
  purchase_price: { amount: string; currency: string };
  exercise_triggers: Array<'AUTOMATIC' | 'OPTIONAL'>;
  warrant_expiration_date?: string;
  vesting_terms_id?: string;
  comments?: string[];
}

export interface GetWarrantIssuanceAsOcfParams { contractId: string }
export interface GetWarrantIssuanceAsOcfResult { event: OcfWarrantIssuanceEvent; contractId: string }

export async function getWarrantIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetWarrantIssuanceAsOcfParams
): Promise<GetWarrantIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) throw new Error('Missing createArgument for WarrantIssuance');
  const arg = created.createArgument as any;
  if (!('issuance_data' in arg)) throw new Error('Unexpected createArgument for WarrantIssuance');
  const d = (arg as any).issuance_data;

  const triggers = Array.isArray(d.exercise_triggers)
    ? (d.exercise_triggers as any[]).map((t: any) => {
        const v = typeof t === 'string' ? t : t?.tag || t;
        return String(v).startsWith('OcfTriggerTypeAutomatic') ? 'AUTOMATIC' : 'OPTIONAL';
      })
    : [];

  const event: OcfWarrantIssuanceEvent = {
    object_type: 'TX_WARRANT_ISSUANCE',
    id: d.ocf_id,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    quantity: typeof d.quantity === 'number' ? String(d.quantity) : d.quantity,
    exercise_price: d.exercise_price
      ? { amount: typeof d.exercise_price.amount === 'number' ? String(d.exercise_price.amount) : d.exercise_price.amount, currency: d.exercise_price.currency }
      : null,
    purchase_price: { amount: typeof d.purchase_price.amount === 'number' ? String(d.purchase_price.amount) : d.purchase_price.amount, currency: d.purchase_price.currency },
    exercise_triggers: triggers,
    ...(d.warrant_expiration_date ? { warrant_expiration_date: (d.warrant_expiration_date as string).split('T')[0] } : {}),
    ...(d.vesting_terms_id ? { vesting_terms_id: d.vesting_terms_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };

  return { event, contractId: params.contractId };
}


