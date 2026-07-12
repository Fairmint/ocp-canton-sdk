/** OCF to DAML converter for StockConversion entities. */

import type { OcfStockConversion } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import {
  conversionExerciseCommentsToDaml,
  optionalConversionExerciseText,
  requireConversionExerciseObjectType,
  requireConversionExerciseText,
  requireExactConversionExerciseInput,
  requireNonEmptyConversionExerciseTextArray,
} from '../shared/conversionExerciseValues';
import { requirePositiveOcfDecimal } from '../shared/ocfValues';

type DamlStockConversionData = DamlDataTypeFor<'stockConversion'>;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'quantity_converted',
  'resulting_security_ids',
  'balance_security_id',
  'comments',
] as const;

/** Convert exact canonical OCF StockConversion data to generated DAML data. */
export function stockConversionDataToDaml(input: OcfStockConversion): DamlStockConversionData {
  const field = 'stockConversion';
  const data = requireExactConversionExerciseInput(input, field, ROOT_FIELDS);
  requireConversionExerciseObjectType(data.object_type, 'TX_STOCK_CONVERSION', `${field}.object_type`);

  return {
    id: requireConversionExerciseText(data.id, `${field}.id`),
    date: dateStringToDAMLTime(requireConversionExerciseText(data.date, `${field}.date`), `${field}.date`),
    security_id: requireConversionExerciseText(data.security_id, `${field}.security_id`),
    quantity_converted: requirePositiveOcfDecimal(data.quantity_converted, `${field}.quantity_converted`),
    resulting_security_ids: requireNonEmptyConversionExerciseTextArray(
      data.resulting_security_ids,
      `${field}.resulting_security_ids`
    ),
    balance_security_id: optionalConversionExerciseText(data.balance_security_id, `${field}.balance_security_id`),
    comments: conversionExerciseCommentsToDaml(data.comments, `${field}.comments`),
  };
}
