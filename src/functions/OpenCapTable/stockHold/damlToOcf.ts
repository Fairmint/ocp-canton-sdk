/**
 * DAML to OCF converter for StockHold entities (Fairmint OCF extension, TX_STOCK_HOLD).
 *
 * The register writes holds itself; the SDK only reads them.
 */

import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import type { PkgStockHoldOcfData } from '../../../types/daml';
import type { OcfStockHold } from '../../../types/native';
import { ocfEnumValue } from '../../../utils/damlEnums';
import { damlDateToDateString, normalizeNumericString } from '../../../utils/typeConversions';

/**
 * Convert DAML StockHold data to native OCF format.
 *
 * A `REGISTER_SETTLEMENT` hold names its `quantity`; a `STOP_TRANSFER` hold has none (it holds the whole security).
 *
 * @param d - The DAML stock hold data object
 * @returns The native OCF StockHold object
 * @throws OcpValidationError when the quantity does not match the hold type
 */
export function damlStockHoldToNative(d: PkgStockHoldOcfData): OcfStockHold {
  const holdType = ocfEnumValue('OcfHoldType', d.hold_type, 'stockHold.hold_type');
  const common = {
    object_type: 'TX_STOCK_HOLD',
    id: d.id,
    date: damlDateToDateString(d.date, 'stockHold.date'),
    security_id: d.security_id,
    reference: d.reference,
    reason_text: d.reason_text,
    ...(d.comments.length > 0 ? { comments: d.comments } : {}),
  } as const;

  if (holdType === 'REGISTER_SETTLEMENT') {
    if (d.quantity === null) {
      throw new OcpValidationError('stockHold.quantity', 'A REGISTER_SETTLEMENT hold requires a quantity', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        receivedValue: d.quantity,
      });
    }
    return { ...common, hold_type: holdType, quantity: normalizeNumericString(d.quantity, 'stockHold.quantity') };
  }

  if (d.quantity !== null) {
    throw new OcpValidationError('stockHold.quantity', 'A STOP_TRANSFER hold has no quantity', {
      code: OcpErrorCodes.INVALID_FORMAT,
      receivedValue: d.quantity,
    });
  }
  return { ...common, hold_type: holdType };
}
