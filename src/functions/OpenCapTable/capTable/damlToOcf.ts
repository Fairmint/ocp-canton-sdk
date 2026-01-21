/**
 * Centralized DAML to OCF converter dispatcher for acceptance types.
 *
 * This module provides a unified interface for converting DAML acceptance data to their OCF equivalents.
 * Converter implementations are imported from their respective entity folders.
 */

import type {
  OcfConvertibleAcceptance,
  OcfEquityCompensationAcceptance,
  OcfStockAcceptance,
  OcfWarrantAcceptance,
} from '../../../types';

// Import converters from entity folders
import {
  damlConvertibleAcceptanceToNative,
  type DamlConvertibleAcceptanceData,
} from '../convertibleAcceptance/convertibleAcceptanceDataToDaml';
import {
  damlEquityCompensationAcceptanceToNative,
  type DamlEquityCompensationAcceptanceData,
} from '../equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
import {
  damlStockAcceptanceToNative,
  type DamlStockAcceptanceData,
} from '../stockAcceptance/stockAcceptanceDataToDaml';
import {
  damlWarrantAcceptanceToNative,
  type DamlWarrantAcceptanceData,
} from '../warrantAcceptance/warrantAcceptanceDataToDaml';

// Re-export individual converters for direct use
export { damlConvertibleAcceptanceToNative } from '../convertibleAcceptance/convertibleAcceptanceDataToDaml';
export { damlEquityCompensationAcceptanceToNative } from '../equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
export { damlStockAcceptanceToNative } from '../stockAcceptance/stockAcceptanceDataToDaml';
export { damlWarrantAcceptanceToNative } from '../warrantAcceptance/warrantAcceptanceDataToDaml';

/**
 * Common DAML acceptance data structure shared by all acceptance types.
 */
export interface DamlAcceptanceData {
  id: string;
  date: string;
  security_id: string;
  comments: string[];
}

/**
 * Supported acceptance entity types for the dispatcher.
 */
export type AcceptanceEntityType =
  | 'stockAcceptance'
  | 'warrantAcceptance'
  | 'convertibleAcceptance'
  | 'equityCompensationAcceptance';

/**
 * Type mapping from acceptance entity type to its corresponding OCF type.
 */
export interface AcceptanceOcfTypeMap {
  stockAcceptance: OcfStockAcceptance;
  warrantAcceptance: OcfWarrantAcceptance;
  convertibleAcceptance: OcfConvertibleAcceptance;
  equityCompensationAcceptance: OcfEquityCompensationAcceptance;
}

/**
 * Type-safe DAML to OCF converter dispatcher for acceptance types.
 *
 * @param type - The acceptance entity type
 * @param damlData - The DAML-formatted acceptance data
 * @returns The native OCF acceptance object of the corresponding type
 */
export function convertAcceptanceFromDaml<T extends AcceptanceEntityType>(
  type: T,
  damlData: DamlAcceptanceData
): AcceptanceOcfTypeMap[T] {
  switch (type) {
    case 'stockAcceptance':
      return damlStockAcceptanceToNative(damlData as DamlStockAcceptanceData) as AcceptanceOcfTypeMap[T];
    case 'warrantAcceptance':
      return damlWarrantAcceptanceToNative(damlData as DamlWarrantAcceptanceData) as AcceptanceOcfTypeMap[T];
    case 'convertibleAcceptance':
      return damlConvertibleAcceptanceToNative(damlData as DamlConvertibleAcceptanceData) as AcceptanceOcfTypeMap[T];
    case 'equityCompensationAcceptance':
      return damlEquityCompensationAcceptanceToNative(
        damlData as DamlEquityCompensationAcceptanceData
      ) as AcceptanceOcfTypeMap[T];
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported acceptance type: ${exhaustiveCheck as string}`);
    }
  }
}
