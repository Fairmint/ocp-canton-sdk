import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { Monetary, OcfStockClass, StockClassConversionRight } from '../../../types/native';
import { damlStockClassTypeToNative } from '../../../utils/enumConversions';
import { isRecord, normalizeNumericString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { ratioMechanismFromDaml } from '../shared/conversionMechanisms';
import { readSingleContract } from '../shared/singleContractRead';

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function invalidFormat(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return value;
}

function requireNumeric(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'decimal string or number', value);
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw invalidType(field, 'decimal string or number', value);
  }
  return normalizeNumericString(value, field);
}

function optionalNumeric(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  return requireNumeric(value, field);
}

function monetaryFromDaml(value: unknown, field: string): Monetary {
  const monetary = requireRecord(value, field);
  return {
    amount: requireNumeric(monetary.amount, `${field}.amount`),
    currency: requireString(monetary.currency, `${field}.currency`),
  };
}

function optionalMonetaryFromDaml(value: unknown, field: string): Monetary | undefined {
  if (value === null || value === undefined) return undefined;
  return monetaryFromDaml(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalidType(field, 'boolean', value);
  return value;
}

function initialSharesFromDaml(value: unknown): string {
  const field = 'stockClass.initial_shares_authorized';
  if (value === null || value === undefined) throw requiredMissing(field, 'initial shares variant', value);
  if (typeof value === 'string' || typeof value === 'number') return requireNumeric(value, field);

  const variant = requireRecord(value, field);
  const tag = requireString(variant.tag, `${field}.tag`);
  switch (tag) {
    case 'OcfInitialSharesNumeric':
      return requireNumeric(variant.value, `${field}.value`);
    case 'OcfInitialSharesEnum': {
      const enumValue = requireString(variant.value, `${field}.value`);
      switch (enumValue) {
        case 'OcfAuthorizedSharesUnlimited':
          return 'UNLIMITED';
        case 'OcfAuthorizedSharesNotApplicable':
          return 'NOT APPLICABLE';
        default:
          throw new OcpParseError(`Unknown initial_shares_authorized enum value: ${enumValue}`, {
            source: `${field}.value`,
            code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
          });
      }
    }
    default:
      throw new OcpParseError(`Unknown initial_shares_authorized variant: ${tag}`, {
        source: `${field}.tag`,
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

function conversionRightsFromDaml(value: unknown): StockClassConversionRight[] {
  const field = 'stockClass.conversion_rights';
  return requireArray(value, field).map((item, index) => {
    const source = `${field}.${index}`;
    const right = requireRecord(item, source);
    const rightType = requireString(right.type_, `${source}.type_`);
    if (rightType !== 'STOCK_CLASS_CONVERSION_RIGHT') {
      throw new OcpParseError(`Unknown stock class conversion right type: ${rightType}`, {
        source: `${source}.type_`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
    }
    const conversionMechanism = ratioMechanismFromDaml(
      {
        conversion_mechanism: right.conversion_mechanism,
        ratio: right.ratio,
        conversion_price: right.conversion_price,
      },
      `${source}.conversion_mechanism`
    );
    const convertsToFutureRound = optionalBoolean(right.converts_to_future_round, `${source}.converts_to_future_round`);
    return {
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: conversionMechanism,
      converts_to_stock_class_id: requireString(
        right.converts_to_stock_class_id,
        `${source}.converts_to_stock_class_id`
      ),
      ...(convertsToFutureRound !== undefined ? { converts_to_future_round: convertsToFutureRound } : {}),
    };
  });
}

function commentsFromDaml(value: unknown): string[] {
  const field = 'stockClass.comments';
  return requireArray(value, field).map((comment, index) => requireString(comment, `${field}.${index}`));
}

/** Convert decoded DAML StockClass data to the canonical OCF shape. */
export function damlStockClassDataToNative(value: unknown): OcfStockClass {
  const data = requireRecord(value, 'stockClass');
  const classType = requireString(data.class_type, 'stockClass.class_type');
  const boardApprovalDate = optionalDamlTimeToDateString(data.board_approval_date, 'stockClass.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    data.stockholder_approval_date,
    'stockClass.stockholder_approval_date'
  );
  const parValue = optionalMonetaryFromDaml(data.par_value, 'stockClass.par_value');
  const pricePerShare = optionalMonetaryFromDaml(data.price_per_share, 'stockClass.price_per_share');
  const liquidationPreferenceMultiple = optionalNumeric(
    data.liquidation_preference_multiple,
    'stockClass.liquidation_preference_multiple'
  );
  const participationCapMultiple = optionalNumeric(
    data.participation_cap_multiple,
    'stockClass.participation_cap_multiple'
  );

  return {
    object_type: 'STOCK_CLASS',
    id: requireString(data.id, 'stockClass.id'),
    name: requireString(data.name, 'stockClass.name'),
    class_type: damlStockClassTypeToNative(classType),
    default_id_prefix: requireString(data.default_id_prefix, 'stockClass.default_id_prefix'),
    initial_shares_authorized: initialSharesFromDaml(data.initial_shares_authorized),
    votes_per_share: requireNumeric(data.votes_per_share, 'stockClass.votes_per_share'),
    seniority: requireNumeric(data.seniority, 'stockClass.seniority'),
    conversion_rights: conversionRightsFromDaml(data.conversion_rights),
    comments: commentsFromDaml(data.comments),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(parValue !== undefined ? { par_value: parValue } : {}),
    ...(pricePerShare !== undefined ? { price_per_share: pricePerShare } : {}),
    ...(liquidationPreferenceMultiple !== undefined
      ? { liquidation_preference_multiple: liquidationPreferenceMultiple }
      : {}),
    ...(participationCapMultiple !== undefined ? { participation_cap_multiple: participationCapMultiple } : {}),
  };
}

export interface GetStockClassAsOcfParams extends GetByContractIdParams {}

export interface GetStockClassAsOcfResult {
  /** The OCF StockClass object */
  stockClass: OcfStockClass;
  /** The original contract ID */
  contractId: string;
}

/** Retrieve a stock class contract by ID and return it as an OCF JSON object. */
export async function getStockClassAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAsOcfParams
): Promise<GetStockClassAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
  });

  if (!isRecord(createArgument) || !('stock_class_data' in createArgument)) {
    throw new OcpParseError('Stock class data not found in contract create argument', {
      source: 'StockClass.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  return {
    stockClass: damlStockClassDataToNative(createArgument.stock_class_data),
    contractId: params.contractId,
  };
}
