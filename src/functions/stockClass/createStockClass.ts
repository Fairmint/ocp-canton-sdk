import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { cleanComments, dateStringToDAMLTime, monetaryToDaml } from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts, OcfStockClassData, StockClassType } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

function stockClassTypeToDaml(
  stockClassType: StockClassType
): 'OcfStockClassTypePreferred' | 'OcfStockClassTypeCommon' {
  switch (stockClassType) {
    case 'PREFERRED':
      return 'OcfStockClassTypePreferred';
    case 'COMMON':
      return 'OcfStockClassTypeCommon';
    default: {
      const exhaustiveCheck: never = stockClassType;
      throw new Error(`Unknown stock class type: ${String(exhaustiveCheck)}`);
    }
  }
}

function stockClassDataToDaml(stockClassData: OcfStockClassData): Record<string, unknown> {
  const d = stockClassData;
  if (!d.id) throw new Error('stockClassData.id is required');
  return {
    id: d.id,
    name: d.name,
    class_type: stockClassTypeToDaml(d.class_type),
    default_id_prefix: d.default_id_prefix,
    initial_shares_authorized:
      typeof d.initial_shares_authorized === 'number'
        ? d.initial_shares_authorized.toString()
        : d.initial_shares_authorized,
    votes_per_share: typeof d.votes_per_share === 'number' ? d.votes_per_share.toString() : d.votes_per_share,
    seniority: typeof d.seniority === 'number' ? d.seniority.toString() : d.seniority,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    par_value: d.par_value ? monetaryToDaml(d.par_value) : null,
    price_per_share: d.price_per_share ? monetaryToDaml(d.price_per_share) : null,
    conversion_rights: (d.conversion_rights ?? []).map((right) => {
      const mechanism:
        | 'OcfConversionMechanismRatioConversion'
        | 'OcfConversionMechanismPercentCapitalizationConversion'
        | 'OcfConversionMechanismFixedAmountConversion' =
        right.conversion_mechanism === 'RATIO_CONVERSION'
          ? 'OcfConversionMechanismRatioConversion'
          : right.conversion_mechanism === 'PERCENT_CONVERSION'
            ? 'OcfConversionMechanismPercentCapitalizationConversion'
            : 'OcfConversionMechanismFixedAmountConversion';

      const trigger:
        | 'OcfTriggerTypeAutomaticOnCondition'
        | 'OcfTriggerTypeAutomaticOnDate'
        | 'OcfTriggerTypeElectiveAtWill'
        | 'OcfTriggerTypeElectiveOnCondition' = (() => {
        switch (right.conversion_trigger) {
          case 'AUTOMATIC_ON_CONDITION':
            return 'OcfTriggerTypeAutomaticOnCondition';
          case 'AUTOMATIC_ON_DATE':
            return 'OcfTriggerTypeAutomaticOnDate';
          case 'ELECTIVE_AT_WILL':
            return 'OcfTriggerTypeElectiveAtWill';
          case 'ELECTIVE_ON_CONDITION':
            return 'OcfTriggerTypeElectiveOnCondition';
          case 'ELECTIVE_ON_DATE':
            return 'OcfTriggerTypeElectiveAtWill';
          default:
            return 'OcfTriggerTypeAutomaticOnCondition';
        }
      })();

      let ratio: { numerator: string; denominator: string } | null = null;
      const numerator = right.ratio_numerator ?? right.ratio;
      const denominator = right.ratio_denominator ?? (right.ratio !== undefined ? 1 : undefined);
      if (numerator !== undefined && denominator !== undefined) {
        ratio = {
          numerator: typeof numerator === 'number' ? numerator.toString() : String(numerator),
          denominator: typeof denominator === 'number' ? denominator.toString() : String(denominator),
        };
      }

      return {
        type_: right.type,
        conversion_mechanism: mechanism,
        conversion_trigger: trigger,
        converts_to_stock_class_id: right.converts_to_stock_class_id,
        ratio: ratio ? { tag: 'Some', value: ratio } : null,
        percent_of_capitalization:
          right.percent_of_capitalization !== undefined
            ? {
                tag: 'Some',
                value:
                  typeof right.percent_of_capitalization === 'number'
                    ? right.percent_of_capitalization.toString()
                    : String(right.percent_of_capitalization),
              }
            : null,
        conversion_price: right.conversion_price
          ? { tag: 'Some', value: monetaryToDaml(right.conversion_price) }
          : null,
        reference_share_price: right.reference_share_price
          ? { tag: 'Some', value: monetaryToDaml(right.reference_share_price) }
          : null,
        reference_valuation_price_per_share: right.reference_valuation_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.reference_valuation_price_per_share) }
          : null,
        discount_rate:
          right.discount_rate !== undefined
            ? {
                tag: 'Some',
                value:
                  typeof right.discount_rate === 'number'
                    ? right.discount_rate.toString()
                    : String(right.discount_rate),
              }
            : null,
        valuation_cap: right.valuation_cap ? { tag: 'Some', value: monetaryToDaml(right.valuation_cap) } : null,
        floor_price_per_share: right.floor_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.floor_price_per_share) }
          : null,
        ceiling_price_per_share: right.ceiling_price_per_share
          ? { tag: 'Some', value: monetaryToDaml(right.ceiling_price_per_share) }
          : null,
        custom_description: right.custom_description ? { tag: 'Some', value: right.custom_description } : null,
        expires_at: right.expires_at ? dateStringToDAMLTime(right.expires_at) : null,
      };
    }),
    liquidation_preference_multiple: d.liquidation_preference_multiple
      ? typeof d.liquidation_preference_multiple === 'number'
        ? d.liquidation_preference_multiple.toString()
        : d.liquidation_preference_multiple
      : null,
    participation_cap_multiple: d.participation_cap_multiple
      ? typeof d.participation_cap_multiple === 'number'
        ? d.participation_cap_multiple.toString()
        : d.participation_cap_multiple
      : null,
    comments: cleanComments(d.comments),
  };
}

