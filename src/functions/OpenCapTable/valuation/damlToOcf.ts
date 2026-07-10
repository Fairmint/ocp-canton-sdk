/**
 * DAML to OCF converters for Valuation entities.
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfValuation, ValuationType } from '../../../types';
import {
  damlMonetaryToNative,
  damlTimeToDateString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';

/** DAML ValuationType to OCF ValuationType mapping. */
const DAML_VALUATION_TYPE_MAP: Record<string, ValuationType> = {
  OcfValuationType409A: '409A',
};

/**
 * Convert DAML OcfValuationType to OCF ValuationType.
 *
 * @param damlType - The DAML valuation type string
 * @returns The OCF valuation type
 * @throws OcpParseError if the DAML type is unknown
 */
export function damlValuationTypeToNative(damlType: string): ValuationType {
  if (!(damlType in DAML_VALUATION_TYPE_MAP)) {
    throw new OcpParseError(`Unknown DAML valuation type: ${damlType}`, {
      source: 'valuation.valuation_type',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return DAML_VALUATION_TYPE_MAP[damlType];
}

/**
 * DAML Valuation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export interface DamlValuationData {
  id: string;
  stock_class_id: string;
  provider: string | null;
  board_approval_date: string | null;
  stockholder_approval_date: string | null;
  price_per_share: { amount: string; currency: string };
  effective_date: string;
  valuation_type: string;
  comments: string[];
}

/**
 * Convert DAML Valuation data to native OCF format.
 *
 * @param d - The DAML valuation data object
 * @returns The native OCF Valuation object
 */
export function damlValuationToNative(d: DamlValuationData): OcfValuation {
  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'valuation.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'valuation.stockholder_approval_date'
  );

  return {
    object_type: 'VALUATION',
    id: d.id,
    stock_class_id: d.stock_class_id,
    price_per_share: damlMonetaryToNative(d.price_per_share),
    effective_date: damlTimeToDateString(d.effective_date, 'valuation.effective_date'),
    valuation_type: damlValuationTypeToNative(d.valuation_type),
    ...(d.provider && { provider: d.provider }),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
}
