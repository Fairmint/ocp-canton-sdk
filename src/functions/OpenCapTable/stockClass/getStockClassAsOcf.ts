import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClass, StockClassConversionRight } from '../../../types/native';
import { damlStockClassTypeToNative } from '../../../utils/enumConversions';
import {
  damlMonetaryToNative,
  isRecord,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { validateRequiredString } from '../../../utils/validation';
import { ratioMechanismFromDaml } from '../shared/conversionMechanisms';
import { readSingleContract } from '../shared/singleContractRead';

/**
 * Internal type for the intermediate stock class data converted from DAML.
 * This represents the data structure before it's transformed to the final OCF output.
 */
export function damlStockClassDataToNative(
  damlData: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData
): OcfStockClass {
  // Validate required fields - fail fast if missing
  const { id: generatedId } = damlData;
  const id: unknown = generatedId;
  if (!id || typeof id !== 'string') {
    throw new OcpValidationError('stockClass.id', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
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
  const votesPerShare: unknown = damlData.votes_per_share;
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
  const seniorityValue: unknown = damlData.seniority;
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
  const isa: unknown = damlData.initial_shares_authorized;
  if (isa === undefined || isa === null) {
    throw new OcpValidationError('stockClass.initial_shares_authorized', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: isa,
    });
  }
  if (typeof isa === 'string' || typeof isa === 'number') {
    initialShares = normalizeNumericString(isa.toString(), 'stockClass.initial_shares_authorized');
  } else if (isRecord(isa)) {
    if (isa.tag === 'OcfInitialSharesNumeric' && typeof isa.value === 'string') {
      initialShares = normalizeNumericString(isa.value, 'stockClass.initial_shares_authorized');
    } else if (isa.tag === 'OcfInitialSharesEnum' && typeof isa.value === 'string') {
      switch (isa.value) {
        case 'OcfAuthorizedSharesUnlimited':
          initialShares = 'UNLIMITED';
          break;
        case 'OcfAuthorizedSharesNotApplicable':
          initialShares = 'NOT APPLICABLE';
          break;
        default:
          throw new OcpValidationError(
            'stockClass.initial_shares_authorized',
            'Unknown initial_shares_authorized enum value',
            {
              code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
              expectedType: 'OcfAuthorizedSharesUnlimited | OcfAuthorizedSharesNotApplicable',
              receivedValue: isa.value,
            }
          );
      }
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

  const boardApprovalDate = optionalDamlTimeToDateString(
    damlData.board_approval_date,
    'stockClass.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    damlData.stockholder_approval_date,
    'stockClass.stockholder_approval_date'
  );

  return {
    object_type: 'STOCK_CLASS',
    id,
    name: damlData.name,
    class_type: damlStockClassTypeToNative(damlData.class_type),
    default_id_prefix: damlData.default_id_prefix,
    initial_shares_authorized: initialShares,
    votes_per_share: normalizeNumericString(votesPerShare.toString(), 'stockClass.votes_per_share'),
    seniority: normalizeNumericString(seniorityValue.toString(), 'stockClass.seniority'),
    conversion_rights: [],
    comments: [],
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(damlData.par_value && {
      par_value: damlMonetaryToNative(damlData.par_value, 'stockClass.par_value'),
    }),
    ...(damlData.price_per_share && {
      price_per_share: damlMonetaryToNative(damlData.price_per_share, 'stockClass.price_per_share'),
    }),
    ...(damlData.conversion_rights.length > 0 && {
      conversion_rights: damlData.conversion_rights.map((right, index) => {
        const field = `stockClass.conversion_rights.${index}`;
        if (right.type_ !== 'STOCK_CLASS_CONVERSION_RIGHT') {
          throw new OcpParseError(`Unknown stock class conversion right type: ${right.type_}`, {
            source: `${field}.type_`,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
          });
        }
        const conversionMechanism = ratioMechanismFromDaml(
          {
            conversion_mechanism: right.conversion_mechanism,
            ratio: right.ratio,
            conversion_price: right.conversion_price,
          },
          `${field}.conversion_mechanism`
        );
        const convertsToStockClassId: unknown = right.converts_to_stock_class_id;
        validateRequiredString(convertsToStockClassId, `${field}.converts_to_stock_class_id`);
        const convertsToFutureRound: unknown = right.converts_to_future_round;
        if (
          convertsToFutureRound !== null &&
          convertsToFutureRound !== undefined &&
          typeof convertsToFutureRound !== 'boolean'
        ) {
          throw new OcpValidationError(
            `${field}.converts_to_future_round`,
            'converts_to_future_round must be a boolean when present',
            {
              code: OcpErrorCodes.INVALID_TYPE,
              expectedType: 'boolean or omitted property',
              receivedValue: convertsToFutureRound,
            }
          );
        }
        const convRight: StockClassConversionRight = {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: conversionMechanism,
          converts_to_stock_class_id: convertsToStockClassId,
          ...(typeof convertsToFutureRound === 'boolean' ? { converts_to_future_round: convertsToFutureRound } : {}),
        };

        return convRight;
      }),
    }),
    ...(damlData.liquidation_preference_multiple != null
      ? {
          liquidation_preference_multiple: normalizeNumericString(
            damlData.liquidation_preference_multiple,
            'stockClass.liquidation_preference_multiple'
          ),
        }
      : {}),
    ...(damlData.participation_cap_multiple != null
      ? {
          participation_cap_multiple: normalizeNumericString(
            damlData.participation_cap_multiple,
            'stockClass.participation_cap_multiple'
          ),
        }
      : {}),
    ...(Array.isArray(damlData.comments) && damlData.comments.every((comment) => typeof comment === 'string')
      ? { comments: damlData.comments }
      : {}),
  };
}

export interface GetStockClassAsOcfParams extends GetByContractIdParams {}

export interface GetStockClassAsOcfResult {
  /** The OCF StockClass object */
  stockClass: OcfStockClass;
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
    return isRecord(arg) && isRecord(arg.stock_class_data);
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

  return {
    stockClass: nativeStockClassData,
    contractId: params.contractId,
  };
}
