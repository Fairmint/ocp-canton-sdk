import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { normalizeNumericString, safeString } from '../../../utils/typeConversions';

interface CapitalizationDefinitionRules {
  exclude_external_entities?: boolean;
  include_capital_in_ratio?: boolean;
}

type ConversionTriggerType =
  | 'AUTOMATIC_ON_CONDITION'
  | 'AUTOMATIC_ON_DATE'
  | 'ELECTIVE_IN_RANGE'
  | 'ELECTIVE_ON_CONDITION'
  | 'ELECTIVE_AT_WILL'
  | 'UNSPECIFIED';

interface CustomConversionMechanism {
  type: 'CUSTOM_CONVERSION';
  custom_conversion_description?: string;
}

interface SafeConversionMechanism {
  type: 'SAFE_CONVERSION';
  conversion_mfn: boolean;
  conversion_discount?: string;
  conversion_valuation_cap?: { amount: string; currency: string };
  conversion_timing?: 'PRE_MONEY' | 'POST_MONEY';
  capitalization_definition?: string;
  capitalization_definition_rules?: CapitalizationDefinitionRules;
  exit_multiple?: { numerator: string; denominator: string };
}

interface PercentCapitalizationMechanism {
  type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
  converts_to_percent: string;
  capitalization_definition?: string;
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

interface FixedAmountMechanism {
  type: 'FIXED_AMOUNT_CONVERSION';
  converts_to_quantity: string;
}

interface ValuationBasedMechanism {
  type: 'VALUATION_BASED_CONVERSION';
  valuation_type?: string;
  valuation_amount?: { amount: string; currency: string };
  capitalization_definition?: string;
  capitalization_definition_rules?: CapitalizationDefinitionRules;
}

interface SharePriceBasedMechanism {
  type: 'SHARE_PRICE_BASED_CONVERSION';
  description?: string;
  discount: boolean;
  discount_percentage?: string;
  discount_amount?: { amount: string; currency: string };
}

interface NoteConversionMechanism {
  type: 'CONVERTIBLE_NOTE_CONVERSION';
  interest_rates: Array<{
    rate: string;
    accrual_start_date: string;
    accrual_end_date?: string;
  }> | null;
  day_count_convention?: 'ACTUAL_365' | '30_360';
  interest_payout?: 'DEFERRED' | 'CASH';
  interest_accrual_period?: string;
  compounding_type?: string;
  conversion_discount?: string;
  conversion_valuation_cap?: { amount: string; currency: string };
  capitalization_definition?: string;
  capitalization_definition_rules?: CapitalizationDefinitionRules;
  exit_multiple?: { numerator: string; denominator: string } | null;
  conversion_mfn?: boolean;
}

interface ConvertibleConversionRight {
  type: 'CONVERTIBLE_CONVERSION_RIGHT';
  conversion_mechanism:
    | CustomConversionMechanism
    | SafeConversionMechanism
    | PercentCapitalizationMechanism
    | FixedAmountMechanism
    | ValuationBasedMechanism
    | SharePriceBasedMechanism
    | NoteConversionMechanism;
  converts_to_future_round?: boolean;
  converts_to_stock_class_id?: string;
}

interface ConversionTrigger {
  type: ConversionTriggerType;
  trigger_id: string;
  conversion_right: ConvertibleConversionRight;
  nickname?: string;
  trigger_description?: string;
  // Optional fields for specific trigger subtypes
  trigger_date?: string;
  trigger_condition?: string;
}

export interface OcfConvertibleIssuanceEvent {
  object_type: 'TX_CONVERTIBLE_ISSUANCE';
  id: string;
  date: string;
  security_id: string;
  custom_id: string;
  stakeholder_id: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  investment_amount: { amount: string; currency: string };
  consideration_text?: string;
  convertible_type: 'NOTE' | 'SAFE' | 'SECURITY';
  conversion_triggers: ConversionTrigger[];
  pro_rata?: string;
  seniority: number;
  security_law_exemptions: Array<{ description: string; jurisdiction: string }>;
  comments?: string[];
}

export interface GetConvertibleIssuanceAsOcfParams {
  contractId: string;
}

export interface GetConvertibleIssuanceAsOcfResult {
  event: OcfConvertibleIssuanceEvent;
  contractId: string;
}

/** Retrieve a ConvertibleIssuance contract and return it as an OCF JSON object */
export async function getConvertibleIssuanceAsOcf(
  client: LedgerJsonApiClient,
  params: GetConvertibleIssuanceAsOcfParams
): Promise<GetConvertibleIssuanceAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  const created = res.created?.createdEvent;
  if (!created?.createArgument) {
    throw new Error('Missing createArgument for ConvertibleIssuance');
  }

