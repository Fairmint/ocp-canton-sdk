/** DAML to OCF converters for StockConversion entities. */

import type { OcfStockConversion } from '../../../types';
import type { DeepReadonly } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import {
  freezeConversionExerciseEvent,
  generatedOptionalConversionExerciseText,
  requireGeneratedConversionExerciseComments,
  requireGeneratedConversionExerciseResultIds,
  requireGeneratedConversionExerciseText,
} from '../shared/conversionExerciseReadValues';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML StockConversion payload. */
export type DamlStockConversionData = DamlDataTypeFor<'stockConversion'>;

/** Convert generated DAML StockConversion data to canonical OCF. */
export function damlStockConversionToNative(input: DamlStockConversionData): DeepReadonly<OcfStockConversion> {
  const data = decodeDamlEntityData('stockConversion', input);
  const balanceSecurityId = generatedOptionalConversionExerciseText(
    data.balance_security_id,
    'stockConversion.balance_security_id'
  );
  const comments = requireGeneratedConversionExerciseComments(data.comments, 'stockConversion.comments');

  return freezeConversionExerciseEvent({
    object_type: 'TX_STOCK_CONVERSION',
    id: requireGeneratedConversionExerciseText(data.id, 'stockConversion.id'),
    date: damlTimeToDateString(data.date, 'stockConversion.date'),
    security_id: requireGeneratedConversionExerciseText(data.security_id, 'stockConversion.security_id'),
    quantity_converted: requireGeneratedDamlNumeric10(
      data.quantity_converted,
      'stockConversion.quantity_converted',
      'positive'
    ),
    resulting_security_ids: requireGeneratedConversionExerciseResultIds(
      data.resulting_security_ids,
      'stockConversion.resulting_security_ids'
    ),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
