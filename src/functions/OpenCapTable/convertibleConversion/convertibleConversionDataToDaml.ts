/** OCF to DAML converter for ConvertibleConversion entities. */

import type { CapitalizationDefinition, OcfConvertibleConversion } from '../../../types';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import type { DamlDataTypeFor } from '../capTable/batchTypes';
import {
  conversionExerciseCommentsToDaml,
  optionalConversionExerciseText,
  requireConversionExerciseObjectType,
  requireConversionExerciseText,
  requireConversionExerciseTextArray,
  requireExactConversionExerciseInput,
} from '../shared/conversionExerciseValues';
import { canonicalOptionalNumericToDaml } from '../shared/conversionMechanisms';

type DamlConvertibleConversionData = DamlDataTypeFor<'convertibleConversion'>;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'reason_text',
  'security_id',
  'trigger_id',
  'resulting_security_ids',
  'balance_security_id',
  'capitalization_definition',
  'quantity_converted',
  'comments',
] as const;
const CAPITALIZATION_FIELDS = [
  'include_stock_class_ids',
  'include_stock_plans_ids',
  'include_security_ids',
  'exclude_security_ids',
] as const satisfies ReadonlyArray<keyof CapitalizationDefinition>;

function capitalizationDefinitionToDaml(value: unknown): CapitalizationDefinition | null {
  const field = 'convertibleConversion.capitalization_definition';
  if (value === undefined) return null;
  const definition = requireExactConversionExerciseInput(value, field, CAPITALIZATION_FIELDS);
  return {
    include_stock_class_ids: requireConversionExerciseTextArray(
      definition.include_stock_class_ids,
      `${field}.include_stock_class_ids`
    ),
    include_stock_plans_ids: requireConversionExerciseTextArray(
      definition.include_stock_plans_ids,
      `${field}.include_stock_plans_ids`
    ),
    include_security_ids: requireConversionExerciseTextArray(
      definition.include_security_ids,
      `${field}.include_security_ids`
    ),
    exclude_security_ids: requireConversionExerciseTextArray(
      definition.exclude_security_ids,
      `${field}.exclude_security_ids`
    ),
  };
}

/** Convert exact canonical OCF ConvertibleConversion data to generated DAML data. */
export function convertibleConversionDataToDaml(input: OcfConvertibleConversion): DamlConvertibleConversionData {
  const field = 'convertibleConversion';
  const data = requireExactConversionExerciseInput(input, field, ROOT_FIELDS);
  requireConversionExerciseObjectType(data.object_type, 'TX_CONVERTIBLE_CONVERSION', `${field}.object_type`);

  return {
    id: requireConversionExerciseText(data.id, `${field}.id`),
    date: dateStringToDAMLTime(requireConversionExerciseText(data.date, `${field}.date`), `${field}.date`),
    reason_text: requireConversionExerciseText(data.reason_text, `${field}.reason_text`),
    security_id: requireConversionExerciseText(data.security_id, `${field}.security_id`),
    trigger_id: requireConversionExerciseText(data.trigger_id, `${field}.trigger_id`),
    resulting_security_ids: requireConversionExerciseTextArray(
      data.resulting_security_ids,
      `${field}.resulting_security_ids`
    ),
    balance_security_id: optionalConversionExerciseText(data.balance_security_id, `${field}.balance_security_id`),
    capitalization_definition: capitalizationDefinitionToDaml(data.capitalization_definition),
    quantity_converted: canonicalOptionalNumericToDaml(data.quantity_converted, `${field}.quantity_converted`),
    comments: conversionExerciseCommentsToDaml(data.comments, `${field}.comments`),
  };
}
