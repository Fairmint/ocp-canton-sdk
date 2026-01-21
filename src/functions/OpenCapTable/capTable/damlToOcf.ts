/**
 * Centralized DAML to OCF converter dispatcher for acceptance types.
 *
 * This module provides converters for transforming DAML acceptance transaction data
 * back to native OCF format. These are used when reading acceptance transactions
 * from the ledger.
 */

import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';

/**
 * DAML representation of acceptance transaction data.
 * All acceptance types share this common structure.
 */
export interface DamlAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Convert DAML Stock Acceptance data to native OCF format.
 *
 * @param damlData - The DAML stock acceptance data
 * @returns Native OCF StockAcceptance object
 */
export function damlStockAcceptanceToNative(damlData: DamlAcceptanceData): OcfStockAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}

/**
 * Convert DAML Warrant Acceptance data to native OCF format.
 *
 * @param damlData - The DAML warrant acceptance data
 * @returns Native OCF WarrantAcceptance object
 */
export function damlWarrantAcceptanceToNative(damlData: DamlAcceptanceData): OcfWarrantAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}

/**
 * Convert DAML Convertible Acceptance data to native OCF format.
 *
 * @param damlData - The DAML convertible acceptance data
 * @returns Native OCF ConvertibleAcceptance object
 */
export function damlConvertibleAcceptanceToNative(damlData: DamlAcceptanceData): OcfConvertibleAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}

/**
 * Convert DAML Equity Compensation Acceptance data to native OCF format.
 *
 * @param damlData - The DAML equity compensation acceptance data
 * @returns Native OCF EquityCompensationAcceptance object
 */
export function damlEquityCompensationAcceptanceToNative(
  damlData: DamlAcceptanceData
): OcfEquityCompensationAcceptance {
  return {
    id: damlData.id,
    date: damlTimeToDateString(damlData.date),
    security_id: damlData.security_id,
    ...(damlData.comments.length > 0 ? { comments: damlData.comments } : {}),
  };
}

/**
 * Type representing the acceptance entity types supported by this module.
 */
export type AcceptanceEntityType =
  | 'stockAcceptance'
  | 'warrantAcceptance'
  | 'convertibleAcceptance'
  | 'equityCompensationAcceptance';

/**
 * Map from acceptance entity type to its native OCF type.
 */
export interface AcceptanceOcfTypeMap {
  stockAcceptance: OcfStockAcceptance;
  warrantAcceptance: OcfWarrantAcceptance;
  convertibleAcceptance: OcfConvertibleAcceptance;
  equityCompensationAcceptance: OcfEquityCompensationAcceptance;
}

/**
 * Convert DAML acceptance data to native OCF format based on entity type.
 *
 * @param type - The acceptance entity type
 * @param damlData - The DAML acceptance data
 * @returns The native OCF acceptance object
 */
export function convertAcceptanceFromDaml<T extends AcceptanceEntityType>(
  type: T,
  damlData: DamlAcceptanceData
): AcceptanceOcfTypeMap[T] {
  switch (type) {
    case 'stockAcceptance':
      return damlStockAcceptanceToNative(damlData) as AcceptanceOcfTypeMap[T];
    case 'warrantAcceptance':
      return damlWarrantAcceptanceToNative(damlData) as AcceptanceOcfTypeMap[T];
    case 'convertibleAcceptance':
      return damlConvertibleAcceptanceToNative(damlData) as AcceptanceOcfTypeMap[T];
    case 'equityCompensationAcceptance':
      return damlEquityCompensationAcceptanceToNative(damlData) as AcceptanceOcfTypeMap[T];
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported acceptance entity type: ${exhaustiveCheck as string}`);
    }
  }
}
