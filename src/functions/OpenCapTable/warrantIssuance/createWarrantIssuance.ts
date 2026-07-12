import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { OcfWarrantIssuance, StockClassConversionRight, WarrantExerciseTrigger } from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import {
  canonicalOptionalBooleanToDaml,
  canonicalOptionalNumericToDaml,
  convertibleMechanismToDaml,
  ratioMechanismToDaml,
  warrantMechanismToDaml,
} from '../shared/conversionMechanisms';
import { nativeMonetaryToDamlNumeric10, parseDamlNumeric10 } from '../shared/damlNumerics';
import {
  canonicalOptionalBooleanToDaml,
  canonicalOptionalDateToDaml,
  canonicalOptionalTextToDaml,
} from '../shared/damlText';
import {
  commentsToDaml,
  optionalWriterArray,
  requirePlainWriterInput,
  requireWriterArray,
  requireWriterString,
  securityLawExemptionsToDaml,
  validateCanonicalWriterInput,
} from '../shared/ocfWriterValidation';
import { triggerFieldsToDaml } from '../shared/triggerFields';
import { filterAndMapVestingsToDaml } from '../shared/vesting';

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type WarrantIssuanceInput = Omit<OcfWarrantIssuance, 'object_type'> & {
  readonly object_type?: 'TX_WARRANT_ISSUANCE';
};

/** Canonical warrant trigger discriminator accepted by the strongly typed writer. */
export type WarrantTriggerTypeInput = WarrantExerciseTrigger['type'];

/** Exact object-shaped exercise-trigger row accepted by the warrant writer. */
export type WarrantExerciseTriggerInput = WarrantExerciseTrigger;

const ROOT_FIELDS = [
  'object_type',
  'id',
  'date',
  'security_id',
  'custom_id',
  'stakeholder_id',
  'board_approval_date',
  'stockholder_approval_date',
  'consideration_text',
  'security_law_exemptions',
  'quantity',
  'quantity_source',
  'exercise_price',
  'purchase_price',
  'exercise_triggers',
  'warrant_expiration_date',
  'vesting_terms_id',
  'vestings',
  'comments',
] as const;
const MONETARY_FIELDS = ['amount', 'currency'] as const;
const SECURITY_EXEMPTION_FIELDS = ['description', 'jurisdiction'] as const;
const VESTING_FIELDS = ['date', 'amount'] as const;
const CONVERSION_RIGHT_FIELDS = [
  'type',
  'conversion_mechanism',
  'converts_to_future_round',
  'converts_to_stock_class_id',
] as const;

function requiredMissing(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} is required`, {
    code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    expectedType,
    receivedValue,
  });
}

function invalidType(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid type`, {
    code: OcpErrorCodes.INVALID_TYPE,
    expectedType,
    receivedValue,
  });
}

function invalidFormat(field: string, expectedType: string, receivedValue: unknown): OcpValidationError {
  return new OcpValidationError(field, `${field} has an invalid format`, {
    code: OcpErrorCodes.INVALID_FORMAT,
    expectedType,
    receivedValue,
  });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) throw requiredMissing(field, 'object', value);
  assertNotRuntimeProxy(value, field, 'plain OCF object');
  if (!isRecord(value)) throw invalidType(field, 'object', value);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (value === null || value === undefined) throw requiredMissing(field, 'array', value);
  assertNotRuntimeProxy(value, field, 'ordinary JSON array');
  if (!Array.isArray(value)) throw invalidType(field, 'array', value);
  return requireDenseArray(value, field);
}

function optionalArray(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (value === null) throw invalidType(field, 'non-empty array or omitted property', value);
  return requireNonEmptyArray(value, field);
}

function requireString(value: unknown, field: string): string {
  if (value === null || value === undefined) throw requiredMissing(field, 'non-empty string', value);
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string', value);
  return value;
}

function optionalTextToDaml(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') throw invalidType(field, 'non-empty string or omitted property', value);
  if (value.length === 0) throw invalidFormat(field, 'non-empty string or omitted property', value);
  return value;
}

