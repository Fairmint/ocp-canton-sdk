/** DAML to OCF converters for ConvertibleConversion entities. */

import type { OcfConvertibleConversion } from '../../../types';
import type { DeepReadonly } from '../../../types/common';
import { damlTimeToDateString } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, type ReadonlyDamlDataTypeFor } from '../capTable/damlEntityData';
import {
  freezeConversionExerciseEvent,
  generatedConversionCapitalizationDefinition,
  generatedOptionalConversionExerciseText,
  requireGeneratedConversionExerciseComments,
  requireGeneratedConversionExerciseResultIds,
  requireGeneratedConversionExerciseText,
} from '../shared/conversionExerciseReadValues';
import { requireGeneratedDamlNumeric10 } from '../shared/generatedDamlValues';

/** Exact generated DAML ConvertibleConversion payload. */
export type DamlConvertibleConversionData = DamlDataTypeFor<'convertibleConversion'>;

/** Convert generated DAML ConvertibleConversion data to canonical OCF. */
export function damlConvertibleConversionToNative(
  input: ReadonlyDamlDataTypeFor<'convertibleConversion'>
): DeepReadonly<OcfConvertibleConversion> {
  const data = decodeDamlEntityData('convertibleConversion', input);
  const balanceSecurityId = generatedOptionalConversionExerciseText(
    data.balance_security_id,
    'convertibleConversion.balance_security_id'
  );
  const capitalizationDefinition = generatedConversionCapitalizationDefinition(
    data.capitalization_definition,
    'convertibleConversion.capitalization_definition'
  );
  const quantityConverted =
    data.quantity_converted === null
      ? undefined
      : requireGeneratedDamlNumeric10(data.quantity_converted, 'convertibleConversion.quantity_converted', 'positive');
  const comments = requireGeneratedConversionExerciseComments(data.comments, 'convertibleConversion.comments');

  return freezeConversionExerciseEvent({
    object_type: 'TX_CONVERTIBLE_CONVERSION',
    id: requireGeneratedConversionExerciseText(data.id, 'convertibleConversion.id'),
    date: damlTimeToDateString(data.date, 'convertibleConversion.date'),
    reason_text: requireGeneratedConversionExerciseText(data.reason_text, 'convertibleConversion.reason_text'),
    security_id: requireGeneratedConversionExerciseText(data.security_id, 'convertibleConversion.security_id'),
    trigger_id: requireGeneratedConversionExerciseText(data.trigger_id, 'convertibleConversion.trigger_id'),
    resulting_security_ids: requireGeneratedConversionExerciseResultIds(
      data.resulting_security_ids,
      'convertibleConversion.resulting_security_ids'
    ),
    ...(balanceSecurityId !== undefined ? { balance_security_id: balanceSecurityId } : {}),
    ...(capitalizationDefinition !== undefined ? { capitalization_definition: capitalizationDefinition } : {}),
    ...(quantityConverted !== undefined ? { quantity_converted: quantityConverted } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
