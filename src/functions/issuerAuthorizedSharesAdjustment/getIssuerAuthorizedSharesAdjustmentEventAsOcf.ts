import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';

export interface OcfIssuerAuthorizedSharesAdjustmentEvent {
  object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT';
  id: string;
  date: string;
  issuer_id: string;
  new_shares_authorized: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams { contractId: string }
export interface GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult { event: OcfIssuerAuthorizedSharesAdjustmentEvent; contractId: string }

export async function getIssuerAuthorizedSharesAdjustmentEventAsOcf(
  client: LedgerJsonApiClient,
  params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
): Promise<GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent?.createArgument) throw new Error('Missing createArgument');
  const arg = res.created.createdEvent.createArgument as any;
  const d = arg.adjustment_data || arg;
  const event: OcfIssuerAuthorizedSharesAdjustmentEvent = {
    object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    id: (d as any).id,
    date: (d.date as string).split('T')[0],
    issuer_id: d.issuer_id,
    new_shares_authorized: typeof d.new_shares_authorized === 'number' ? String(d.new_shares_authorized) : d.new_shares_authorized,
    ...(d.board_approval_date ? { board_approval_date: (d.board_approval_date as string).split('T')[0] } : {}),
    ...(d.stockholder_approval_date ? { stockholder_approval_date: (d.stockholder_approval_date as string).split('T')[0] } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };
  return { event, contractId: params.contractId };
}