function requiredDateToDaml(value: unknown, fieldPath: string): string {
  if (value === null || value === undefined) {
    throw requiredMissing(fieldPath, 'YYYY-MM-DD or RFC 3339 date-time string', value);
  }
  return dateStringToDAMLTime(value, fieldPath);
}

function requiredMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> {
  const monetary = requireRecord(value, field);
  assertExactObjectFields(monetary, MONETARY_FIELDS, field);
  return monetaryToDaml(requireMonetary(monetary, field), field);
}

function optionalMonetaryToDaml(value: unknown, field: string): ReturnType<typeof monetaryToDaml> | null {
  if (value === undefined) return null;
  assertNotRuntimeProxy(value, field, 'Monetary object or omitted property');
  if (!isRecord(value)) throw invalidType(field, 'Monetary object or omitted property', value);
  assertExactObjectFields(value, MONETARY_FIELDS, field);
  return requiredMonetaryToDaml(value, field);
}

function securityLawExemptionsToDaml(
  value: unknown,
  field: string
): Array<{ description: string; jurisdiction: string }> {
  return requireArray(value, field).map((entry, index) => {
    const source = `${field}.${index}`;
    const exemption = requireRecord(entry, source);
    assertExactObjectFields(exemption, SECURITY_EXEMPTION_FIELDS, source);
    return {
      description: requireString(exemption.description, `${source}.description`),
      jurisdiction: requireString(exemption.jurisdiction, `${source}.jurisdiction`),
    };
  });
}

function commentsToDaml(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  assertNotRuntimeProxy(value, field, 'ordinary JSON array of non-empty strings or omitted property');
  if (!Array.isArray(value)) throw invalidType(field, 'array of non-empty strings or omitted property', value);
  return requireDenseArray(value, field).map((comment, index) => requireString(comment, `${field}.${index}`));
}

