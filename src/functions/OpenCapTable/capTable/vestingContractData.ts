import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError, type OcpErrorCode } from '../../../errors';
import { assertPlainDataValue, PlainDataValidationError } from '../shared/plainDataValidation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from './damlCodecLosslessness';

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

interface VestingCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ):
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: { readonly at: string; readonly message: string } };
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

function vestingDecodeError(
  entityType: VestingEntityType,
  boundary: 'data' | 'wrapper',
  decoderPath: string,
  decoderMessage: string,
  diagnostics: Readonly<Record<string, unknown>> = {},
  code: OcpErrorCode = OcpErrorCodes.SCHEMA_MISMATCH
): OcpParseError {
  return new OcpParseError(
    `Invalid DAML ${boundary === 'wrapper' ? 'create argument' : 'data'} for ${entityType} at ${decoderPath}: ${decoderMessage}`,
    {
      source: boundary === 'wrapper' ? `damlToOcf.${entityType}.createArgument` : decoderPath,
      code,
      classification: boundary === 'wrapper' ? 'invalid_generated_create_argument' : 'invalid_generated_daml_data',
      context: {
        entityType,
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
        decoderPath,
        decoderMessage,
        ...diagnostics,
      },
    }
  );
}

function validatePlainVestingBoundary(
  entityType: VestingEntityType,
  value: unknown,
  boundary: 'data' | 'wrapper',
  rootPath: string
): void {
  try {
    assertPlainDataValue(value, rootPath);
  } catch (error) {
    if (!(error instanceof PlainDataValidationError)) throw error;
    throw vestingDecodeError(
      entityType,
      boundary,
      error.fieldPath,
      error.message,
      {
        issueKind: error.issueKind,
        expectedType: error.expectedType,
        receivedValue: error.receivedValue,
      },
      error.issueKind === 'too-deep' || error.issueKind === 'too-large' ? error.code : undefined
    );
  }
}

/** Trap-free recursive preflight shared by direct and dispatcher vesting readers. */
export function validateVestingDamlDataInput(
  entityType: VestingEntityType,
  value: unknown,
  rootPath: string = entityType
): void {
  validatePlainVestingBoundary(entityType, value, 'data', rootPath);
}

/** Decode an exact generated vesting wrapper and return its canonical data field. */
export function extractAndDecodeVestingData<const EntityType extends VestingEntityType>(
  entityType: EntityType,
  createArgument: unknown
): ReadonlyGeneratedDaml<VestingDataFor<EntityType>> {
  const rootPath = `damlToOcf.${entityType}.createArgument`;
  validatePlainVestingBoundary(entityType, createArgument, 'wrapper', 'input');
  const definition = VESTING_CREATE_ARGUMENT_DEFINITION_MAP[entityType];
  const decoded = decodeLosslessGeneratedDamlValue(
    {
      decoder: {
        runWithException(decoderInput) {
          validatePlainVestingBoundary(entityType, decoderInput, 'wrapper', 'input');
          const result = definition.codec.decoder.run(decoderInput);
          if (result.ok) return result.result;
          throw vestingDecodeError(entityType, 'wrapper', result.error.at, result.error.message);
        },
      },
      encode: (value) => definition.codec.encode(value),
    },
    createArgument,
    {
      rootPath,
      description: `${entityType} create argument`,
      decodeSource: rootPath,
      context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] },
    }
  );

  const correlatedDecoded = decoded as Readonly<Record<VestingDataField<EntityType>, unknown>>;
  return correlatedDecoded[definition.dataField] as ReadonlyGeneratedDaml<VestingDataFor<EntityType>>;
}
