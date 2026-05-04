import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type {
  ConversionMechanism,
  ConversionMechanismObject,
  Monetary,
  StockClassConversionRight,
  StockClassType,
} from '../../../types/native';
import { damlStockClassTypeToNative } from '../../../utils/enumConversions';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

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

export function damlStockClassDataToNative(
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
      initialShares = tagged.value === 'OcfAuthorizedSharesUnlimited' ? 'UNLIMITED' : 'NOT APPLICABLE';
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
        const rec = right as unknown as Record<string, unknown>;

        // --- conversion_mechanism: build as OCF RatioConversionMechanism ---
        // OCF StockClassConversionRight only allows RatioConversionMechanism, which requires:
        // type, ratio, conversion_price, rounding_type (all required)
        const mechRaw = rec.conversion_mechanism;
        let mechanismTag: string;
        if (typeof mechRaw === 'string') {
          mechanismTag = mechRaw;
        } else if (mechRaw && typeof mechRaw === 'object' && 'tag' in mechRaw) {
          mechanismTag = (mechRaw as { tag: string }).tag;
        } else {
          mechanismTag = '';
        }
        const mechanismType: ConversionMechanism = (() => {
          switch (mechanismTag) {
            case 'OcfConversionMechanismRatioConversion':
              return 'RATIO_CONVERSION';
            case 'OcfConversionMechanismPercentCapitalizationConversion':
              return 'FIXED_PERCENT_OF_CAPITALIZATION_CONVERSION';
            case 'OcfConversionMechanismFixedAmountConversion':
              return 'FIXED_AMOUNT_CONVERSION';
            default:
              throw new OcpParseError(`Unknown stock class conversion mechanism: ${mechanismTag}`, {
                source: 'conversion_right.conversion_mechanism',
                code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
              });
          }
        })();

        // Extract ratio from DAML Optional(OcfRatio)
        const extractRatio = (raw: unknown): { numerator: string; denominator: string } | undefined => {
          if (!raw || typeof raw !== 'object') return undefined;
          let val: unknown = raw;
          if ('tag' in (val as Record<string, unknown>)) {
            const tagged = val as { tag: string; value?: unknown };
            if (tagged.tag !== 'Some' || !tagged.value) return undefined;
            val = tagged.value;
          }
          const r = val as Record<string, unknown>;
          if (!('numerator' in r) || !('denominator' in r)) return undefined;
          const num = r.numerator;
          const den = r.denominator;
          if (num == null || den == null) return undefined;
          const numStr = typeof num === 'string' ? num : typeof num === 'number' ? num.toString() : null;
          const denStr = typeof den === 'string' ? den : typeof den === 'number' ? den.toString() : null;
          if (numStr === null || denStr === null) return undefined;
          return { numerator: normalizeNumericString(numStr), denominator: normalizeNumericString(denStr) };
        };

        let ratio = extractRatio(rec.ratio);
        if (!ratio && mechRaw && typeof mechRaw === 'object' && 'value' in mechRaw) {
          ratio = extractRatio(mechRaw.value);
        }

        // Extract optional monetary from DAML Optional(OcfMonetary)
        const extractOptionalMonetary = (raw: unknown): Monetary | undefined => {
          if (raw && typeof raw === 'object' && 'tag' in raw && raw.tag === 'Some' && 'value' in raw) {
            return damlMonetaryToNative((raw as { value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary }).value);
          }
          return undefined;
        };

        const conversionPrice = extractOptionalMonetary(rec.conversion_price);

        // Extract rounding_type from DAML Optional(OcfRoundingType)
        const extractRoundingType = (raw: unknown): 'CEILING' | 'FLOOR' | 'NORMAL' => {
          if (!raw || typeof raw !== 'object') return 'NORMAL';
          const tag =
            'tag' in (raw as Record<string, unknown>)
              ? (raw as { tag: string }).tag
              : 'value' in (raw as Record<string, unknown>)
                ? (raw as { value: unknown } as Record<string, unknown>).tag
                : null;
          if (tag === 'OcfRoundingCeiling') return 'CEILING';
          if (tag === 'OcfRoundingFloor') return 'FLOOR';
          if (tag === 'OcfRoundingNormal') return 'NORMAL';
          return 'NORMAL';
        };
        const roundingType = extractRoundingType(rec.rounding_type);

        // Build OCF RatioConversionMechanism (required: type, ratio, conversion_price, rounding_type)
        // StockClassConversionRight schema only allows RatioConversionMechanism; additionalProperties: false
        const mechanismObj: ConversionMechanismObject = {
          type: mechanismType,
          ratio: ratio ?? { numerator: '1', denominator: '1' },
          conversion_price: conversionPrice ?? { amount: '0', currency: 'USD' },
          rounding_type: roundingType,
        };

        // OCF StockClassConversionRight schema allows ONLY: type, conversion_mechanism,
        // converts_to_future_round, converts_to_stock_class_id. No conversion_trigger or other fields.
        const convertsToFutureRound = rec.converts_to_future_round;
        const convRight: StockClassConversionRight = {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: mechanismObj,
          converts_to_stock_class_id: right.converts_to_stock_class_id,
          ...(convertsToFutureRound !== undefined && convertsToFutureRound !== null
            ? { converts_to_future_round: Boolean(convertsToFutureRound) }
            : {}),
        };

        return convRight;
      }),
    }),
    ...(damlData.liquidation_preference_multiple != null
      ? { liquidation_preference_multiple: normalizeNumericString(damlData.liquidation_preference_multiple) }
      : {}),
    ...(damlData.participation_cap_multiple != null
      ? { participation_cap_multiple: normalizeNumericString(damlData.participation_cap_multiple) }
      : {}),
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

export interface GetStockClassAsOcfParams extends GetByContractIdParams {}

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
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
  });

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
    ...(liquidation_preference_multiple != null ? { liquidation_preference_multiple } : {}),
    ...(participation_cap_multiple != null ? { participation_cap_multiple } : {}),
    ...(conversion_rights.length > 0 ? { conversion_rights } : {}),
  };

  return {
    stockClass: ocfStockClassOutput,
    contractId: params.contractId,
  };
}
