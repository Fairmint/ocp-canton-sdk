import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClass, RatioConversionMechanism, StockClassConversionRight } from '../../../types/native';
import { damlStockClassTypeToNative } from '../../../utils/enumConversions';
import {
  damlMonetaryToNative,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function firstLossyGeneratedPath(
  source: unknown,
  encoded: unknown,
  path: string,
  ancestors = new WeakSet<object>()
): string | undefined {
  if (source === null || typeof source !== 'object') {
    return Object.is(source, encoded) ? undefined : path;
  }
  if (ancestors.has(source)) return path;
  ancestors.add(source);
  try {
    if (Array.isArray(source)) {
      if (!Array.isArray(encoded) || source.length !== encoded.length) return path;
      for (let index = 0; index < source.length; index += 1) {
        const mismatch = firstLossyGeneratedPath(source[index], encoded[index], `${path}[${index}]`, ancestors);
        if (mismatch !== undefined) return mismatch;
      }
      return undefined;
    }
    if (encoded === null || typeof encoded !== 'object' || Array.isArray(encoded)) return path;

    const encodedRecord = encoded as Record<string, unknown>;
    for (const [key, value] of Object.entries(source)) {
      if (!Object.prototype.hasOwnProperty.call(encodedRecord, key)) return `${path}.${key}`;
      const mismatch = firstLossyGeneratedPath(value, encodedRecord[key], `${path}.${key}`, ancestors);
      if (mismatch !== undefined) return mismatch;
    }
    return undefined;
  } finally {
    ancestors.delete(source);
  }
}

/**
 * Internal type for the intermediate stock class data converted from DAML.
 * This represents the data structure before it's transformed to the final OCF output.
 */
export function damlStockClassDataToNative(input: unknown): OcfStockClass {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    const raw = input as Record<string, unknown>;
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      throw new OcpValidationError('stockClass.id', 'Required field is missing', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: raw.id,
      });
    }
    if (typeof raw.name !== 'string' || raw.name.length === 0) {
      throw new OcpValidationError('stockClass.name', 'Required field is missing', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: raw.name,
      });
    }
    optionalDamlTimeToDateString(raw.board_approval_date, 'stockClass.board_approval_date');
    optionalDamlTimeToDateString(raw.stockholder_approval_date, 'stockClass.stockholder_approval_date');
  }

  let damlData: Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData;
  try {
    damlData = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.decoder.runWithException(input);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.length > 500 ? `${rawMessage.slice(0, 500)}…` : rawMessage;
    throw new OcpParseError(`Invalid DAML stock class data: ${message}`, {
      source: 'stockClass',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  let encoded: unknown;
  try {
    encoded = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.encode(damlData);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.length > 500 ? `${rawMessage.slice(0, 500)}…` : rawMessage;
    throw new OcpParseError(`Unable to encode DAML stock class data: ${message}`, {
      source: 'stockClass',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }
  const lossyPath = firstLossyGeneratedPath(input, encoded, 'stockClass');
  if (lossyPath !== undefined) {
    throw new OcpParseError(`Generated DAML decoding would discard or alter ${lossyPath}`, {
      source: lossyPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

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
    id: dataWithId.id,
    name: damlData.name,
    class_type: damlStockClassTypeToNative(damlData.class_type),
    default_id_prefix: damlData.default_id_prefix,
    initial_shares_authorized: initialShares,
    votes_per_share: normalizeNumericString(votesPerShare.toString()),
    seniority: normalizeNumericString(seniorityValue.toString()),
    conversion_rights: [],
    comments: [],
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(damlData.par_value && { par_value: damlMonetaryToNative(damlData.par_value) }),
    ...(damlData.price_per_share && {
      price_per_share: damlMonetaryToNative(damlData.price_per_share),
    }),
    ...(damlData.conversion_rights.length > 0 && {
      conversion_rights: damlData.conversion_rights.map((right, index) => {
        const path = `stockClass.conversion_rights[${index}]`;
        if (right.type_ !== 'STOCK_CLASS_CONVERSION_RIGHT') {
          throw new OcpValidationError(`${path}.type`, 'Unexpected stock-class conversion-right discriminator', {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: 'STOCK_CLASS_CONVERSION_RIGHT',
            receivedValue: right.type_,
          });
        }
        if (right.conversion_mechanism !== 'OcfConversionMechanismRatioConversion') {
          throw new OcpParseError(`Unknown stock class conversion mechanism: ${right.conversion_mechanism}`, {
            source: `${path}.conversion_mechanism`,
            code: OcpErrorCodes.SCHEMA_MISMATCH,
          });
        }
        if (!right.ratio) {
          throw new OcpValidationError(`${path}.conversion_mechanism.ratio`, 'Required OCF ratio is missing', {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
          });
        }
        if (!right.conversion_price) {
          throw new OcpValidationError(
            `${path}.conversion_mechanism.conversion_price`,
            'Required OCF conversion price is missing',
            { code: OcpErrorCodes.SCHEMA_MISMATCH }
          );
        }
        if (right.converts_to_stock_class_id.length === 0) {
          throw new OcpValidationError(`${path}.converts_to_stock_class_id`, 'Required target stock class is missing', {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
          });
        }

        const unsupportedFields = [
          ['ceiling_price_per_share', right.ceiling_price_per_share],
          ['custom_description', right.custom_description],
          ['discount_rate', right.discount_rate],
          ['expires_at', right.expires_at],
          ['floor_price_per_share', right.floor_price_per_share],
          ['percent_of_capitalization', right.percent_of_capitalization],
          ['reference_share_price', right.reference_share_price],
          ['reference_valuation_price_per_share', right.reference_valuation_price_per_share],
          ['valuation_cap', right.valuation_cap],
        ] as const;
        for (const [field, value] of unsupportedFields) {
          if (value !== null) {
            throw new OcpValidationError(
              `${path}.${field}`,
              `DAML field ${field} cannot be represented by canonical OCF StockClassConversionRight`,
              { code: OcpErrorCodes.SCHEMA_MISMATCH, receivedValue: value }
            );
          }
        }

        const trigger = right.conversion_trigger;
        const triggerPath = `${path}.conversion_trigger`;
        const expectedTriggerId = `ocp-sdk:stock-class:${damlData.id}:conversion-right:${index}:unspecified`;
        if (trigger.trigger_id !== expectedTriggerId) {
          throw new OcpValidationError(`${triggerPath}.trigger_id`, 'Unexpected storage-only trigger identifier', {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: expectedTriggerId,
            receivedValue: trigger.trigger_id,
          });
        }
        if (trigger.type_ !== 'OcfTriggerTypeTypeUnspecified') {
          throw new OcpValidationError(`${triggerPath}.type`, 'Unexpected storage-only trigger type', {
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            expectedType: 'OcfTriggerTypeTypeUnspecified',
            receivedValue: trigger.type_,
          });
        }
        const populatedTriggerField = [
          ['end_date', trigger.end_date],
          ['nickname', trigger.nickname],
          ['start_date', trigger.start_date],
          ['trigger_condition', trigger.trigger_condition],
          ['trigger_date', trigger.trigger_date],
          ['trigger_description', trigger.trigger_description],
        ].find((entry) => entry[1] !== null);
        if (populatedTriggerField) {
          throw new OcpValidationError(
            `${triggerPath}.${String(populatedTriggerField[0])}`,
            'Storage-only trigger fields must be empty',
            { code: OcpErrorCodes.SCHEMA_MISMATCH, receivedValue: populatedTriggerField[1] }
          );
        }
        if (trigger.conversion_right.tag !== 'OcfRightConvertible') {
          throw new OcpValidationError(
            `${triggerPath}.conversion_right.tag`,
            'Unexpected storage-only conversion-right variant',
            {
              code: OcpErrorCodes.SCHEMA_MISMATCH,
              expectedType: 'OcfRightConvertible',
              receivedValue: trigger.conversion_right.tag,
            }
          );
        }
        const sentinelRight = trigger.conversion_right.value;
        if (sentinelRight.type_ !== 'CONVERTIBLE_CONVERSION_RIGHT') {
          throw new OcpValidationError(
            `${triggerPath}.conversion_right.type`,
            'Unexpected storage-only conversion-right discriminator',
            {
              code: OcpErrorCodes.SCHEMA_MISMATCH,
              expectedType: 'CONVERTIBLE_CONVERSION_RIGHT',
              receivedValue: sentinelRight.type_,
            }
          );
        }
        if (
          sentinelRight.converts_to_stock_class_id !== right.converts_to_stock_class_id ||
          sentinelRight.converts_to_future_round !== right.converts_to_future_round
        ) {
          throw new OcpValidationError(
            `${triggerPath}.conversion_right`,
            'Storage-only conversion right does not match its stock-class right',
            { code: OcpErrorCodes.SCHEMA_MISMATCH }
          );
        }
        if (
          sentinelRight.conversion_mechanism.tag !== 'OcfConvMechCustom' ||
          sentinelRight.conversion_mechanism.value.custom_conversion_description !==
            'OCF stock-class conversion storage adapter'
        ) {
          throw new OcpValidationError(
            `${triggerPath}.conversion_right.conversion_mechanism`,
            'Unexpected storage-only conversion mechanism',
            { code: OcpErrorCodes.SCHEMA_MISMATCH }
          );
        }

        const mechanismObj: RatioConversionMechanism = {
          type: 'RATIO_CONVERSION',
          ratio: {
            numerator: normalizeNumericString(right.ratio.numerator),
            denominator: normalizeNumericString(right.ratio.denominator),
          },
          conversion_price: damlMonetaryToNative(right.conversion_price),
          // DAML v34 has no rounding field. The writer only accepts NORMAL.
          rounding_type: 'NORMAL',
        };

        const convRight: StockClassConversionRight = {
          type: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: mechanismObj,
          converts_to_stock_class_id: right.converts_to_stock_class_id,
          ...(right.converts_to_future_round !== null
            ? { converts_to_future_round: right.converts_to_future_round }
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

  return {
    stockClass: nativeStockClassData,
    contractId: params.contractId,
  };
}
