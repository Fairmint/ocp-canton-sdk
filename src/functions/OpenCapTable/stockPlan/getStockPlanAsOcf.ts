import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlan, StockPlanCancellationBehavior } from '../../../types/native';
import {
  assertSafeGeneratedDamlJson,
  decodeGeneratedDaml,
  extractGeneratedCreateArgumentData,
  rejectUnknownGeneratedFields,
  requireGeneratedRecord,
  requireGeneratedString,
  requireGeneratedStringArray,
} from '../../../utils/generatedDamlValidation';
import { canonicalizeNumeric10 } from '../../../utils/numeric10';
import { optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

function damlCancellationBehaviorToNative(b: string | null | undefined): StockPlanCancellationBehavior | undefined {
  if (b === null || b === undefined) return undefined;
  switch (b) {
    case 'OcfPlanCancelRetire':
      return 'RETIRE';
    case 'OcfPlanCancelReturnToPool':
      return 'RETURN_TO_POOL';
    case 'OcfPlanCancelHoldAsCapitalStock':
      return 'HOLD_AS_CAPITAL_STOCK';
    case 'OcfPlanCancelDefinedPerPlanSecurity':
      return 'DEFINED_PER_PLAN_SECURITY';
    default:
      throw new OcpParseError(`Unknown DAML cancellation behavior: ${b}`, {
        source: 'stockPlan.default_cancellation_behavior',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
  }
}

export function damlStockPlanDataToNative(d: unknown): OcfStockPlan {
  const rootPath = 'stockPlan';
  assertSafeGeneratedDamlJson(d, rootPath);
  const source = requireGeneratedRecord(d, rootPath);
  rejectUnknownGeneratedFields(source, rootPath, [
    'id',
    'initial_shares_reserved',
    'plan_name',
    'comments',
    'stock_class_ids',
    'board_approval_date',
    'default_cancellation_behavior',
    'stockholder_approval_date',
  ]);
  for (const field of ['id', 'initial_shares_reserved', 'plan_name'] as const) {
    requireGeneratedString(source[field], `${rootPath}.${field}`);
  }
  requireGeneratedStringArray(source.comments, `${rootPath}.comments`);
  requireGeneratedStringArray(source.stock_class_ids, `${rootPath}.stock_class_ids`);
  for (const field of ['board_approval_date', 'default_cancellation_behavior', 'stockholder_approval_date'] as const) {
    if (source[field] !== null && source[field] !== undefined) {
      requireGeneratedString(source[field], `${rootPath}.${field}`);
    }
  }
  const decoded = decodeGeneratedDaml(
    d,
    {
      decode: (value) => Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData.decoder.runWithException(value),
      encode: (value) => Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData.encode(value),
    },
    rootPath
  );

  const { id } = decoded;

  // Validate required fields - fail fast if missing
  if (typeof id !== 'string' || id.length === 0) {
    throw new OcpValidationError('stockPlan.id', 'Required field is missing or invalid', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: id,
    });
  }
  if (!decoded.plan_name) {
    throw new OcpValidationError('stockPlan.plan_name', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: decoded.plan_name,
    });
  }
  const initialSharesReserved: unknown = decoded.initial_shares_reserved;
  if (initialSharesReserved === undefined || initialSharesReserved === null) {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Required field is missing', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: initialSharesReserved,
    });
  }
  if (typeof initialSharesReserved !== 'string') {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', 'Invalid initial_shares_reserved format', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: initialSharesReserved,
    });
  }
  const stockClassIds: unknown = decoded.stock_class_ids;
  if (!Array.isArray(stockClassIds)) {
    throw new OcpValidationError('stockPlan.stock_class_ids', 'Expected at least one stock class identifier', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: '[string, ...string[]]',
      receivedValue: stockClassIds,
    });
  }
  const firstStockClassId: unknown = stockClassIds[0];
  const remainingStockClassIds: unknown[] = stockClassIds.slice(1);
  if (
    typeof firstStockClassId !== 'string' ||
    !remainingStockClassIds.every((stockClassId): stockClassId is string => typeof stockClassId === 'string')
  ) {
    throw new OcpValidationError('stockPlan.stock_class_ids', 'Expected at least one stock class identifier', {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: '[string, ...string[]]',
      receivedValue: stockClassIds,
    });
  }
  const defaultCancellationBehavior = damlCancellationBehaviorToNative(decoded.default_cancellation_behavior);

  const numeric = canonicalizeNumeric10(initialSharesReserved, { allowExponent: true });
  if (!numeric.ok) {
    throw new OcpValidationError('stockPlan.initial_shares_reserved', numeric.message, {
      code: OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'DAML Numeric 10 string',
      receivedValue: initialSharesReserved,
    });
  }

  const boardApprovalDate = optionalDamlTimeToDateString(decoded.board_approval_date, 'stockPlan.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    decoded.stockholder_approval_date,
    'stockPlan.stockholder_approval_date'
  );

  return {
    object_type: 'STOCK_PLAN',
    id,
    plan_name: decoded.plan_name,
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    initial_shares_reserved: numeric.value,
    ...(defaultCancellationBehavior !== undefined
      ? { default_cancellation_behavior: defaultCancellationBehavior }
      : {}),
    stock_class_ids: [firstStockClassId, ...remainingStockClassIds],
    comments: [...decoded.comments],
  };
}

export interface GetStockPlanAsOcfParams extends GetByContractIdParams {}

export interface GetStockPlanAsOcfResult {
  stockPlan: OcfStockPlan;
  contractId: string;
}

/**
 * Retrieve a stock plan contract and return it as an OCF JSON object
 *
 * @see https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockPlan.schema.json
 */
export async function getStockPlanAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanAsOcfParams
): Promise<GetStockPlanAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockPlanAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
  });

  const argumentPath = 'StockPlan.createArgument';
  const planData = extractGeneratedCreateArgumentData(createArgument, argumentPath, {
    dataField: 'plan_data',
  });
  const stockPlan = damlStockPlanDataToNative(planData);

  return { stockPlan, contractId: params.contractId };
}