export interface CreateStockClassParams {
  /** Contract ID of the Issuer contract */
  issuerContractId: string;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  /** The party that will act as the issuer */
  issuerParty: string;
  /**
   * Stock class data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
   *
   * - Name: Name for the stock type (e.g. Series A Preferred or Class A Common)
   * - Class_type: The type of this stock class (e.g. Preferred or Common)
   * - Default_id_prefix: Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate
   *   IDs have a dash, the prefix should end in the dash like CS-
   * - Initial_shares_authorized: The initial number of shares authorized for this stock class
   * - Board_approval_date (optional): Date on which the board approved the stock class (YYYY-MM-DD)
   * - Stockholder_approval_date (optional): Date on which the stockholders approved the stock class (YYYY-MM-DD)
   * - Votes_per_share: The number of votes each share of this stock class gets
   * - Par_value (optional): Per-share par value of this stock class
   * - Price_per_share (optional): Per-share price this stock class was issued for
   * - Seniority: Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so
   *   that stock classes with a higher seniority have higher repayment priority. Multiple stock classes can share the
   *   same seniority.
   * - Conversion_rights (optional): List of stock class conversion rights possible for this stock class
   * - Liquidation_preference_multiple (optional): The liquidation preference per share for this stock class
   * - Participation_cap_multiple (optional): The participation cap multiple per share for this stock class
   * - Comments (optional): Additional comments or notes about the stock class
   */
  stockClassData: OcfStockClassData;
}

export function buildCreateStockClassCommand(params: CreateStockClassParams): CommandWithDisclosedContracts {
  const choiceArguments = {
    stock_class_data: stockClassDataToDaml(params.stockClassData),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockClass',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];

  return { command, disclosedContracts };
}
