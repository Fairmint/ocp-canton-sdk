/**
 * DAML to OCF converter functions for stock class adjustment types.
 *
 * These pure conversion functions transform DAML contract data to native OCF format.
 * They can be used independently or by the get*EventAsOcf functions.
 */

import type {
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockReissuance,
} from '../../../types/native';
import { normalizeNumericString } from '../../../utils/typeConversions';

// ===== DAML Data Type Interfaces =====

/** DAML StockClassSplitOcfData structure */
export interface DamlStockClassSplitData {
  id: string;
  date: string;
  stock_class_id: string;
  split_ratio: {
    numerator: string | number;
    denominator: string | number;
  };
  comments: string[];
}

/** DAML StockClassConversionRatioAdjustmentOcfData structure */
export interface DamlStockClassConversionRatioAdjustmentData {
  id: string;
  date: string;
  stock_class_id: string;
  new_ratio_conversion_mechanism: {
    conversion_price: { amount: string; currency: string };
    ratio: {
      numerator: string | number;
      denominator: string | number;
    };
    rounding_type: string;
  };
  comments: string[];
}

/** DAML StockConsolidationOcfData structure */
export interface DamlStockConsolidationData {
  id: string;
  date: string;
  security_ids: string[];
  resulting_security_id: string; // DAML has singular
  reason_text: string | null;
  comments: string[];
}

/** DAML StockReissuanceOcfData structure */
export interface DamlStockReissuanceData {
  id: string;
  date: string;
  security_id: string;
  resulting_security_ids: string[];
  reason_text: string | null;
  split_transaction_id: string | null;
  comments: string[];
}

// ===== Converter Functions =====

/**
 * Convert DAML StockClassSplit data to native OCF format.
 *
 * Handles the nested OcfRatio structure and normalizes numeric strings.
 */
export function damlStockClassSplitToNative(d: DamlStockClassSplitData): OcfStockClassSplit {
  const numeratorStr =
    typeof d.split_ratio.numerator === 'number' ? d.split_ratio.numerator.toString() : d.split_ratio.numerator;
  const denominatorStr =
    typeof d.split_ratio.denominator === 'number' ? d.split_ratio.denominator.toString() : d.split_ratio.denominator;

  return {
    id: d.id,
    date: d.date.split('T')[0],
    stock_class_id: d.stock_class_id,
    split_ratio_numerator: normalizeNumericString(numeratorStr),
    split_ratio_denominator: normalizeNumericString(denominatorStr),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}

/**
 * Convert DAML StockClassConversionRatioAdjustment data to native OCF format.
 *
 * Extracts the ratio from the nested OcfRatioConversionMechanism structure.
 */
export function damlStockClassConversionRatioAdjustmentToNative(
  d: DamlStockClassConversionRatioAdjustmentData
): OcfStockClassConversionRatioAdjustment {
  const numeratorStr =
    typeof d.new_ratio_conversion_mechanism.ratio.numerator === 'number'
      ? d.new_ratio_conversion_mechanism.ratio.numerator.toString()
      : d.new_ratio_conversion_mechanism.ratio.numerator;
  const denominatorStr =
    typeof d.new_ratio_conversion_mechanism.ratio.denominator === 'number'
      ? d.new_ratio_conversion_mechanism.ratio.denominator.toString()
      : d.new_ratio_conversion_mechanism.ratio.denominator;

  return {
    id: d.id,
    date: d.date.split('T')[0],
    stock_class_id: d.stock_class_id,
    new_ratio_numerator: normalizeNumericString(numeratorStr),
    new_ratio_denominator: normalizeNumericString(denominatorStr),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}

/**
 * Convert DAML StockConsolidation data to native OCF format.
 *
 * Converts DAML's singular resulting_security_id to OCF's resulting_security_ids array.
 */
export function damlStockConsolidationToNative(d: DamlStockConsolidationData): OcfStockConsolidation {
  return {
    id: d.id,
    date: d.date.split('T')[0],
    security_ids: d.security_ids,
    resulting_security_ids: [d.resulting_security_id], // DAML has singular, OCF expects array
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}

/**
 * Convert DAML StockReissuance data to native OCF format.
 */
export function damlStockReissuanceToNative(d: DamlStockReissuanceData): OcfStockReissuance {
  return {
    id: d.id,
    date: d.date.split('T')[0],
    security_id: d.security_id,
    resulting_security_ids: d.resulting_security_ids,
    ...(d.reason_text ? { reason_text: d.reason_text } : {}),
    ...(d.split_transaction_id ? { split_transaction_id: d.split_transaction_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments } : {}),
  };
}
