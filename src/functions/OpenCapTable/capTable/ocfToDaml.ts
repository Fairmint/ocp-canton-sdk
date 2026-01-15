/**
 * Centralized OCF to DAML converter dispatcher.
 *
 * This module provides a unified interface for converting native OCF data types to their DAML equivalents, used by the
 * batch UpdateCapTable API.
 */

import type { OcfDataTypeFor, OcfEntityType } from './batchTypes';

// Import existing converters
import { convertibleCancellationDataToDaml } from '../convertibleCancellation/createConvertibleCancellation';
import { convertibleIssuanceDataToDaml } from '../convertibleIssuance/createConvertibleIssuance';
import { documentDataToDaml } from '../document/createDocument';
import { equityCompensationCancellationDataToDaml } from '../equityCompensationCancellation/createEquityCompensationCancellation';
import { equityCompensationExerciseDataToDaml } from '../equityCompensationExercise/createEquityCompensationExercise';
import { equityCompensationIssuanceDataToDaml } from '../equityCompensationIssuance/createEquityCompensationIssuance';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { stakeholderDataToDaml } from '../stakeholder/stakeholderDataToDaml';
import { stockCancellationDataToDaml } from '../stockCancellation/createStockCancellation';
import { stockClassDataToDaml } from '../stockClass/stockClassDataToDaml';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { stockIssuanceDataToDaml } from '../stockIssuance/createStockIssuance';
import { stockLegendTemplateDataToDaml } from '../stockLegendTemplate/createStockLegendTemplate';
import { stockPlanDataToDaml } from '../stockPlan/createStockPlan';
import { stockPlanPoolAdjustmentDataToDaml } from '../stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { stockRepurchaseDataToDaml } from '../stockRepurchase/stockRepurchaseDataToDaml';
import { stockTransferDataToDaml } from '../stockTransfer/createStockTransfer';
import { vestingTermsDataToDaml } from '../vestingTerms/createVestingTerms';
import { warrantCancellationDataToDaml } from '../warrantCancellation/createWarrantCancellation';
import { warrantIssuanceDataToDaml } from '../warrantIssuance/createWarrantIssuance';

// Import shared conversion utilities for types that don't have dedicated converters yet
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';

import type {
  OcfConvertibleAcceptance,
  OcfConvertibleConversion,
  OcfConvertibleRetraction,
  OcfConvertibleTransfer,
  OcfEquityCompensationAcceptance,
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfEquityCompensationRetraction,
  OcfEquityCompensationTransfer,
  OcfStockAcceptance,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockPlanReturnToPool,
  OcfStockReissuance,
  OcfStockRetraction,
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfWarrantAcceptance,
  OcfWarrantExercise,
  OcfWarrantRetraction,
  OcfWarrantTransfer,
  ValuationType,
} from '../../../types';

/**
 * Map from OCF ValuationType to DAML OcfValuationType. Currently OCF only supports '409A', which maps to
 * 'OcfValuationType409A'.
 */
const VALUATION_TYPE_MAP: Record<ValuationType, string> = {
  '409A': 'OcfValuationType409A',
};

// ===== Simple converters for types without dedicated files =====

function stockAcceptanceDataToDaml(d: OcfStockAcceptance): Record<string, unknown> {
  if (!d.id) throw new Error('stockAcceptance.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    comments: cleanComments(d.comments),
  };
}

