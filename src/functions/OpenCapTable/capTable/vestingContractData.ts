import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { findLosslessCodecMismatch } from './damlCodecLosslessness';

export type VestingEntityType = Extract<
  OcfEntityType,
  'vestingAcceleration' | 'vestingEvent' | 'vestingStart' | 'vestingTerms'
>;

export function isVestingEntityType(entityType: OcfEntityType): entityType is VestingEntityType {
  return (
    entityType === 'vestingAcceleration' ||
    entityType === 'vestingEvent' ||
    entityType === 'vestingStart' ||
    entityType === 'vestingTerms'
  );
}

interface VestingCreateArgumentMap {
  vestingAcceleration: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAcceleration;
  vestingEvent: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEvent;
  vestingStart: Fairmint.OpenCapTable.OCF.VestingStart.VestingStart;
  vestingTerms: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms;
}

interface DecoderError {
  readonly at: string;
  readonly message: string;
}

interface VestingCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ): { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: DecoderError };
  };
  readonly encode: (value: T) => unknown;
}

type VestingDataField<EntityType extends VestingEntityType> = Exclude<
  keyof VestingCreateArgumentMap[EntityType],
  'context'
> &
  string;

type VestingDataFor<EntityType extends VestingEntityType> =
  VestingCreateArgumentMap[EntityType][VestingDataField<EntityType>];

interface VestingCreateArgumentDefinition<EntityType extends VestingEntityType> {
  readonly codec: VestingCreateArgumentCodec<VestingCreateArgumentMap[EntityType]>;
  readonly dataField: VestingDataField<EntityType>;
}

type VestingCreateArgumentDefinitionMap = {
  readonly [EntityType in VestingEntityType]: VestingCreateArgumentDefinition<EntityType>;
};

/** Generated template codecs and canonical payload fields correlated with each vesting family. */
const VESTING_CREATE_ARGUMENT_DEFINITION_MAP: VestingCreateArgumentDefinitionMap = {
  vestingAcceleration: {
    codec: Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAcceleration,
    dataField: 'acceleration_data',
  },
  vestingEvent: {
    codec: Fairmint.OpenCapTable.OCF.VestingEvent.VestingEvent,
    dataField: 'vesting_data',
  },
  vestingStart: {
    codec: Fairmint.OpenCapTable.OCF.VestingStart.VestingStart,
    dataField: 'vesting_data',
  },
  vestingTerms: {
    codec: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms,
    dataField: 'vesting_terms_data',
  },
};

const VESTING_REQUIRED_DATA_FIELDS: Readonly<Record<VestingEntityType, readonly string[]>> = {
  vestingAcceleration: ['id', 'date', 'quantity', 'reason_text', 'security_id', 'comments'],
  vestingEvent: ['id', 'date', 'security_id', 'vesting_condition_id', 'comments'],
  vestingStart: ['id', 'date', 'security_id', 'vesting_condition_id', 'comments'],
  vestingTerms: ['id', 'allocation_type', 'description', 'name', 'comments', 'vesting_conditions'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function ownField(record: Record<string, unknown>, field: string): unknown {
  return hasOwnField(record, field) ? record[field] : undefined;
}

function vestingDecodeError(entityType: VestingEntityType, decoderPath: string, decoderMessage: string): OcpParseError {
  return new OcpParseError(`Invalid DAML create argument for ${entityType} at ${decoderPath}: ${decoderMessage}`, {
    source: `damlVestingCreateArgument.${entityType}`,
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType,
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
      decoderPath,
      decoderMessage,
    },
  });
}

function requireOwnFields(
  entityType: VestingEntityType,
  record: Record<string, unknown>,
  fields: readonly string[],
  decoderPath: string
): void {
  for (const field of fields) {
    if (!hasOwnField(record, field)) {
      throw vestingDecodeError(entityType, decoderPath, `the key '${field}' is required as an own property`);
    }
  }
}

function validateDenseOwnList(entityType: VestingEntityType, value: unknown, decoderPath: string): void {
  if (!Array.isArray(value)) return;

  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwnField(value, String(index))) {
      throw vestingDecodeError(
        entityType,
        `${decoderPath}[${index}]`,
        'list element is missing or inherited rather than an own property'
      );
    }
  }
}