  const arg = created.createArgument;
  if (typeof arg !== 'object' || !('issuance_data' in arg)) {
    throw new Error('Unexpected createArgument for ConvertibleIssuance');
  }
  const d = (arg as { issuance_data: Record<string, unknown> }).issuance_data;

  const typeMap: Record<string, 'NOTE' | 'SAFE' | 'SECURITY'> = {
    OcfConvertibleNote: 'NOTE',
    OcfConvertibleSafe: 'SAFE',
    OcfConvertibleSecurity: 'SECURITY',
  };

  const convertTriggers = (
    ts: unknown[] | undefined,
    convertibleType: 'NOTE' | 'SAFE' | 'SECURITY',
    issuanceId: string
  ): ConversionTrigger[] => {
    if (!Array.isArray(ts)) return [];

    const mapTagToType = (tag: string): ConversionTriggerType => {
      if (tag === 'OcfTriggerTypeTypeAutomaticOnDate') return 'AUTOMATIC_ON_DATE';
      if (tag === 'OcfTriggerTypeTypeElectiveInRange') return 'ELECTIVE_IN_RANGE';
      if (tag === 'OcfTriggerTypeTypeElectiveOnCondition') return 'ELECTIVE_ON_CONDITION';
      if (tag === 'OcfTriggerTypeTypeElectiveAtWill') return 'ELECTIVE_AT_WILL';
      if (tag === 'OcfTriggerTypeTypeUnspecified') return 'UNSPECIFIED';
      return 'AUTOMATIC_ON_CONDITION';
    };

    const mapMechanism = (m: unknown): ConvertibleConversionRight['conversion_mechanism'] => {
      // Handle both string enum and DAML variant { tag, value }
      const mapMonetary = (mon: unknown): { amount: string; currency: string } | undefined => {
        if (!mon || typeof mon !== 'object') return undefined;
        const amount = normalizeNumericString(
          typeof (mon as Record<string, unknown>).amount === 'number'
            ? String((mon as Record<string, unknown>).amount)
            : String((mon as Record<string, unknown>).amount)
        );
        return {
          amount,
          currency: (mon as Record<string, unknown>).currency as string,
        };
      };
      const mapTiming = (t: unknown): 'PRE_MONEY' | 'POST_MONEY' | undefined => {
        const s = safeString(t);
        if (s.endsWith('PreMoney')) return 'PRE_MONEY';
        if (s.endsWith('PostMoney')) return 'POST_MONEY';
        return undefined;
      };

      if (typeof m === 'string') {
        throw new Error(`conversion_mechanism missing variant value (got tag '${m}')`);
      }

      if (m && typeof m === 'object') {
        const tag = (m as Record<string, unknown>).tag as string | undefined;
        const value = (m as Record<string, unknown>).value as Record<string, unknown> | undefined;
        if (!tag || !value) {
          throw new Error('Conversion mechanism tag and value are required');
        }
        switch (tag) {
          case 'OcfConvMechSAFE': {
            const mech: SafeConversionMechanism = {
              type: 'SAFE_CONVERSION',
              conversion_mfn: Boolean(value.conversion_mfn),
              ...(typeof value.conversion_discount === 'number' || typeof value.conversion_discount === 'string'
                ? {
                    conversion_discount: normalizeNumericString(String(value.conversion_discount)),
                  }
                : {}),
              ...(value.conversion_valuation_cap
                ? {
                    conversion_valuation_cap: mapMonetary(value.conversion_valuation_cap) ?? {
                      amount: '',
                      currency: '',
                    },
                  }
                : {}),
              ...(value.conversion_timing ? { conversion_timing: mapTiming(value.conversion_timing) } : {}),
              ...(value.capitalization_definition
                ? { capitalization_definition: value.capitalization_definition }
                : {}),
              ...(value.capitalization_definition_rules
                ? { capitalization_definition_rules: value.capitalization_definition_rules }
                : {}),
              ...(value.exit_multiple
                ? {
                    exit_multiple: {
                      numerator: normalizeNumericString(
                        String((value.exit_multiple as Record<string, unknown>).numerator)
                      ),
                      denominator: normalizeNumericString(
                        String((value.exit_multiple as Record<string, unknown>).denominator)
                      ),
                    },
                  }
                : {}),
            } as SafeConversionMechanism;
            return mech;
          }
          case 'OcfConvMechPercentCapitalization': {
            const mech: PercentCapitalizationMechanism = {
              type: 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION',
              converts_to_percent: normalizeNumericString(
                typeof value.converts_to_percent === 'number'
                  ? String(value.converts_to_percent)
                  : String(value.converts_to_percent)
              ),
              ...(value.capitalization_definition
                ? { capitalization_definition: value.capitalization_definition }
                : {}),
              ...(value.capitalization_definition_rules
                ? { capitalization_definition_rules: value.capitalization_definition_rules }
                : {}),
            } as PercentCapitalizationMechanism;
            return mech;
          }
          case 'OcfConvMechFixedAmount': {
            const mech: FixedAmountMechanism = {
              type: 'FIXED_AMOUNT_CONVERSION',
              converts_to_quantity: normalizeNumericString(
                typeof value.converts_to_quantity === 'number'
                  ? String(value.converts_to_quantity)
                  : String(value.converts_to_quantity)
              ),
            } as FixedAmountMechanism;
            return mech;
          }
          case 'OcfConvMechValuationBased': {
            const mech: ValuationBasedMechanism = {
              type: 'VALUATION_BASED_CONVERSION',
              valuation_type: value.valuation_type,
              ...(value.valuation_amount
                ? {
                    valuation_amount: mapMonetary(value.valuation_amount) ?? {
                      amount: '',
                      currency: '',
                    },
                  }
                : {}),
              ...(value.capitalization_definition
                ? { capitalization_definition: value.capitalization_definition }
                : {}),
              ...(value.capitalization_definition_rules
                ? { capitalization_definition_rules: value.capitalization_definition_rules }
                : {}),
            } as ValuationBasedMechanism;
            return mech;
          }
          case 'OcfConvMechSharePriceBased': {
            const mech: SharePriceBasedMechanism = {
              type: 'SHARE_PRICE_BASED_CONVERSION',
              description: value.description,
              discount: Boolean(value.discount),
              ...(value.discount_percentage !== undefined && value.discount_percentage !== null
                ? {
                    discount_percentage:
                      typeof value.discount_percentage === 'number'
                        ? String(value.discount_percentage)
                        : value.discount_percentage,
                  }
                : {}),
              ...(value.discount_amount
                ? {
                    discount_amount: mapMonetary(value.discount_amount) ?? {
                      amount: '',
                      currency: '',
                    },
                  }
                : {}),
            } as SharePriceBasedMechanism;
            return mech;
          }
          case 'OcfConvMechNote': {
            const interest_rates = Array.isArray(value.interest_rates)
              ? value.interest_rates.map((ir: unknown) => {
                  const irObj = ir as Record<string, unknown>;
                  return {
                    rate: normalizeNumericString(
                      typeof irObj.rate === 'number' ? String(irObj.rate) : String(irObj.rate)
                    ),
                    accrual_start_date: (irObj.accrual_start_date as string).split('T')[0],
                    ...(irObj.accrual_end_date
                      ? { accrual_end_date: (irObj.accrual_end_date as string).split('T')[0] }
                      : {}),
                  };
                })
              : null;
            const accrualFromDaml = (
              v: unknown
            ): 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | undefined => {
              const s = safeString(v);
              if (s.endsWith('OcfAccrualDaily') || s === 'OcfAccrualDaily') return 'DAILY';
              if (s.endsWith('OcfAccrualMonthly') || s === 'OcfAccrualMonthly') return 'MONTHLY';
              if (s.endsWith('OcfAccrualQuarterly') || s === 'OcfAccrualQuarterly') return 'QUARTERLY';
              if (s.endsWith('OcfAccrualSemiAnnual') || s === 'OcfAccrualSemiAnnual') return 'SEMI_ANNUAL';
              if (s.endsWith('OcfAccrualAnnual') || s === 'OcfAccrualAnnual') return 'ANNUAL';
              return undefined;
            };
            const compoundingFromDaml = (v: unknown): string | undefined => {
              const s = safeString(v);
              if (!s) return undefined;
              if (s === 'OcfSimple') return 'SIMPLE';
              if (s === 'OcfCompounding') return 'COMPOUNDING';
              throw new Error(`Unknown compounding_type: ${safeString(v)}`);
            };
            const mech: NoteConversionMechanism = {
              type: 'CONVERTIBLE_NOTE_CONVERSION',
              interest_rates,
              ...(value.day_count_convention
                ? {
                    day_count_convention: safeString(value.day_count_convention).endsWith('Actual365')
                      ? 'ACTUAL_365'
                      : '30_360',
                  }
                : {}),
              ...(value.interest_payout
                ? {
                    interest_payout: safeString(value.interest_payout).endsWith('Deferred') ? 'DEFERRED' : 'CASH',
                  }
                : {}),
              ...(value.interest_accrual_period
                ? { interest_accrual_period: accrualFromDaml(value.interest_accrual_period) }
                : {}),
              ...(value.compounding_type ? { compounding_type: compoundingFromDaml(value.compounding_type) } : {}),
              ...(typeof value.conversion_discount === 'number' || typeof value.conversion_discount === 'string'
                ? {
                    conversion_discount: normalizeNumericString(String(value.conversion_discount)),
                  }
                : {}),
              ...(value.conversion_valuation_cap
                ? {
                    conversion_valuation_cap: mapMonetary(value.conversion_valuation_cap) ?? {
                      amount: '',
                      currency: '',
                    },
                  }
                : {}),
              ...(value.capitalization_definition
                ? { capitalization_definition: value.capitalization_definition }
                : {}),
              ...(value.capitalization_definition_rules
                ? { capitalization_definition_rules: value.capitalization_definition_rules }
                : {}),
              ...(value.exit_multiple
                ? {
                    exit_multiple: {
                      numerator: normalizeNumericString(
                        String((value.exit_multiple as Record<string, unknown>).numerator)
                      ),
                      denominator: normalizeNumericString(
                        String((value.exit_multiple as Record<string, unknown>).denominator)
                      ),
                    },
                  }
                : {}),
              ...(value.conversion_mfn ? { conversion_mfn: Boolean(value.conversion_mfn) } : {}),
            } as NoteConversionMechanism;
            return mech;
          }
          case 'OcfConvMechCustom': {
            if (!value.custom_conversion_description) {
              throw new Error('CUSTOM_CONVERSION missing custom_conversion_description');
            }
            const mech: CustomConversionMechanism = {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: value.custom_conversion_description as string,
            };
            return mech;
          }
          default:
            throw new Error(`Unknown convertible conversion mechanism tag: ${String(tag)}`);
        }
      }

      throw new Error('Unknown conversion_mechanism shape');
    };

    return ts.map((raw, idx) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const tag =
        typeof r.type_ === 'string' ? r.type_ : typeof r.tag === 'string' ? r.tag : typeof raw === 'string' ? raw : '';
      const type: ConversionTriggerType = mapTagToType(String(tag));
      const trigger_id: string =
        typeof r.trigger_id === 'string' && r.trigger_id.length ? r.trigger_id : `${issuanceId}-trigger-${idx + 1}`;
      const nickname: string | undefined = typeof r.nickname === 'string' && r.nickname.length ? r.nickname : undefined;
      const trigger_description: string | undefined =
        typeof r.trigger_description === 'string' && r.trigger_description.length ? r.trigger_description : undefined;
      const trigger_date: string | undefined =
        typeof r.trigger_date === 'string' && r.trigger_date.length ? r.trigger_date.split('T')[0] : undefined;
      const trigger_condition: string | undefined =
        typeof r.trigger_condition === 'string' && r.trigger_condition.length ? r.trigger_condition : undefined;

      // Parse conversion_right if present and convertible variant is used
      let conversion_right: ConvertibleConversionRight | undefined;
      if (r.conversion_right && typeof r.conversion_right === 'object' && 'OcfRightConvertible' in r.conversion_right) {
        const right = (r.conversion_right as Record<string, unknown>).OcfRightConvertible as Record<string, unknown>;
        conversion_right = {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: mapMechanism(right.conversion_mechanism),
          ...(typeof right.converts_to_future_round === 'boolean'
            ? { converts_to_future_round: right.converts_to_future_round }
            : {}),
          ...(typeof right.converts_to_stock_class_id === 'string' && right.converts_to_stock_class_id.length
            ? { converts_to_stock_class_id: right.converts_to_stock_class_id }
            : {}),
        };
      } else if (
        r.conversion_right &&
        typeof r.conversion_right === 'object' &&
        'conversion_mechanism' in r.conversion_right
      ) {
        // Handle direct convertible right shape (no OcfRightConvertible wrapper)
        const right = r.conversion_right as {
          conversion_mechanism: unknown;
          converts_to_future_round?: boolean;
          converts_to_stock_class_id?: string;
        };
        conversion_right = {
          type: 'CONVERTIBLE_CONVERSION_RIGHT',
          conversion_mechanism: mapMechanism(right.conversion_mechanism),
          ...(typeof right.converts_to_future_round === 'boolean'
            ? { converts_to_future_round: right.converts_to_future_round }
            : {}),
          ...(typeof right.converts_to_stock_class_id === 'string' && right.converts_to_stock_class_id.length
            ? { converts_to_stock_class_id: right.converts_to_stock_class_id }
            : {}),
        };
      }
      if (!conversion_right) {
        throw new Error('Missing conversion_right for convertible trigger');
      }

      const trigger: ConversionTrigger = {
        type,
        trigger_id,
        conversion_right,
        ...(nickname ? { nickname } : {}),
        ...(trigger_description ? { trigger_description } : {}),
        ...(trigger_date ? { trigger_date } : {}),
        ...(trigger_condition ? { trigger_condition } : {}),
      };
      return trigger;
    });
  };

  const investmentAmount = d.investment_amount as { amount: number | string; currency: string };
  const comments = d.comments as string[];

  const event: OcfConvertibleIssuanceEvent = {
    object_type: 'TX_CONVERTIBLE_ISSUANCE',
    id: d.id as string,
    date: (d.date as string).split('T')[0],
    security_id: d.security_id as string,
    custom_id: d.custom_id as string,
    stakeholder_id: d.stakeholder_id as string,
    ...(typeof d.board_approval_date === 'string' && d.board_approval_date.length
      ? { board_approval_date: d.board_approval_date.split('T')[0] }
      : {}),
    ...(typeof d.stockholder_approval_date === 'string' && d.stockholder_approval_date.length
      ? { stockholder_approval_date: d.stockholder_approval_date.split('T')[0] }
      : {}),
    investment_amount: {
      amount: normalizeNumericString(
        typeof investmentAmount.amount === 'number' ? String(investmentAmount.amount) : String(investmentAmount.amount)
      ),
      currency: investmentAmount.currency,
    },
    ...(typeof d.consideration_text === 'string' && d.consideration_text.length
      ? { consideration_text: d.consideration_text }
      : {}),
    convertible_type: typeMap[(d.convertible_type as string) || 'OcfConvertibleNote'],
    conversion_triggers: convertTriggers(
      d.conversion_triggers as unknown[],
      typeMap[(d.convertible_type as string) || 'OcfConvertibleNote'],
      d.id as string
    ),
    ...(typeof d.pro_rata === 'number' || typeof d.pro_rata === 'string'
      ? {
          pro_rata: normalizeNumericString(String(d.pro_rata)),
        }
      : {}),
    seniority: typeof d.seniority === 'number' ? d.seniority : Number(d.seniority),
    security_law_exemptions: d.security_law_exemptions as Array<{
      description: string;
      jurisdiction: string;
    }>,
    ...(comments.length ? { comments } : {}),
  };

  return { event, contractId: params.contractId };
}