function stockRetractionDataToDaml(d: OcfStockRetraction): Record<string, unknown> {
  if (!d.id) throw new Error('stockRetraction.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

function stockConversionDataToDaml(d: OcfStockConversion): Record<string, unknown> {
  if (!d.id) throw new Error('stockConversion.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    comments: cleanComments(d.comments),
  };
}

function stockReissuanceDataToDaml(d: OcfStockReissuance): Record<string, unknown> {
  if (!d.id) throw new Error('stockReissuance.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}

function stockConsolidationDataToDaml(d: OcfStockConsolidation): Record<string, unknown> {
  if (!d.id) throw new Error('stockConsolidation.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_ids: d.security_ids,
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}

function stockClassSplitDataToDaml(d: OcfStockClassSplit): Record<string, unknown> {
  if (!d.id) throw new Error('stockClassSplit.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    split_ratio_numerator: numberToString(d.split_ratio_numerator),
    split_ratio_denominator: numberToString(d.split_ratio_denominator),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}

function stockClassConversionRatioAdjustmentDataToDaml(
  d: OcfStockClassConversionRatioAdjustment
): Record<string, unknown> {
  if (!d.id) throw new Error('stockClassConversionRatioAdjustment.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_ratio_numerator: numberToString(d.new_ratio_numerator),
    new_ratio_denominator: numberToString(d.new_ratio_denominator),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}

function stockPlanReturnToPoolDataToDaml(d: OcfStockPlanReturnToPool): Record<string, unknown> {
  if (!d.id) throw new Error('stockPlanReturnToPool.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_plan_id: d.stock_plan_id,
    quantity: numberToString(d.quantity),
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

function valuationDataToDaml(d: OcfValuation): Record<string, unknown> {
  if (!d.id) throw new Error('valuation.id is required');

  const damlValuationType = VALUATION_TYPE_MAP[d.valuation_type];

  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    provider: optionalString(d.provider),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    price_per_share: monetaryToDaml(d.price_per_share),
    effective_date: dateStringToDAMLTime(d.effective_date),
    valuation_type: damlValuationType,
    comments: cleanComments(d.comments),
  };
}

function vestingStartDataToDaml(d: OcfVestingStart): Record<string, unknown> {
  if (!d.id) throw new Error('vestingStart.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}

function vestingEventDataToDaml(d: OcfVestingEvent): Record<string, unknown> {
  if (!d.id) throw new Error('vestingEvent.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    vesting_condition_id: d.vesting_condition_id,
    comments: cleanComments(d.comments),
  };
}

function vestingAccelerationDataToDaml(d: OcfVestingAcceleration): Record<string, unknown> {
  if (!d.id) throw new Error('vestingAcceleration.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

// Warrant converters
function warrantAcceptanceDataToDaml(d: OcfWarrantAcceptance): Record<string, unknown> {
  if (!d.id) throw new Error('warrantAcceptance.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    comments: cleanComments(d.comments),
  };
}

function warrantExerciseDataToDaml(d: OcfWarrantExercise): Record<string, unknown> {
  if (!d.id) throw new Error('warrantExercise.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

function warrantRetractionDataToDaml(d: OcfWarrantRetraction): Record<string, unknown> {
  if (!d.id) throw new Error('warrantRetraction.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

function warrantTransferDataToDaml(d: OcfWarrantTransfer): Record<string, unknown> {
  if (!d.id) throw new Error('warrantTransfer.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

// Convertible converters
function convertibleAcceptanceDataToDaml(d: OcfConvertibleAcceptance): Record<string, unknown> {
  if (!d.id) throw new Error('convertibleAcceptance.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    comments: cleanComments(d.comments),
  };
}

function convertibleConversionDataToDaml(d: OcfConvertibleConversion): Record<string, unknown> {
  if (!d.id) throw new Error('convertibleConversion.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    trigger_id: optionalString(d.trigger_id),
    comments: cleanComments(d.comments),
  };
}

function convertibleRetractionDataToDaml(d: OcfConvertibleRetraction): Record<string, unknown> {
  if (!d.id) throw new Error('convertibleRetraction.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

function convertibleTransferDataToDaml(d: OcfConvertibleTransfer): Record<string, unknown> {
  if (!d.id) throw new Error('convertibleTransfer.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    amount: monetaryToDaml(d.amount),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

// Equity compensation converters
function equityCompensationAcceptanceDataToDaml(d: OcfEquityCompensationAcceptance): Record<string, unknown> {
  if (!d.id) throw new Error('equityCompensationAcceptance.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    comments: cleanComments(d.comments),
  };
}

function equityCompensationReleaseDataToDaml(d: OcfEquityCompensationRelease): Record<string, unknown> {
  if (!d.id) throw new Error('equityCompensationRelease.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    settlement_date: d.settlement_date ? dateStringToDAMLTime(d.settlement_date) : null,
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

function equityCompensationRepricingDataToDaml(d: OcfEquityCompensationRepricing): Record<string, unknown> {
  if (!d.id) throw new Error('equityCompensationRepricing.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    comments: cleanComments(d.comments),
  };
}

function equityCompensationRetractionDataToDaml(d: OcfEquityCompensationRetraction): Record<string, unknown> {
  if (!d.id) throw new Error('equityCompensationRetraction.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    reason_text: d.reason_text,
    comments: cleanComments(d.comments),
  };
}

function equityCompensationTransferDataToDaml(d: OcfEquityCompensationTransfer): Record<string, unknown> {
  if (!d.id) throw new Error('equityCompensationTransfer.id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

/**
 * Convert native OCF data to DAML format based on entity type.
 *
 * @param type - The OCF entity type
 * @param data - The native OCF data object
 * @returns The DAML-formatted data object
 */
export function convertToDaml<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): Record<string, unknown> {
  switch (type) {
    case 'stakeholder':
      return stakeholderDataToDaml(data as OcfDataTypeFor<'stakeholder'>);
    case 'stockClass':
      return stockClassDataToDaml(data as OcfDataTypeFor<'stockClass'>);
    case 'stockIssuance':
      return stockIssuanceDataToDaml(data as OcfDataTypeFor<'stockIssuance'>);
    case 'vestingTerms':
      return vestingTermsDataToDaml(data as OcfDataTypeFor<'vestingTerms'>);
    case 'document':
      return documentDataToDaml(data as OcfDataTypeFor<'document'>);
    case 'stockLegendTemplate':
      return stockLegendTemplateDataToDaml(data as OcfDataTypeFor<'stockLegendTemplate'>);
    case 'stockPlan':
      return stockPlanDataToDaml(data as OcfDataTypeFor<'stockPlan'>);
    case 'equityCompensationIssuance':
      return equityCompensationIssuanceDataToDaml(data as OcfDataTypeFor<'equityCompensationIssuance'>);
    case 'convertibleIssuance':
      // The converter expects a specific input type, cast through unknown
      return convertibleIssuanceDataToDaml(data as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]);
    case 'warrantIssuance':
      // The converter expects a specific input type, cast through unknown
      return warrantIssuanceDataToDaml(data as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0]);
    case 'stockCancellation':
      return stockCancellationDataToDaml(data as OcfDataTypeFor<'stockCancellation'>);
    case 'equityCompensationExercise':
      return equityCompensationExerciseDataToDaml(data as OcfDataTypeFor<'equityCompensationExercise'>);
    case 'stockTransfer':
      return stockTransferDataToDaml(data as OcfDataTypeFor<'stockTransfer'>);
    case 'stockRepurchase':
      return stockRepurchaseDataToDaml(data as OcfDataTypeFor<'stockRepurchase'>);
    case 'issuerAuthorizedSharesAdjustment':
      return issuerAuthorizedSharesAdjustmentDataToDaml(data as OcfDataTypeFor<'issuerAuthorizedSharesAdjustment'>);
    case 'stockClassAuthorizedSharesAdjustment':
      return stockClassAuthorizedSharesAdjustmentDataToDaml(
        data as OcfDataTypeFor<'stockClassAuthorizedSharesAdjustment'>
      );
    case 'stockPlanPoolAdjustment':
      return stockPlanPoolAdjustmentDataToDaml(data as OcfDataTypeFor<'stockPlanPoolAdjustment'>);
    case 'equityCompensationCancellation':
      return equityCompensationCancellationDataToDaml(data as OcfDataTypeFor<'equityCompensationCancellation'>);
    case 'convertibleCancellation':
      return convertibleCancellationDataToDaml(data as OcfDataTypeFor<'convertibleCancellation'>);
    case 'warrantCancellation':
      return warrantCancellationDataToDaml(data as OcfDataTypeFor<'warrantCancellation'>);

    // Types with inline converters
    case 'stockAcceptance':
      return stockAcceptanceDataToDaml(data as OcfDataTypeFor<'stockAcceptance'>);
    case 'stockRetraction':
      return stockRetractionDataToDaml(data as OcfDataTypeFor<'stockRetraction'>);
    case 'stockConversion':
      return stockConversionDataToDaml(data as OcfDataTypeFor<'stockConversion'>);
    case 'stockReissuance':
      return stockReissuanceDataToDaml(data as OcfDataTypeFor<'stockReissuance'>);
    case 'stockConsolidation':
      return stockConsolidationDataToDaml(data as OcfDataTypeFor<'stockConsolidation'>);
    case 'stockClassSplit':
      return stockClassSplitDataToDaml(data as OcfDataTypeFor<'stockClassSplit'>);
    case 'stockClassConversionRatioAdjustment':
      return stockClassConversionRatioAdjustmentDataToDaml(
        data as OcfDataTypeFor<'stockClassConversionRatioAdjustment'>
      );
    case 'stockPlanReturnToPool':
      return stockPlanReturnToPoolDataToDaml(data as OcfDataTypeFor<'stockPlanReturnToPool'>);
    case 'valuation':
      return valuationDataToDaml(data as OcfDataTypeFor<'valuation'>);
    case 'vestingStart':
      return vestingStartDataToDaml(data as OcfDataTypeFor<'vestingStart'>);
    case 'vestingEvent':
      return vestingEventDataToDaml(data as OcfDataTypeFor<'vestingEvent'>);
    case 'vestingAcceleration':
      return vestingAccelerationDataToDaml(data as OcfDataTypeFor<'vestingAcceleration'>);
    case 'warrantAcceptance':
      return warrantAcceptanceDataToDaml(data as OcfDataTypeFor<'warrantAcceptance'>);
    case 'warrantExercise':
      return warrantExerciseDataToDaml(data as OcfDataTypeFor<'warrantExercise'>);
    case 'warrantRetraction':
      return warrantRetractionDataToDaml(data as OcfDataTypeFor<'warrantRetraction'>);
    case 'warrantTransfer':
      return warrantTransferDataToDaml(data as OcfDataTypeFor<'warrantTransfer'>);
    case 'convertibleAcceptance':
      return convertibleAcceptanceDataToDaml(data as OcfDataTypeFor<'convertibleAcceptance'>);
    case 'convertibleConversion':
      return convertibleConversionDataToDaml(data as OcfDataTypeFor<'convertibleConversion'>);
    case 'convertibleRetraction':
      return convertibleRetractionDataToDaml(data as OcfDataTypeFor<'convertibleRetraction'>);
    case 'convertibleTransfer':
      return convertibleTransferDataToDaml(data as OcfDataTypeFor<'convertibleTransfer'>);
    case 'equityCompensationAcceptance':
      return equityCompensationAcceptanceDataToDaml(data as OcfDataTypeFor<'equityCompensationAcceptance'>);
    case 'equityCompensationRelease':
      return equityCompensationReleaseDataToDaml(data as OcfDataTypeFor<'equityCompensationRelease'>);
    case 'equityCompensationRepricing':
      return equityCompensationRepricingDataToDaml(data as OcfDataTypeFor<'equityCompensationRepricing'>);
    case 'equityCompensationRetraction':
      return equityCompensationRetractionDataToDaml(data as OcfDataTypeFor<'equityCompensationRetraction'>);
    case 'equityCompensationTransfer':
      return equityCompensationTransferDataToDaml(data as OcfDataTypeFor<'equityCompensationTransfer'>);

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported entity type: ${exhaustiveCheck as string}`);
    }
  }
}
