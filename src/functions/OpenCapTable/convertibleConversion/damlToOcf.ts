/** DAML to OCF converters for ConvertibleConversion entities. */

import type { OcfConvertibleConversion } from '../../../types';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData } from '../capTable/damlEntityData';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML ConvertibleConversion payload. */
export type DamlConvertibleConversionData = DamlDataTypeFor<'convertibleConversion'>;

/** Convert generated DAML ConvertibleConversion data to canonical OCF. */
export function damlConvertibleConversionToNative(input: DamlConvertibleConversionData): OcfConvertibleConversion {
  const data = decodeDamlEntityData('convertibleConversion', input);
  const balanceSecurityId = data.balance_security_id ?? undefined;
  const capitalizationDefinition = data.capitalization_definition ?? undefined;
  const quantityConverted =
    data.quantity_converted === null
      ? undefined
      : requireGeneratedDamlNumeric10(data.quantity_converted, 'convertibleConversion.quantity_converted');

  return {
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: data.id,
    date: damlTimeToDateString(data.date, 'convertibleConversion.date'),
    reason_text: data.reason_text,
    security_id: data.security_id,
    trigger_id: data.trigger_id,
    resulting_security_ids: data.resulting_security_ids,
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
    ...(quantityConverted !== undefined ? { quantity_converted: quantityConverted } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}
