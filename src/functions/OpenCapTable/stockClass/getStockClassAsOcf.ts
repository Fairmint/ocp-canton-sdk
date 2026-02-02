import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type {
  ConversionMechanism,
  ConversionTrigger,
  Monetary,
  StockClassConversionRight,
  StockClassType,
} from '../../../types/native';
import { damlStockClassTypeToNative } from '../../../utils/enumConversions';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Internal type for the intermediate stock class data converted from DAML.
 * This represents the data structure before it's transformed to the final OCF output.
 */
interface StockClassNativeData {
  id: string;
  name: string;
  class_type: StockClassType;
  default_id_prefix: string;
  initial_shares_authorized: string;
  votes_per_share: string;
  seniority: string;
  conversion_rights: StockClassConversionRight[];
  comments: string[];
  board_approval_date?: string;
  stockholder_approval_date?: string;
  par_value?: Monetary;
  price_per_share?: Monetary;
  liquidation_preference_multiple?: string;
  participation_cap_multiple?: string;
}

function damlStockClassDataToNative(
  damlData: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData
): StockClassNativeData {
  // Access fields via Record type to handle DAML union types that may vary from the SDK definition
  const damlRecord = damlData as Record<string, unknown>;
  const dataWithId = damlRecord as { id?: string };

  // Validate required fields - fail fast if missing
  if (!dataWithId.id || typeof dataWithId.id !== 'string') {
    throw new OcpValidationError('stockClass.id', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: dataWithId.id,
    });
  }
  if (!damlData.name) {
    throw new OcpValidationError('stockClass.name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: damlData.name,
    });
  }
  if (!damlData.default_id_prefix) {
    throw new OcpValidationError('stockClass.default_id_prefix', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: damlData.default_id_prefix,
    });
  }
  const votesPerShare = damlRecord.votes_per_share;
  if (votesPerShare === undefined || votesPerShare === null) {
    throw new OcpValidationError('stockClass.votes_per_share', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: votesPerShare,
    });
  }
  if (typeof votesPerShare !== 'string' && typeof votesPerShare !== 'number') {
    throw new OcpValidationError('stockClass.votes_per_share', 'Invalid votes_per_share format', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: votesPerShare,
    });
  }
  const seniorityValue = damlRecord.seniority;
  if (seniorityValue === undefined || seniorityValue === null) {
    throw new OcpValidationError('stockClass.seniority', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: seniorityValue,
    });
  }
  if (typeof seniorityValue !== 'string' && typeof seniorityValue !== 'number') {
    throw new OcpValidationError('stockClass.seniority', 'Invalid seniority format', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: seniorityValue,
    });
  }

  // Parse initial_shares_authorized from various formats
  let initialShares: string;
  const isa = damlRecord.initial_shares_authorized;
  if (isa === undefined || isa === null) {
    throw new OcpValidationError('stockClass.initial_shares_authorized', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: isa,
    });
  }
  if (typeof isa === 'string' || typeof isa === 'number') {
    initialShares = normalizeNumericString(isa.toString());
  } else if (typeof isa === 'object' && 'tag' in isa) {
    const tagged = isa as { tag: string; value?: unknown };
    if (tagged.tag === 'OcfInitialSharesNumeric' && typeof tagged.value === 'string') {
      initialShares = normalizeNumericString(tagged.value);
    } else if (tagged.tag === 'OcfInitialSharesEnum' && typeof tagged.value === 'string') {
      initialShares = tagged.value === 'OcfAuthorizedSharesUnlimited' ? 'Unlimited' : 'N/A';
    } else {
      throw new OcpValidationError('stockClass.initial_shares_authorized', 'Invalid initial_shares_authorized format', {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: isa,
      });
    }
  } else {
    throw new OcpValidationError('stockClass.initial_shares_authorized', 'Invalid initial_shares_authorized format', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: isa,
    });
  }

  return {
    id: dataWithId.id,
    name: damlData.name,
    class_type: damlStockClassTypeToNative(damlData.class_type),
    default_id_prefix: damlData.default_id_prefix,
    initial_shares_authorized: initialShares,
    votes_per_share: normalizeNumericString(votesPerShare.toString()),
    seniority: normalizeNumericString(seniorityValue.toString()),
    conversion_rights: [],
    comments: [],
    ...(damlData.board_approval_date && {
      board_approval_date: damlTimeToDateString(damlData.board_approval_date),
    }),
    ...(damlData.stockholder_approval_date && {
      stockholder_approval_date: damlTimeToDateString(damlData.stockholder_approval_date),
    }),
    ...(damlData.par_value && { par_value: damlMonetaryToNative(damlData.par_value) }),
    ...(damlData.price_per_share && {
      price_per_share: damlMonetaryToNative(damlData.price_per_share),
    }),
    ...(damlData.conversion_rights.length > 0 && {
      conversion_rights: damlData.conversion_rights.map((right) => {
        const mechanism: ConversionMechanism =
          right.conversion_mechanism === 'OcfConversionMechanismRatioConversion'
            ? 'RATIO_CONVERSION'
            : right.conversion_mechanism === 'OcfConversionMechanismPercentCapitalizationConversion'
              ? 'PERCENT_CONVERSION'
              : 'FIXED_AMOUNT_CONVERSION';
        const rt = right.conversion_trigger as unknown;
        let tag: string | undefined;
        if (typeof rt === 'string') {
          tag = rt;
        } else if (rt && typeof rt === 'object' && 'tag' in rt) {
          const { tag: tagValue } = rt as { tag: string };
          tag = tagValue;
        }
        const trigger: ConversionTrigger =
          tag === 'OcfTriggerTypeAutomaticOnDate'
            ? 'AUTOMATIC_ON_DATE'
            : tag === 'OcfTriggerTypeElectiveAtWill'
              ? 'ELECTIVE_AT_WILL'
              : tag === 'OcfTriggerTypeElectiveOnCondition'
                ? 'ELECTIVE_ON_CONDITION'
                : tag === 'OcfTriggerTypeElectiveInRange'
                  ? 'ELECTIVE_ON_CONDITION'
                  : tag === 'OcfTriggerTypeUnspecified'
                    ? 'ELECTIVE_AT_WILL'
                    : 'AUTOMATIC_ON_CONDITION';

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
            if (
              cv &&
              typeof cv === 'object' &&
              'tag' in cv &&
              (cv as { tag: unknown }).tag === 'Some' &&
              'value' in cv
            ) {
              out.conversion_price = damlMonetaryToNative(
                (cv as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const rsp = (right as unknown as Record<string, unknown>).reference_share_price;
            if (
              rsp &&
              typeof rsp === 'object' &&
              'tag' in rsp &&
              (rsp as { tag: unknown }).tag === 'Some' &&
              'value' in rsp
            ) {
              out.reference_share_price = damlMonetaryToNative(
                (rsp as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const rvps = (right as unknown as Record<string, unknown>).reference_valuation_price_per_share;
            if (
              rvps &&
              typeof rvps === 'object' &&
              'tag' in rvps &&
              (rvps as { tag: unknown }).tag === 'Some' &&
              'value' in rvps
            ) {
              out.reference_valuation_price_per_share = damlMonetaryToNative(
                (rvps as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const poc = (right as unknown as Record<string, unknown>).percent_of_capitalization;
            if (
              poc &&
              typeof poc === 'object' &&
              'tag' in poc &&
              (poc as { tag: unknown }).tag === 'Some' &&
              'value' in poc
            ) {
              out.percent_of_capitalization = parseFloat((poc as { value: string }).value);
            }
            const dr = (right as unknown as Record<string, unknown>).discount_rate;
            if (
              dr &&
              typeof dr === 'object' &&
              'tag' in dr &&
              (dr as { tag: unknown }).tag === 'Some' &&
              'value' in dr
            ) {
              out.discount_rate = parseFloat((dr as { value: string }).value);
            }
            const vc = (right as unknown as Record<string, unknown>).valuation_cap;
            if (
              vc &&
              typeof vc === 'object' &&
              'tag' in vc &&
              (vc as { tag: unknown }).tag === 'Some' &&
              'value' in vc
            ) {
              out.valuation_cap = damlMonetaryToNative(
                (vc as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const fps = (right as unknown as Record<string, unknown>).floor_price_per_share;
            if (
              fps &&
              typeof fps === 'object' &&
              'tag' in fps &&
              (fps as { tag: unknown }).tag === 'Some' &&
              'value' in fps
            ) {
              out.floor_price_per_share = damlMonetaryToNative(
                (fps as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const cps = (right as unknown as Record<string, unknown>).ceiling_price_per_share;
            if (
              cps &&
              typeof cps === 'object' &&
              'tag' in cps &&
              (cps as { tag: unknown }).tag === 'Some' &&
              'value' in cps
            ) {
              out.ceiling_price_per_share = damlMonetaryToNative(
                (cps as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value
              );
            }
            const cd = (right as unknown as Record<string, unknown>).custom_description;
            if (
              cd &&
              typeof cd === 'object' &&
              'tag' in cd &&
              (cd as { tag: unknown }).tag === 'Some' &&
              'value' in cd
            ) {
              out.custom_description = (cd as { value: string }).value;
            }
            return out;
          })(),
          ...(right.expires_at && { expires_at: damlTimeToDateString(right.expires_at) }),
        } as StockClassConversionRight;
      }),
    }),
    ...(damlData.liquidation_preference_multiple && {
      liquidation_preference_multiple: normalizeNumericString(damlData.liquidation_preference_multiple),
    }),
    ...(damlData.participation_cap_multiple && {
      participation_cap_multiple: normalizeNumericString(damlData.participation_cap_multiple),
    }),
    ...(Array.isArray(damlRecord.comments) ? { comments: damlRecord.comments as string[] } : {}),
  };
}

/**
 * OCF Stock Class object according to the Open Cap Table Coalition schema Object describing a class of stock issued by
 * the issuer
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
 */
interface OcfStockClassOutput {
  /** Object type identifier - must be "STOCK_CLASS" */
  object_type: 'STOCK_CLASS';

  /** Name for the stock type (e.g. Series A Preferred or Class A Common) */
  name: string;

  /** The type of this stock class (e.g. Preferred or Common) */
  class_type: 'PREFERRED' | 'COMMON';

  /**
   * Default prefix for certificate numbers in certificated shares (e.g. CS- in CS-1). If certificate IDs have a dash,
   * the prefix should end in the dash like CS-
   */
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
   * Seniority of the stock - determines repayment priority. Seniority is ordered by increasing number so that stock
   * classes with a higher seniority have higher repayment priority. The following properties hold for all stock classes
   * for a given company: a) transitivity: stock classes are absolutely stackable by seniority and in increasing
   * numerical order, b) non-uniqueness: multiple stock classes can have the same Seniority number and therefore have
   * the same liquidation/repayment order. In practice, stock classes with same seniority may be created at different
   * points in time and (for example, an extension of an existing preferred financing round), and also a new stock class
   * can be created with seniority between two existing stock classes, in which case it is assigned some decimal number
   * between the numbers representing seniority of the respective classes.
   */
  seniority: string | number;

  /** List of stock class conversion rights possible for this stock class */
  conversion_rights?: StockClassConversionRight[];

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
  stockClass: OcfStockClassOutput;
  /** The original contract ID */
  contractId: string;
}

/**
 * Retrieve a stock class contract by ID and return it as an OCF JSON object
 *
 * This function fetches the stock class contract data from the ledger and transforms it into the Open Cap Table
 * Coalition (OCF) format according to the official schema.
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters for retrieving the stock class
 * @returns Promise resolving to the OCF StockClass object
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
 */
export async function getStockClassAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAsOcfParams
): Promise<GetStockClassAsOcfResult> {
  // Get the events for the StockClass contract
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.contractId,
  });

  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('Invalid contract events response: missing created event or create argument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  // Type guard to ensure we have the expected stock class data structure
  function hasStockClassData(
    arg: unknown
  ): arg is { stock_class_data: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'stock_class_data' in record &&
      typeof record.stock_class_data === 'object'
    );
  }

  if (!hasStockClassData(createArgument)) {
    throw new OcpParseError('Stock class data not found in contract create argument', {
      source: 'StockClass.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const stockClassData = createArgument.stock_class_data;

  // Use the shared conversion function from typeConversions.ts
  const nativeStockClassData = damlStockClassDataToNative(stockClassData);

  // Helper function to ensure monetary amounts are strings
  const ensureStringAmount = (monetary: { amount: string | number; currency: string }) => ({
    amount: typeof monetary.amount === 'number' ? monetary.amount.toString() : monetary.amount,
    currency: monetary.currency,
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
  // Note: All numeric values are already normalized to strings by damlStockClassDataToNative
  const ocfStockClassOutput: OcfStockClassOutput = {
    object_type: 'STOCK_CLASS',
    id,
    ...baseStockClassData,
    comments,
    initial_shares_authorized,
    votes_per_share,
    seniority,
    // Add optional monetary fields with proper string conversion
    ...(par_value && { par_value: ensureStringAmount(par_value) }),
    ...(price_per_share && { price_per_share: ensureStringAmount(price_per_share) }),
    ...(liquidation_preference_multiple && { liquidation_preference_multiple }),
    ...(participation_cap_multiple && { participation_cap_multiple }),
    ...(conversion_rights.length > 0 ? { conversion_rights } : {}),
  };

  return {
    stockClass: ocfStockClassOutput,
    contractId: params.contractId,
  };
}
