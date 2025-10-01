import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlTimeToDateString, damlMonetaryToNative } from '../../utils/typeConversions';
import { OcfStockClassData, ConversionMechanism, ConversionTrigger, StockClassConversionRight, StockClassType } from '../../types/native';

function damlStockClassTypeToNative(damlType: any): StockClassType {
  switch (damlType) {
    case 'OcfStockClassTypePreferred':
      return 'PREFERRED';
    case 'OcfStockClassTypeCommon':
      return 'COMMON';
    default:
      throw new Error(`Unknown DAML stock class type: ${damlType}`);
  }
}

function damlStockClassDataToNative(damlData: Fairmint.OpenCapTable.StockClass.OcfStockClassData): OcfStockClassData {
  const dAny = damlData as unknown as Record<string, unknown>;
  let initialShares: string = '0';
  const isa = dAny.initial_shares_authorized;
  if (typeof isa === 'string' || typeof isa === 'number') {
    initialShares = String(isa);
  } else if (isa && typeof isa === 'object' && 'tag' in isa) {
    const tagged = isa as { tag: string; value?: unknown };
    if (tagged.tag === 'OcfInitialSharesNumeric' && typeof tagged.value === 'string') {
      initialShares = tagged.value;
    } else if (tagged.tag === 'OcfInitialSharesEnum' && typeof tagged.value === 'string') {
      initialShares = tagged.value === 'OcfAuthorizedSharesUnlimited' ? 'Unlimited' : 'N/A';
    }
  }

  return {
    id: (typeof (dAny as any).id === 'string' ? (dAny as any).id : ''),
    name: damlData.name || '',
    class_type: damlStockClassTypeToNative(damlData.class_type),
    default_id_prefix: damlData.default_id_prefix || '',
    initial_shares_authorized: initialShares,
    votes_per_share: damlData.votes_per_share || '0',
    seniority: damlData.seniority || '0',
    conversion_rights: [],
    comments: [],
    ...(damlData.board_approval_date && { board_approval_date: damlTimeToDateString(damlData.board_approval_date) }),
    ...(damlData.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(damlData.stockholder_approval_date) }),
    ...(damlData.par_value && { par_value: damlMonetaryToNative(damlData.par_value) }),
    ...(damlData.price_per_share && { price_per_share: damlMonetaryToNative(damlData.price_per_share) }),
    ...(damlData.conversion_rights && damlData.conversion_rights.length > 0 && {
      conversion_rights: damlData.conversion_rights.map((right) => {
        const mechanism: ConversionMechanism =
          right.conversion_mechanism === 'OcfConversionMechanismRatioConversion'
            ? 'RATIO_CONVERSION'
            : right.conversion_mechanism === 'OcfConversionMechanismPercentCapitalizationConversion'
            ? 'PERCENT_CONVERSION'
            : 'FIXED_AMOUNT_CONVERSION';
        const rt = right.conversion_trigger as unknown;
        let tag: string | undefined;
        if (typeof rt === 'string') tag = rt;
        else if (rt && typeof rt === 'object' && 'tag' in rt) tag = (rt as { tag: string }).tag;
        const trigger: ConversionTrigger =
          tag === 'OcfTriggerTypeAutomaticOnDate' ? 'AUTOMATIC_ON_DATE' :
          tag === 'OcfTriggerTypeElectiveAtWill' ? 'ELECTIVE_AT_WILL' :
          tag === 'OcfTriggerTypeElectiveOnCondition' ? 'ELECTIVE_ON_CONDITION' :
          tag === 'OcfTriggerTypeElectiveInRange' ? 'ELECTIVE_ON_CONDITION' :
          tag === 'OcfTriggerTypeUnspecified' ? 'ELECTIVE_AT_WILL' : 'AUTOMATIC_ON_CONDITION';

        let ratioValue: number | undefined;
        const ratioRaw = (right as unknown as { ratio?: unknown }).ratio;
        if (ratioRaw && typeof ratioRaw === 'object') {
          if ('tag' in ratioRaw && (ratioRaw as { tag: unknown }).tag === 'Some' && 'value' in ratioRaw) {
            const r = (ratioRaw as { value: { numerator?: string; denominator?: string } }).value;
            const num = parseFloat((r.numerator as string) || '1');
            const den = parseFloat((r.denominator as string) || '1');
            ratioValue = den !== 0 ? num / den : undefined;
          } else if ('numerator' in ratioRaw && 'denominator' in ratioRaw) {
            const r = ratioRaw as { numerator?: string; denominator?: string };
            const num = parseFloat((r.numerator as string) || '1');
            const den = parseFloat((r.denominator as string) || '1');
            ratioValue = den !== 0 ? num / den : undefined;
          }
        }

        return {
          type: right.type_,
          conversion_mechanism: mechanism,
          conversion_trigger: trigger,
          converts_to_stock_class_id: right.converts_to_stock_class_id,
          ...(ratioValue !== undefined ? { ratio: ratioValue } : {}),
          ...((): Record<string, unknown> => {
            const out: Record<string, unknown> = {};
            const cv = (right as unknown as Record<string, unknown>).conversion_price;
            if (cv && typeof cv === 'object' && 'tag' in cv && (cv as { tag: unknown }).tag === 'Some' && 'value' in cv) {
              out.conversion_price = damlMonetaryToNative((cv as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const rsp = (right as unknown as Record<string, unknown>).reference_share_price;
            if (rsp && typeof rsp === 'object' && 'tag' in rsp && (rsp as { tag: unknown }).tag === 'Some' && 'value' in rsp) {
              out.reference_share_price = damlMonetaryToNative((rsp as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const rvps = (right as unknown as Record<string, unknown>).reference_valuation_price_per_share;
            if (rvps && typeof rvps === 'object' && 'tag' in rvps && (rvps as { tag: unknown }).tag === 'Some' && 'value' in rvps) {
              out.reference_valuation_price_per_share = damlMonetaryToNative((rvps as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const poc = (right as unknown as Record<string, unknown>).percent_of_capitalization;
            if (poc && typeof poc === 'object' && 'tag' in poc && (poc as { tag: unknown }).tag === 'Some' && 'value' in poc) {
              out.percent_of_capitalization = parseFloat((poc as { value: string }).value);
            }
            const dr = (right as unknown as Record<string, unknown>).discount_rate;
            if (dr && typeof dr === 'object' && 'tag' in dr && (dr as { tag: unknown }).tag === 'Some' && 'value' in dr) {
              out.discount_rate = parseFloat((dr as { value: string }).value);
            }
            const vc = (right as unknown as Record<string, unknown>).valuation_cap;
            if (vc && typeof vc === 'object' && 'tag' in vc && (vc as { tag: unknown }).tag === 'Some' && 'value' in vc) {
              out.valuation_cap = damlMonetaryToNative((vc as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const fps = (right as unknown as Record<string, unknown>).floor_price_per_share;
            if (fps && typeof fps === 'object' && 'tag' in fps && (fps as { tag: unknown }).tag === 'Some' && 'value' in fps) {
              out.floor_price_per_share = damlMonetaryToNative((fps as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const cps = (right as unknown as Record<string, unknown>).ceiling_price_per_share;
            if (cps && typeof cps === 'object' && 'tag' in cps && (cps as { tag: unknown }).tag === 'Some' && 'value' in cps) {
              out.ceiling_price_per_share = damlMonetaryToNative((cps as { value: Fairmint.OpenCapTable.Types.OcfMonetary }).value);
            }
            const cd = (right as unknown as Record<string, unknown>).custom_description;
            if (cd && typeof cd === 'object' && 'tag' in cd && (cd as { tag: unknown }).tag === 'Some' && 'value' in cd) {
              out.custom_description = (cd as { value: string }).value;
            }
            return out;
          })(),
          ...(right.expires_at && { expires_at: damlTimeToDateString(right.expires_at) })
        } as StockClassConversionRight;
      })
    }),
    ...(damlData.liquidation_preference_multiple && {
      liquidation_preference_multiple: damlData.liquidation_preference_multiple
    }),
    ...(damlData.participation_cap_multiple && {
      participation_cap_multiple: damlData.participation_cap_multiple
    }),
    ...(Array.isArray((dAny as { comments?: unknown }).comments) ? { comments: (dAny as { comments: string[] }).comments } : {})
  };
}

/**
 * OCF Stock Class object according to the Open Cap Table Coalition schema
 * Object describing a class of stock issued by the issuer
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
 */
export interface OcfStockClass {
  /** Object type identifier - must be "STOCK_CLASS" */
  object_type: 'STOCK_CLASS';
  
  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;
  
  /** The type of this stock class (e.g. Preferred or Common) */
  class_type: 'PREFERRED' | 'COMMON';
  
  /** Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate IDs have a dash, the prefix should end in the dash like CS- */
  default_id_prefix: string;
  
  /** The initial number of shares authorized for this stock class */
  initial_shares_authorized: string | number;
  
  /** Date on which the board approved the stock class (YYYY-MM-DD format) */
  board_approval_date?: string;
  
  /** Date on which the stockholders approved the stock class (YYYY-MM-DD format) */
  stockholder_approval_date?: string;
  
  /** The number of votes each share of this stock class gets */
  votes_per_share: string | number;
  
  /** Per-share par value of this stock class */
  par_value?: {
    /** The amount of the monetary value */
    amount: string;
    /** The currency code for the monetary value (ISO 4217) */
    currency: string;
  };
  
  /** Per-share price this stock class was issued for */
  price_per_share?: {
    /** The amount of the monetary value */
    amount: string;
    /** The currency code for the monetary value (ISO 4217) */
    currency: string;
  };
  
  /** 
   * Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so that stock classes with a higher seniority have higher repayment priority. The following properties hold for all stock classes for a given company:
   * a) transitivity: stock classes are absolutely stackable by seniority and in increasing numerical order,
   * b) non-uniqueness: multiple stock classes can have the same Seniority number and therefore have the same liquidation/repayment order.
   * In practice, stock classes with same seniority may be created at different points in time and (for example, an extension of an existing preferred financing round), and also a new stock class can be created with seniority between two existing stock classes, in which case it is assigned some decimal number between the numbers representing seniority of the respective classes.
   */
  seniority: string | number;
  
  /** List of stock class conversion rights possible for this stock class */
  conversion_rights?: Array<{
    /** The type of conversion right */
    conversion_mechanism: string;
    /** Additional conversion right details */
    [key: string]: any;
  }>;
  
  /** The liquidation preference per share for this stock class */
  liquidation_preference_multiple?: string | number;
  
  /** The participation cap multiple per share for this stock class */
  participation_cap_multiple?: string | number;
  
  /** Unique identifier for the stock class object */
  id?: string;
  
  /** Additional comments or notes about the stock class */
  comments?: string[];
}

export interface GetStockClassAsOcfParams {
  /** Contract ID of the StockClass contract to retrieve */
  contractId: string;
}

export interface GetStockClassAsOcfResult {
  /** The OCF StockClass object */
  stockClass: OcfStockClass;
  /** The original contract ID */
  contractId: string;
}

/**
 * Retrieve a stock class contract by ID and return it as an OCF JSON object
 * 
 * This function fetches the stock class contract data from the ledger and transforms it
 * into the Open Cap Table Coalition (OCF) format according to the official schema.
 * 
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
 * 
 * @example
 * ```typescript
 * const result = await getStockClassAsOcf(client, {
 *   contractId: "1234567890abcdef"
 * });
 * 
 * console.log(result.stockClass);
 * // {
 * //   object_type: "STOCK_CLASS",
 * //   name: "Series A Preferred",
 * //   class_type: "PREFERRED",
 * //   default_id_prefix: "SA-",
 * //   initial_shares_authorized: "1000000",
 * //   votes_per_share: "1",
 * //   seniority: "1",
 * //   // ... other fields
 * // }
 * ```
 * 
 * @param client - The ledger JSON API client
 * @param params - Parameters for retrieving the stock class
 * @returns Promise resolving to the OCF StockClass object
 */
export async function getStockClassAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAsOcfParams
): Promise<GetStockClassAsOcfResult> {
  // Get the events for the StockClass contract
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.contractId
  });
  
  if (!eventsResponse.created?.createdEvent?.createArgument) {
    throw new Error('Invalid contract events response: missing created event or create argument');
  }
  
  const createArgument = eventsResponse.created.createdEvent.createArgument;
  
  // Type guard to ensure we have the expected stock class data structure
  function hasStockClassData(arg: unknown): arg is { stock_class_data: Fairmint.OpenCapTable.StockClass.OcfStockClassData } {
    return typeof arg === 'object' && 
           arg !== null && 
           'stock_class_data' in arg &&
           typeof (arg as any).stock_class_data === 'object';
  }
  
  if (!hasStockClassData(createArgument)) {
    throw new Error('Stock class data not found in contract create argument');
  }
  
  const stockClassData = createArgument.stock_class_data;
  
  // Use the shared conversion function from typeConversions.ts
  const nativeStockClassData = damlStockClassDataToNative(stockClassData);
  
  // Helper function to ensure monetary amounts are strings
  const ensureStringAmount = (monetary: { amount: string | number; currency: string }) => ({
    amount: typeof monetary.amount === 'number' ? monetary.amount.toString() : monetary.amount,
    currency: monetary.currency
  });
  
  // Destructure native data, excluding fields that need type conversion
  const {
    id,
    par_value,
    price_per_share,
    initial_shares_authorized,
    votes_per_share,
    seniority,
    liquidation_preference_multiple,
    participation_cap_multiple,
    conversion_rights,
    comments,
    ...baseStockClassData
  } = nativeStockClassData;
  
  // Transform native stock class data to OCF format, adding OCF-specific fields
  const ocfStockClass: OcfStockClass = {
    object_type: 'STOCK_CLASS',
    id,
    ...baseStockClassData,
    comments: Array.isArray(comments) ? comments : [],
    // Ensure numeric values are strings for OCF compatibility
    initial_shares_authorized: typeof initial_shares_authorized === 'number' ? 
      initial_shares_authorized.toString() : initial_shares_authorized,
    votes_per_share: typeof votes_per_share === 'number' ? 
      votes_per_share.toString() : votes_per_share,
    seniority: typeof seniority === 'number' ? 
      seniority.toString() : seniority,
    // Add optional monetary fields with proper string conversion
    ...(par_value && { par_value: ensureStringAmount(par_value) }),
    ...(price_per_share && { price_per_share: ensureStringAmount(price_per_share) }),
    ...(liquidation_preference_multiple && { 
      liquidation_preference_multiple: typeof liquidation_preference_multiple === 'number' ? 
        liquidation_preference_multiple.toString() : liquidation_preference_multiple
    }),
    ...(participation_cap_multiple && { 
      participation_cap_multiple: typeof participation_cap_multiple === 'number' ? 
        participation_cap_multiple.toString() : participation_cap_multiple
    }),
    ...(Array.isArray(conversion_rights) && conversion_rights.length > 0
      ? { conversion_rights }
      : {})
  };
  
  return {
    stockClass: ocfStockClass,
    contractId: params.contractId
  };
}