function triggerTypeToDaml(
  value: unknown,
  field: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  const runtimeValue = requireString(value, field);
  switch (runtimeValue) {
    case 'AUTOMATIC_ON_CONDITION':
      return 'OcfTriggerTypeTypeAutomaticOnCondition';
    case 'AUTOMATIC_ON_DATE':
      return 'OcfTriggerTypeTypeAutomaticOnDate';
    case 'ELECTIVE_IN_RANGE':
      return 'OcfTriggerTypeTypeElectiveInRange';
    case 'ELECTIVE_ON_CONDITION':
      return 'OcfTriggerTypeTypeElectiveOnCondition';
    case 'ELECTIVE_AT_WILL':
      return 'OcfTriggerTypeTypeElectiveAtWill';
    case 'UNSPECIFIED':
      return 'OcfTriggerTypeTypeUnspecified';
    default:
      throw new OcpValidationError(field, `Unknown warrant trigger type: ${runtimeValue}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType:
          'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
        receivedValue: value,
      });
  }
  throw new OcpValidationError(
    'warrantIssuance.exercise_triggers[].type',
    `Unknown warrant trigger type: ${describeDiagnosticValue(value)}`,
    {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType:
        'AUTOMATIC_ON_CONDITION | AUTOMATIC_ON_DATE | ELECTIVE_IN_RANGE | ELECTIVE_ON_CONDITION | ELECTIVE_AT_WILL | UNSPECIFIED',
      receivedValue: value,
    }
  );
}

function invalidQuantitySource(value: unknown): never {
  throw new OcpValidationError(
    'warrantIssuance.quantity_source',
    'Expected a canonical quantity source when provided; omit the property when absent (explicit null is invalid)',
    {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'QuantitySourceType or omitted property',
      receivedValue: value,
    }
  );
}

function quantitySourceToDaml(value: unknown): Fairmint.OpenCapTable.Types.Stock.OcfQuantitySourceType | null {
  const field = 'warrantIssuance.quantity_source';
  if (value === undefined) return null;
  if (value === null) {
    throw new OcpValidationError(
      field,
      'Expected a canonical quantity source when provided; omit the property when absent (explicit null is invalid)',
      {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'QuantitySourceType or omitted property',
        receivedValue: value,
      }
    );
  }
  if (typeof value !== 'string') {
    throw invalidType(field, 'QuantitySourceType or omitted property', value);
  }
  switch (value) {
    case 'HUMAN_ESTIMATED':
      return 'OcfQuantityHumanEstimated';
    case 'MACHINE_ESTIMATED':
      return 'OcfQuantityMachineEstimated';
    case 'UNSPECIFIED':
      return 'OcfQuantityUnspecified';
    case 'INSTRUMENT_FIXED':
      return 'OcfQuantityInstrumentFixed';
    case 'INSTRUMENT_MAX':
      return 'OcfQuantityInstrumentMax';
    case 'INSTRUMENT_MIN':
      return 'OcfQuantityInstrumentMin';
    default:
      throw new OcpValidationError(field, `Unknown warrant quantity source: ${value}`, {
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        expectedType: 'QuantitySourceType',
        receivedValue: value,
      });
  }
}

function requireStockClassTarget(right: StockClassConversionRight, source: string): string {
  if (!right.converts_to_stock_class_id) {
    throw new OcpValidationError(
      `${source}.converts_to_stock_class_id`,
      'The current DAML stock-class right requires converts_to_stock_class_id',
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
    );
  }
  return right.converts_to_stock_class_id;
}

function storageTrigger(
  trigger: ConversionTriggerFor<unknown>,
  convertsToStockClassId: string,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, source);
  return {
    type_: triggerTypeToDaml(trigger.type),
    trigger_id: trigger.trigger_id,
    nickname: canonicalOptionalTextToDaml(trigger.nickname, `${source}.nickname`),
    trigger_description: canonicalOptionalTextToDaml(trigger.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
    conversion_right: {
      tag: 'OcfRightConvertible',
      value: {
        type_: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: {
          tag: 'OcfConvMechCustom',
          value: { custom_conversion_description: 'Stock class conversion' },
        },
        converts_to_future_round: null,
        converts_to_stock_class_id: convertsToStockClassId,
      },
    },
  };
}

function stockClassRightToDaml(
  trigger: ConversionTriggerFor<unknown>,
  right: Record<string, unknown>,
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const rightSource = `${source}.conversion_right`;
  const convertsToStockClassId = requireStockClassTarget(right, rightSource);
  const mechanism = ratioMechanismToDaml(right.conversion_mechanism, `${source}.conversion_right.conversion_mechanism`);
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, convertsToStockClassId, triggerSource),
      converts_to_stock_class_id: convertsToStockClassId,
      ratio: mechanism.ratio,
      conversion_price: mechanism.conversion_price,
      converts_to_future_round: canonicalOptionalBooleanToDaml(
        right.converts_to_future_round,
        `${rightSource}.converts_to_future_round`
      ),
      ceiling_price_per_share: null,
      custom_description: null,
      discount_rate: null,
      expires_at: null,
      floor_price_per_share: null,
      percent_of_capitalization: null,
      reference_share_price: null,
      reference_valuation_price_per_share: null,
      valuation_cap: null,
    },
  };
}

function conversionRightToDaml(
  trigger: ConversionTriggerFor<unknown>,
  source: string,
  triggerSource: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const { conversion_right: right } = trigger;
  requirePlainWriterInput(right, `${source}.conversion_right`);
  switch (right.type) {
    case 'WARRANT_CONVERSION_RIGHT':
      return {
        tag: 'OcfRightWarrant',
        value: {
          type_: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: warrantMechanismToDaml(
            right.conversion_mechanism,
            `${source}.conversion_right.conversion_mechanism`
          ),
          converts_to_future_round: canonicalOptionalBooleanToDaml(
            right.converts_to_future_round,
            `${source}.conversion_right.converts_to_future_round`
          ),
          converts_to_stock_class_id: canonicalOptionalTextToDaml(
            right.converts_to_stock_class_id,
            `${source}.conversion_right.converts_to_stock_class_id`
          ),
        },
      };
    case 'STOCK_CLASS_CONVERSION_RIGHT':
      return stockClassRightToDaml(trigger, right, source);
    default: {
      const unexpected: unknown = right;
      throw new OcpValidationError(
        `${source}.conversion_right.type`,
        `Unknown warrant conversion right type: ${describeDiagnosticValue(unexpected)}`,
        {
          code: OcpErrorCodes.INVALID_FORMAT,
          expectedType: 'WARRANT_CONVERSION_RIGHT | STOCK_CLASS_CONVERSION_RIGHT',
          receivedValue: (unexpected as Record<string, unknown>).type,
        }
      );
    }
  }
}

function triggerToDaml(
  trigger: WarrantExerciseTrigger,
  index: number
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const source = `warrantIssuance.exercise_triggers[${index}]`;
  const parsed = parseConversionTriggerFields(trigger, source);
  const triggerFields = triggerFieldsToDaml(parsed, source);
  return {
    type_: triggerTypeToDaml(parsed.type, `${source}.type`),
    trigger_id: parsed.trigger_id,
    conversion_right: conversionRightToDaml(parsed, source),
    nickname: canonicalOptionalTextToDaml(parsed.nickname, `${source}.nickname`),
    trigger_description: canonicalOptionalTextToDaml(parsed.trigger_description, `${source}.trigger_description`),
    ...triggerFields,
  };
}

export function warrantIssuanceDataToDaml(
  input: WarrantIssuanceInput
): Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData {
  const writerInput = requirePlainWriterInput(input, 'warrantIssuance');
  requireWriterArray(input.exercise_triggers, 'warrantIssuance.exercise_triggers');
  const quantitySource =
    input.quantity !== undefined
      ? quantitySourceToDaml(input.quantity_source ?? 'UNSPECIFIED')
      : quantitySourceToDaml(input.quantity_source);
  const vestings = optionalWriterArray(input.vestings, 'warrantIssuance.vestings').map((value, index) => {
    const fieldPath = `warrantIssuance.vestings[${index}]`;
    const vesting = requirePlainWriterInput(value, fieldPath);
    return {
      date: dateStringToDAMLTime(vesting.date, `${fieldPath}.date`),
      amount: parseDamlNumeric10(vesting.amount, `${fieldPath}.amount`),
    };
  });
  const result: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData = {
    id: requireWriterString(input.id, 'warrantIssuance.id'),
    date: dateStringToDAMLTime(input.date, 'warrantIssuance.date'),
    security_id: requireWriterString(input.security_id, 'warrantIssuance.security_id'),
    custom_id: requireWriterString(input.custom_id, 'warrantIssuance.custom_id'),
    stakeholder_id: requireWriterString(input.stakeholder_id, 'warrantIssuance.stakeholder_id'),
    board_approval_date: canonicalOptionalDateToDaml(input.board_approval_date, 'warrantIssuance.board_approval_date'),
    stockholder_approval_date: canonicalOptionalDateToDaml(
      input.stockholder_approval_date,
      'warrantIssuance.stockholder_approval_date'
    ),
    consideration_text: canonicalOptionalTextToDaml(input.consideration_text, 'warrantIssuance.consideration_text'),
    security_law_exemptions: securityLawExemptionsToDaml(
      input.security_law_exemptions,
      'warrantIssuance.security_law_exemptions'
    ),
    quantity: canonicalOptionalNumericToDaml(input.quantity, 'warrantIssuance.quantity'),
    quantity_source: quantitySource,
    exercise_price:
      input.exercise_price === undefined
        ? null
        : nativeMonetaryToDamlNumeric10(input.exercise_price, 'warrantIssuance.exercise_price'),
    purchase_price: nativeMonetaryToDamlNumeric10(input.purchase_price, 'warrantIssuance.purchase_price'),
    exercise_triggers: input.exercise_triggers.map(triggerToDaml),
    warrant_expiration_date: canonicalOptionalDateToDaml(
      input.warrant_expiration_date,
      'warrantIssuance.warrant_expiration_date'
    ),
    vesting_terms_id: canonicalOptionalTextToDaml(input.vesting_terms_id, 'warrantIssuance.vesting_terms_id'),
    vestings,
    comments: commentsToDaml(input.comments, 'warrantIssuance.comments'),
  };

  validateCanonicalWriterInput('warrantIssuance', 'TX_WARRANT_ISSUANCE', writerInput, 'warrantIssuance');
  return result;
}
