import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

export interface OcfConvertibleIssuanceEvent {
  object_type: 'TX_CONVERTIBLE_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  investment_amount: { amount: string; currency: string };
  convertible_type: 'NOTE' | 'SAFE' | 'SECURITY';
  conversion_triggers: Array<'AUTOMATIC' | 'OPTIONAL'>;
  pro_rata?: string;
  seniority: string;
  comments?: string[];
}

export interface GetConvertibleIssuanceAsOcfParams {
  contractId: string;
}

export interface GetConvertibleIssuanceAsOcfResult {
  event: OcfConvertibleIssuanceEvent;
  contractId: string;
}

/**
 * Retrieve a ConvertibleIssuance contract and return it as an OCF JSON object
 */
export async function getConvertibleIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleIssuanceAsOcfParams
): Promise<GetConvertibleIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) {
    throw new Error('Missing createArgument for ConvertibleIssuance');
  }

  const arg = created.createArgument as any;
  function hasIssuanceData(a: unknown): a is { issuance_data: any } {
    return !!a && typeof a === 'object' && 'issuance_data' in (a as any);
  }
  if (!hasIssuanceData(arg)) throw new Error('Unexpected createArgument for ConvertibleIssuance');
  const d = arg.issuance_data as any;

  const typeMap: Record<string, 'NOTE' | 'SAFE' | 'SECURITY'> = {
    OcfConvertibleNote: 'NOTE',
    OcfConvertibleSafe: 'SAFE',
    OcfConvertibleSecurity: 'SECURITY'
  };

  const convertTriggers = (ts: any[] | undefined): Array<'AUTOMATIC' | 'OPTIONAL'> => {
    if (!Array.isArray(ts)) return [];
    return ts.map((t: any) => {
      const v = typeof t === 'string' ? t : t?.tag || t;
      return String(v).startsWith('OcfTriggerAutomatic') ? 'AUTOMATIC' : 'OPTIONAL';
    });
  };

  const event: OcfConvertibleIssuanceEvent = {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: d.ocf_id,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    investment_amount: {
      amount: typeof d.investment_amount?.amount === 'number' ? String(d.investment_amount.amount) : d.investment_amount.amount,
      currency: d.investment_amount.currency
    },
    convertible_type: typeMap[(d.convertible_type as string) || 'OcfConvertibleNote'],
    conversion_triggers: convertTriggers(d.conversion_triggers),
    ...(d.pro_rata !== null && d.pro_rata !== undefined ? { pro_rata: typeof d.pro_rata === 'number' ? String(d.pro_rata) : d.pro_rata } : {}),
    seniority: typeof d.seniority === 'number' ? String(d.seniority) : d.seniority,
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };

  return { event, contractId: params.contractId };
}


