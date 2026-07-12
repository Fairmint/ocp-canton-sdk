/**
 * DAML to OCF converters for Valuation entities.
 */

import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfValuation, ValuationType } from '../../../types';
import { validateValuationData } from '../../../utils/entityValidators';
import { requireGeneratedRecord } from '../../../utils/generatedDamlValidation';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { requireGeneratedDamlMonetary } from '../shared/generatedDamlValues';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';

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
  const valuationType = Object.prototype.hasOwnProperty.call(DAML_VALUATION_TYPE_MAP, damlType)
    ? DAML_VALUATION_TYPE_MAP[damlType]
    : undefined;
  if (valuationType === undefined) {
    throw new OcpParseError(`Unknown DAML valuation type: ${damlType}`, {
      source: 'valuation.valuation_type',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return valuationType;
}

/**
 * DAML Valuation data structure.
 * This matches the shape of data returned from DAML contracts.
 */
export type DamlValuationData = Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData;

/**
 * Convert DAML Valuation data to native OCF format.
 *
 * @param d - The DAML valuation data object
 * @returns The native OCF Valuation object
 */
export function damlValuationToNative(value: unknown): OcfValuation {
  assertCanonicalJsonGraph(value, 'valuation');
  const d = requireGeneratedRecord(value, 'valuation') as unknown as DamlValuationData;
  const boardApprovalDate = optionalDamlTimeToDateString(d.board_approval_date, 'valuation.board_approval_date');
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    d.stockholder_approval_date,
    'valuation.stockholder_approval_date'
  );

  const native: OcfValuation = {
    object_type: 'VALUATION',
    id: d.id,
    stock_class_id: d.stock_class_id,
    price_per_share: requireGeneratedDamlMonetary(d.price_per_share, 'valuation.price_per_share'),
    effective_date: damlTimeToDateString(d.effective_date, 'valuation.effective_date'),
    valuation_type: damlValuationTypeToNative(d.valuation_type),
    ...(d.provider && { provider: d.provider }),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(d.comments.length > 0 && { comments: d.comments }),
  };
  validateValuationData(native, 'valuation');
  return native;
}
