import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { damlTimeToDateString } from '../../utils/typeConversions';

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
  function hasStockClassData(arg: unknown): arg is { stock_class_data: Fairmint.OpenCapTable.Types.OcfStockClassData } {
    return typeof arg === 'object' && 
           arg !== null && 
           'stock_class_data' in arg &&
           typeof (arg as any).stock_class_data === 'object';
  }
  
  if (!hasStockClassData(createArgument)) {
    throw new Error('Stock class data not found in contract create argument');
  }
  
  const stockClassData = createArgument.stock_class_data;
  
  // Helper function to convert DAML Optional to JavaScript undefined
  const toUndefined = <T>(value: T | null): T | undefined => value === null ? undefined : value;
  
  // Helper function to convert DAML stock class type to OCF schema stock class type
  const convertStockClassType = (damlClassType: Fairmint.OpenCapTable.Types.OcfStockClassType): 'PREFERRED' | 'COMMON' => {
    switch (damlClassType) {
      case 'OcfStockClassTypePreferred':
        return 'PREFERRED';
      case 'OcfStockClassTypeCommon':
        return 'COMMON';
      default:
        throw new Error(`Unknown stock class type: ${damlClassType}`);
    }
  };

  // Helper function to convert DAML monetary value to OCF format
  const convertMonetary = (damlMonetary: Fairmint.OpenCapTable.Types.OcfMonetary) => ({
    amount: damlMonetary.amount.toString(),
    currency: damlMonetary.currency
  });
  
  // Transform DAML stock class data to OCF format
  const ocfStockClass: OcfStockClass = {
    object_type: 'STOCK_CLASS',
    name: stockClassData.name || '',
    class_type: convertStockClassType(stockClassData.class_type),
    default_id_prefix: stockClassData.default_id_prefix || '',
    initial_shares_authorized: stockClassData.initial_shares_authorized?.toString() || '0',
    votes_per_share: stockClassData.votes_per_share?.toString() || '0',
    seniority: stockClassData.seniority?.toString() || '0',
    // Optional fields
    ...(stockClassData.board_approval_date && { board_approval_date: damlTimeToDateString(stockClassData.board_approval_date) }),
    ...(stockClassData.stockholder_approval_date && { stockholder_approval_date: damlTimeToDateString(stockClassData.stockholder_approval_date) }),
    ...(stockClassData.par_value && { par_value: convertMonetary(stockClassData.par_value) }),
    ...(stockClassData.price_per_share && { price_per_share: convertMonetary(stockClassData.price_per_share) }),
    ...(stockClassData.conversion_rights && { conversion_rights: stockClassData.conversion_rights }),
    ...(stockClassData.liquidation_preference_multiple && { 
      liquidation_preference_multiple: stockClassData.liquidation_preference_multiple.toString() 
    }),
    ...(stockClassData.participation_cap_multiple && { 
      participation_cap_multiple: stockClassData.participation_cap_multiple.toString() 
    }),
    // Use contract ID as the OCF object ID
    id: params.contractId
  };
  
  return {
    stockClass: ocfStockClass,
    contractId: params.contractId
  };
}