function validateVestingPeriodOwnProperties(
  entityType: VestingEntityType,
  period: Record<string, unknown>,
  decoderPath: string
): void {
  requireOwnFields(entityType, period, ['tag', 'value'], decoderPath);
  const value = ownField(period, 'value');
  if (!isRecord(value)) return;

  const tag = ownField(period, 'tag');
  const requiredFields =
    tag === 'OcfVestingPeriodMonths' ? ['length_', 'occurrences', 'day_of_month'] : ['length_', 'occurrences'];
  requireOwnFields(entityType, value, requiredFields, `${decoderPath}.value`);
}

function validateVestingTriggerOwnProperties(
  entityType: VestingEntityType,
  trigger: Record<string, unknown>,
  decoderPath: string
): void {
  requireOwnFields(entityType, trigger, ['tag', 'value'], decoderPath);
  const value = ownField(trigger, 'value');
  if (!isRecord(value)) return;

  const tag = ownField(trigger, 'tag');
  if (tag === 'OcfVestingScheduleAbsoluteTrigger') {
    requireOwnFields(entityType, value, ['date'], `${decoderPath}.value`);
    return;
  }

  if (tag === 'OcfVestingScheduleRelativeTrigger') {
    requireOwnFields(entityType, value, ['period', 'relative_to_condition_id'], `${decoderPath}.value`);
    const period = ownField(value, 'period');
    if (isRecord(period)) validateVestingPeriodOwnProperties(entityType, period, `${decoderPath}.value.period`);
  }
}

function validateVestingConditionOwnProperties(
  entityType: VestingEntityType,
  condition: Record<string, unknown>,
  decoderPath: string
): void {
  requireOwnFields(entityType, condition, ['id', 'trigger', 'next_condition_ids'], decoderPath);
  validateDenseOwnList(entityType, ownField(condition, 'next_condition_ids'), `${decoderPath}.next_condition_ids`);

  const trigger = ownField(condition, 'trigger');
  if (isRecord(trigger)) validateVestingTriggerOwnProperties(entityType, trigger, `${decoderPath}.trigger`);

  const portion = ownField(condition, 'portion');
  if (isRecord(portion)) {
    requireOwnFields(entityType, portion, ['numerator', 'denominator', 'remainder'], `${decoderPath}.portion`);
  }
}

function validateVestingOwnProperties(entityType: VestingEntityType, createArgument: unknown): void {
  if (!isRecord(createArgument)) return;

  const { dataField } = VESTING_CREATE_ARGUMENT_DEFINITION_MAP[entityType];
  requireOwnFields(entityType, createArgument, ['context', dataField], 'input');

  const context = ownField(createArgument, 'context');
  if (isRecord(context)) requireOwnFields(entityType, context, ['issuer', 'system_operator'], 'input.context');

  const data = ownField(createArgument, dataField);
  if (!isRecord(data)) return;

  requireOwnFields(entityType, data, VESTING_REQUIRED_DATA_FIELDS[entityType], `input.${dataField}`);
  validateDenseOwnList(entityType, ownField(data, 'comments'), `input.${dataField}.comments`);

  if (entityType !== 'vestingTerms') return;
  const conditions = ownField(data, 'vesting_conditions');
  validateDenseOwnList(entityType, conditions, `input.${dataField}.vesting_conditions`);
  if (!Array.isArray(conditions)) return;

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    if (isRecord(condition)) {
      validateVestingConditionOwnProperties(entityType, condition, `input.${dataField}.vesting_conditions[${index}]`);
    }
  }
}

/** Decode the full generated contract wrapper and return its recursively decoded vesting payload. */
export function extractAndDecodeVestingData<const EntityType extends VestingEntityType>(
  entityType: EntityType,
  createArgument: unknown
): VestingDataFor<EntityType> {
  validateVestingOwnProperties(entityType, createArgument);
  const definition = VESTING_CREATE_ARGUMENT_DEFINITION_MAP[entityType];
  const decoded = definition.codec.decoder.run(createArgument);

  if (!decoded.ok) {
    const { at: decoderPath, message: decoderMessage } = decoded.error;
    throw vestingDecodeError(entityType, decoderPath, decoderMessage);
  }

  const mismatch = findLosslessCodecMismatch(createArgument, definition.codec.encode(decoded.result));
  if (mismatch) throw vestingDecodeError(entityType, mismatch.decoderPath, mismatch.decoderMessage);

  return decoded.result[definition.dataField];
}
