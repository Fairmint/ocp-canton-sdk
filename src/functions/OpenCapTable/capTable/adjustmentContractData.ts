import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { toSafeDiagnosticText } from '../../../errors/OcpError';
import { validatePartyId } from '../../../utils/validation';
import {
  assertPlainDataValue,
  cloneValidatedPlainDataValue,
  PlainDataValidationError,
} from '../shared/plainDataValidation';
import { validateAdministrativeAdjustmentDamlSemantics } from './administrativeAdjustmentValidation';
import { ENTITY_TEMPLATE_ID_MAP, type OcfEntityType } from './batchTypes';
import { assertLosslessGeneratedDamlRoundTrip } from './damlCodecLosslessness';

export type AdministrativeAdjustmentEntityType = Extract<
  OcfEntityType,
  'issuerAuthorizedSharesAdjustment' | 'stockClassAuthorizedSharesAdjustment' | 'stockPlanPoolAdjustment'
>;

export function isAdministrativeAdjustmentEntityType(
  entityType: OcfEntityType
): entityType is AdministrativeAdjustmentEntityType {
  return (
    entityType === 'issuerAuthorizedSharesAdjustment' ||
    entityType === 'stockClassAuthorizedSharesAdjustment' ||
    entityType === 'stockPlanPoolAdjustment'
  );
}

interface AdministrativeAdjustmentCreateArgumentMap {
  issuerAuthorizedSharesAdjustment: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment;
  stockClassAuthorizedSharesAdjustment: Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment;
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment;
}

interface AdministrativeAdjustmentCreateArgumentCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ):
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: { readonly at: string; readonly message: string } };
  };
  readonly encode: (value: T) => unknown;
}

type AdministrativeAdjustmentDataFor<EntityType extends AdministrativeAdjustmentEntityType> =
  AdministrativeAdjustmentCreateArgumentMap[EntityType]['adjustment_data'];

type AdministrativeAdjustmentCreateArgumentCodecMap = {
  readonly [EntityType in AdministrativeAdjustmentEntityType]: AdministrativeAdjustmentCreateArgumentCodec<
    AdministrativeAdjustmentCreateArgumentMap[EntityType]
  >;
};

const ADMINISTRATIVE_ADJUSTMENT_CREATE_ARGUMENT_CODEC_MAP: AdministrativeAdjustmentCreateArgumentCodecMap = {
  issuerAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment,
  stockClassAuthorizedSharesAdjustment:
    Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment,
  stockPlanPoolAdjustment: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment,
};

function adjustmentDecodeError(
  entityType: AdministrativeAdjustmentEntityType,
  boundary: 'data' | 'wrapper',
  decoderPath: string,
  decoderMessage: string,
  diagnostics: Readonly<Record<string, unknown>> = {}
): OcpParseError {
  return new OcpParseError(
    `Invalid DAML ${boundary === 'wrapper' ? 'create argument' : 'data'} for ${entityType} at ${decoderPath}: ${decoderMessage}`,
    {
      source: boundary === 'wrapper' ? `damlAdministrativeAdjustmentCreateArgument.${entityType}` : decoderPath,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
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

function validatePlainAdjustmentBoundary(
  entityType: AdministrativeAdjustmentEntityType,
  value: unknown,
  boundary: 'data' | 'wrapper',
  rootPath: string
): void {
  try {
    assertPlainDataValue(value, rootPath, { allowUndefinedObjectProperties: true });
  } catch (error) {
    if (!(error instanceof PlainDataValidationError)) throw error;
    throw adjustmentDecodeError(entityType, boundary, error.fieldPath, error.message, {
      issueKind: error.issueKind,
      expectedType: error.expectedType,
      receivedValue: error.receivedValue,
    });
  }
}

/** Trap-free structural preflight shared by direct and dispatcher adjustment readers. */
export function validateAdministrativeAdjustmentDamlDataInput(
  entityType: AdministrativeAdjustmentEntityType,
  value: unknown,
  rootPath: string = entityType
): void {
  validatePlainAdjustmentBoundary(entityType, value, 'data', rootPath);
}

/** Decode and losslessly validate the exact generated adjustment contract wrapper. */
export function extractAndDecodeAdministrativeAdjustmentData<
  const EntityType extends AdministrativeAdjustmentEntityType,
>(entityType: EntityType, createArgument: unknown): AdministrativeAdjustmentDataFor<EntityType> {
  validatePlainAdjustmentBoundary(entityType, createArgument, 'wrapper', 'input');
  const sourceSnapshot = cloneValidatedPlainDataValue(createArgument);
  const decoderInput = cloneValidatedPlainDataValue(createArgument);
  const codec: AdministrativeAdjustmentCreateArgumentCodec<AdministrativeAdjustmentCreateArgumentMap[EntityType]> =
    ADMINISTRATIVE_ADJUSTMENT_CREATE_ARGUMENT_CODEC_MAP[entityType];

  let decoded: AdministrativeAdjustmentCreateArgumentMap[EntityType];
  try {
    const result = codec.decoder.run(decoderInput);
    if (!result.ok) {
      throw adjustmentDecodeError(entityType, 'wrapper', result.error.at, result.error.message);
    }
    decoded = result.result;
  } catch (error) {
    if (error instanceof OcpParseError) throw error;
    throw adjustmentDecodeError(entityType, 'wrapper', 'input', `decode failed: ${toSafeDiagnosticText(error)}`, {
      phase: 'decode',
    });
  }

  let encoded: unknown;
  try {
    encoded = codec.encode(decoded);
  } catch (error) {
    throw adjustmentDecodeError(entityType, 'wrapper', 'input', `encode failed: ${toSafeDiagnosticText(error)}`, {
      phase: 'encode',
    });
  }

  try {
    assertLosslessGeneratedDamlRoundTrip(sourceSnapshot, encoded, {
      rootPath: `damlAdministrativeAdjustmentCreateArgument.${entityType}`,
      description: `${entityType} create argument`,
      decodeSource: `damlAdministrativeAdjustmentCreateArgument.${entityType}`,
      context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] },
    });
  } catch (error) {
    if (!(error instanceof OcpParseError)) throw error;
    const decoderPath =
      typeof error.context?.decoderPath === 'string' ? error.context.decoderPath : (error.source ?? 'input');
    const decoderMessage =
      typeof error.context?.decoderMessage === 'string' ? error.context.decoderMessage : error.message;
    throw adjustmentDecodeError(entityType, 'wrapper', decoderPath, decoderMessage);
  }

  const rootPath = `damlAdministrativeAdjustmentCreateArgument.${entityType}`;
  validatePartyId(decoded.context.issuer, `${rootPath}.context.issuer`);
  validatePartyId(decoded.context.system_operator, `${rootPath}.context.system_operator`);
  validateAdministrativeAdjustmentDamlSemantics(entityType, decoded.adjustment_data);
  return decoded.adjustment_data;
}
