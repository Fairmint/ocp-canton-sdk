import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

type ConversionTriggerType =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_IN_RANGE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_AT_WILL'
  | 'UNSPECIFIED';

type CustomConversionMechanism = {
  type: 'CUSTOM_CONVERSION';
  custom_conversion_description: string;
};

type SafeConversionMechanism = {
  type: 'SAFE_CONVERSION';
  conversion_mfn: boolean;
};

type ConvertibleConversionRight = {
  type: 'CONVERTIBLE_CONVERSION_RIGHT';
  conversion_mechanism: CustomConversionMechanism | SafeConversionMechanism;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
};

type ConversionTrigger = {
  type: ConversionTriggerType;
  trigger_id: string;
  conversion_right: ConvertibleConversionRight;
  nickname?: string;
  trigger_description?: string;
  // Optional fields for specific trigger subtypes
  trigger_date?: string;
  trigger_condition?: string;
};

export interface OcfConvertibleIssuanceEvent {
  object_type: 'TX_CONVERTIBLE_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  investment_amount: { amount: string; currency: string };
  convertible_type: 'NOTE' | 'SAFE' | 'SECURITY';
  conversion_triggers: ConversionTrigger[];
  pro_rata?: string;
  seniority: number;
  security_law_exemptions?: Array<{ description: string; jurisdiction: string }>;
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

  const convertTriggers = (
    ts: unknown[] | undefined,
    convertibleType: 'NOTE' | 'SAFE' | 'SECURITY',
    ocfId: string
  ): ConversionTrigger[] => {
    if (!Array.isArray(ts)) return [];
    const defaultRightForType = (): ConvertibleConversionRight => {
      if (convertibleType === 'SAFE') {
        return {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
          converts_to_future_round: true
        };
      }
      return {
        type: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'CUSTOM_CONVERSION',
          custom_conversion_description: 'UNSPECIFIED'
        }
      };
    };
    const mapTagToType = (tag: string): ConversionTriggerType => {
      if (tag === 'OcfTriggerAutomaticOnDate') return 'AUTOMATIC_ON_DATE';
      if (tag === 'OcfTriggerElectiveInRange') return 'ELECTIVE_IN_RANGE';
      if (tag === 'OcfTriggerElectiveOnCondition') return 'ELECTIVE_ON_CONDITION';
      if (tag === 'OcfTriggerElectiveAtWill') return 'ELECTIVE_AT_WILL';
      if (tag === 'OcfTriggerUnspecified') return 'UNSPECIFIED';
      // Default automatic mapping
      return 'AUTOMATIC_ON_CONDITION';
    };

    return ts.map((raw, idx) => {
      const tag = typeof raw === 'string' ? raw : (raw as any)?.tag || String(raw);
      const type: ConversionTriggerType = mapTagToType(String(tag));
      const trigger: ConversionTrigger = {
        type,
        trigger_id: `${ocfId}-trigger-${idx + 1}`,
        conversion_right: defaultRightForType(),
      };
      if (type === 'AUTOMATIC_ON_CONDITION') {
        trigger.trigger_description = 'Automatic conversion upon specified condition';
        trigger.trigger_condition = 'UNSPECIFIED';
      }
      return trigger;
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
    conversion_triggers: convertTriggers(
      d.conversion_triggers as unknown[],
      typeMap[(d.convertible_type as string) || 'OcfConvertibleNote'],
      d.ocf_id as string
    ),
    ...(d.pro_rata !== null && d.pro_rata !== undefined ? { pro_rata: typeof d.pro_rata === 'number' ? String(d.pro_rata) : d.pro_rata } : {}),
    seniority: typeof d.seniority === 'number' ? d.seniority : Number(d.seniority),
    ...(Array.isArray(d.security_law_exemptions) && d.security_law_exemptions.length > 0
      ? { security_law_exemptions: d.security_law_exemptions as Array<{ description: string; jurisdiction: string }> }
      : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {})
  };

  return { event, contractId: params.contractId };
}


