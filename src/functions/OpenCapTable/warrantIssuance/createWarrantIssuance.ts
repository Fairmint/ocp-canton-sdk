import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { describeDiagnosticValue } from '../../../errors/diagnostics';
import type { OcfWarrantIssuance, StockClassConversionRight, WarrantExerciseTrigger } from '../../../types/native';
import { parseConversionTriggerFields } from '../../../utils/conversionTriggers';
import { dateStringToDAMLTime } from '../../../utils/typeConversions';
import {
  canonicalOptionalNumericToDaml,
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

/** Strongly typed converter input; object_type is optional for direct helper use. */
export type WarrantIssuanceInput = Omit<OcfWarrantIssuance, 'object_type'> & {
  readonly object_type?: 'TX_WARRANT_ISSUANCE';
};

/** Canonical warrant trigger discriminator accepted by the strongly typed writer. */
export type WarrantTriggerTypeInput = WarrantExerciseTrigger['type'];

function triggerTypeToDaml(
  value: WarrantExerciseTrigger['type']
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTriggerType {
  switch (value) {
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
  if (value === undefined) return null;
  if (value === null) return invalidQuantitySource(value);
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
  }
  return invalidQuantitySource(value);
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
  trigger: WarrantExerciseTrigger,
  convertsToStockClassId: string,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfConversionTrigger {
  const triggerFields = triggerFieldsToDaml(trigger, trigger.type, source);
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
  trigger: WarrantExerciseTrigger,
  right: StockClassConversionRight,
  source: string
): Fairmint.OpenCapTable.Types.Conversion.OcfAnyConversionRight {
  const rightSource = `${source}.conversion_right`;
  const convertsToStockClassId = requireStockClassTarget(right, rightSource);
  const mechanism = ratioMechanismToDaml(right.conversion_mechanism, `${source}.conversion_right.conversion_mechanism`);
  return {
    tag: 'OcfRightStockClass',
    value: {
      type_: 'STOCK_CLASS_CONVERSION_RIGHT',
      conversion_mechanism: mechanism.conversion_mechanism,
      conversion_trigger: storageTrigger(trigger, convertsToStockClassId, source),
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
  trigger: WarrantExerciseTrigger,
  source: string
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
  const triggerFields = triggerFieldsToDaml(parsed, parsed.type, source);
  return {
    type_: triggerTypeToDaml(parsed.type),
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
