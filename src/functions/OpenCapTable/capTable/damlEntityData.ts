import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { extractGeneratedCreateArgumentData, requireGeneratedRecord } from '../../../utils/generatedDamlValidation';
import { initialSharesAuthorizedFromDaml } from '../../../utils/typeConversions';
import { projectDamlIssuerDataToNative } from '../issuer/getIssuerAsOcf';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { assertCanonicalJsonGraph, requireDecimalString } from '../shared/ocfValues';
import { damlOptionalStakeholderRelationshipToNative } from '../stakeholderRelationshipChangeEvent/damlToOcf';
import { extractAndDecodeAcceptanceData, isAcceptanceEntityType } from './acceptanceContractData';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  isOcfEntityType,
  type DamlDataTypeFor,
  type OcfEntityType,
} from './batchTypes';
import { extractAndDecodeCancellationData, isCancellationEntityType } from './cancellationContractData';
import { decodeLosslessGeneratedDamlValue, type ReadonlyGeneratedDaml } from './damlCodecLosslessness';
import {
  extractAndDecodeTransferData,
  isTransferEntityType,
  validateTransferDamlDataInput,
} from './transferContractData';

interface EntityDataCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ):
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: { readonly at: string; readonly message: string } };
  };
  encode(value: T): unknown;
}

/** Immutable generated DAML payload owned by the decoder boundary. */
export type ReadonlyDamlDataTypeFor<EntityType extends OcfEntityType> = ReadonlyGeneratedDaml<
  DamlDataTypeFor<EntityType>
>;

type EntityDataDecoder<T> = (input: unknown) => ReadonlyGeneratedDaml<T>;

type EntityDataDecoderMap = {
  readonly [EntityType in OcfEntityType]: EntityDataDecoder<DamlDataTypeFor<EntityType>>;
};

/** Reject untyped entity kinds before indexing any correlated entity registry. */
export function assertSupportedOcfEntityType(value: unknown, source: string): asserts value is OcfEntityType {
  if (typeof value === 'string' && isOcfEntityType(value)) return;
  const detail = typeof value === 'string' ? `: ${value.slice(0, 128)}` : '';
  throw new OcpParseError(`Unsupported OCF entity type${detail}`, {
    source,
    code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
    classification: 'unsupported_entity_type',
    context: { receivedType: value === null ? 'null' : typeof value },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function preflightSemanticDamlEntityData(entityType: OcfEntityType, input: unknown): void {
  if (!isRecord(input)) return;

  if (entityType === 'issuer') {
    projectDamlIssuerDataToNative(input);
  } else if (entityType === 'stakeholderRelationshipChangeEvent') {
    const rootPath = `damlToOcf.${entityType}`;
    const relationship = requireGeneratedRecord(input, rootPath);
    for (const field of ['relationship_started', 'relationship_ended'] as const) {
      damlOptionalStakeholderRelationshipToNative(relationship[field], `${rootPath}.${field}`);
    }
  } else if (entityType === 'stockClass' && hasOwnField(input, 'initial_shares_authorized')) {
    initialSharesAuthorizedFromDaml(input.initial_shares_authorized, 'stockClass.initial_shares_authorized');
  } else if (entityType === 'convertibleIssuance' && hasOwnField(input, 'seniority')) {
    parseDamlSafeInteger(input.seniority, 'convertibleIssuance.seniority');
  } else if (
    entityType === 'convertibleConversion' &&
    hasOwnField(input, 'quantity_converted') &&
    input.quantity_converted !== null
  ) {
    requireDecimalString(input.quantity_converted, 'convertibleConversion.quantity_converted');
  }
}

function createEntityDataDecoder<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  codec: EntityDataCodec<DamlDataTypeFor<EntityType>>
): EntityDataDecoder<DamlDataTypeFor<EntityType>> {
  return (input) => {
    const options = {
      rootPath: entityType,
      description: entityType,
      decodeSource: `damlToOcf.${entityType}`,
      allowSourceUndefined: true,
      context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] },
    } as const;
    return decodeLosslessGeneratedDamlValue(
      {
        decoder: {
          runWithException(decoderInput) {
            // The common lossless boundary snapshots the source before this
            // schema-aware preflight sees its detached decoder-owned clone.
            if (isTransferEntityType(entityType)) {
              validateTransferDamlDataInput(entityType, decoderInput);
            }
            assertCanonicalJsonGraph(decoderInput, entityType);
            preflightSemanticDamlEntityData(entityType, decoderInput);
            const decoded = codec.decoder.run(decoderInput);
            if (decoded.ok) return decoded.result;

            const { at: decoderPath, message: decoderMessage } = decoded.error;
            throw new OcpParseError(`Invalid generated DAML ${entityType} at ${decoderPath}: ${decoderMessage}`, {
              source: `damlToOcf.${entityType}`,
              code: OcpErrorCodes.SCHEMA_MISMATCH,
              classification: 'invalid_generated_daml_data',
              context: {
                ...options.context,
                decoderPath,
                decoderMessage,
              },
            });
          },
        },
        encode: (value) => codec.encode(value),
      },
      input,
      options
    );
  };
}

/** Generated payload decoders keyed by their correlated SDK entity kind. */
const ENTITY_DATA_DECODER_MAP = {
  convertibleAcceptance: createEntityDataDecoder(
    'convertibleAcceptance',
    Fairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptanceOcfData
  ),
  convertibleCancellation: createEntityDataDecoder(
    'convertibleCancellation',
    Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellationOcfData
  ),
  convertibleConversion: createEntityDataDecoder(
    'convertibleConversion',
    Fairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData
  ),
  convertibleIssuance: createEntityDataDecoder(
    'convertibleIssuance',
    Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData
  ),
  convertibleRetraction: createEntityDataDecoder(
    'convertibleRetraction',
    Fairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetractionOcfData
  ),
  convertibleTransfer: createEntityDataDecoder(
    'convertibleTransfer',
    Fairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransferOcfData
  ),
  document: createEntityDataDecoder('document', Fairmint.OpenCapTable.OCF.Document.DocumentOcfData),
  equityCompensationAcceptance: createEntityDataDecoder(
    'equityCompensationAcceptance',
    Fairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptanceOcfData
  ),
  equityCompensationCancellation: createEntityDataDecoder(
    'equityCompensationCancellation',
    Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellationOcfData
  ),
  equityCompensationExercise: createEntityDataDecoder(
    'equityCompensationExercise',
    Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExerciseOcfData
  ),
  equityCompensationIssuance: createEntityDataDecoder(
    'equityCompensationIssuance',
    Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuanceOcfData
  ),
  equityCompensationRelease: createEntityDataDecoder(
    'equityCompensationRelease',
    Fairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationReleaseOcfData
  ),
  equityCompensationRepricing: createEntityDataDecoder(
    'equityCompensationRepricing',
    Fairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricingOcfData
  ),
  equityCompensationRetraction: createEntityDataDecoder(
    'equityCompensationRetraction',
    Fairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetractionOcfData
  ),
  equityCompensationTransfer: createEntityDataDecoder(
    'equityCompensationTransfer',
    Fairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransferOcfData
  ),
  issuer: createEntityDataDecoder('issuer', Fairmint.OpenCapTable.OCF.Issuer.IssuerOcfData),
  issuerAuthorizedSharesAdjustment: createEntityDataDecoder(
    'issuerAuthorizedSharesAdjustment',
    Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustmentOcfData
  ),
  stakeholder: createEntityDataDecoder('stakeholder', Fairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData),
  stakeholderRelationshipChangeEvent: createEntityDataDecoder(
    'stakeholderRelationshipChangeEvent',
    Fairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData
  ),
  stakeholderStatusChangeEvent: createEntityDataDecoder(
    'stakeholderStatusChangeEvent',
    Fairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData
  ),
  stockAcceptance: createEntityDataDecoder(
    'stockAcceptance',
    Fairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptanceOcfData
  ),
  stockCancellation: createEntityDataDecoder(
    'stockCancellation',
    Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellationOcfData
  ),
  stockClass: createEntityDataDecoder('stockClass', Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData),
  stockClassAuthorizedSharesAdjustment: createEntityDataDecoder(
    'stockClassAuthorizedSharesAdjustment',
    Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustmentOcfData
  ),
  stockClassConversionRatioAdjustment: createEntityDataDecoder(
    'stockClassConversionRatioAdjustment',
    Fairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData
  ),
  stockClassSplit: createEntityDataDecoder(
    'stockClassSplit',
    Fairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplitOcfData
  ),
  stockConsolidation: createEntityDataDecoder(
    'stockConsolidation',
    Fairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidationOcfData
  ),
  stockConversion: createEntityDataDecoder(
    'stockConversion',
    Fairmint.OpenCapTable.OCF.StockConversion.StockConversionOcfData
  ),
  stockIssuance: createEntityDataDecoder('stockIssuance', Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData),
  stockLegendTemplate: createEntityDataDecoder(
    'stockLegendTemplate',
    Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData
  ),
  stockPlan: createEntityDataDecoder('stockPlan', Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData),
  stockPlanPoolAdjustment: createEntityDataDecoder(
    'stockPlanPoolAdjustment',
    Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData
  ),
  stockPlanReturnToPool: createEntityDataDecoder(
    'stockPlanReturnToPool',
    Fairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPoolOcfData
  ),
  stockReissuance: createEntityDataDecoder(
    'stockReissuance',
    Fairmint.OpenCapTable.OCF.StockReissuance.StockReissuanceOcfData
  ),
  stockRepurchase: createEntityDataDecoder(
    'stockRepurchase',
    Fairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchaseOcfData
  ),
  stockRetraction: createEntityDataDecoder(
    'stockRetraction',
    Fairmint.OpenCapTable.OCF.StockRetraction.StockRetractionOcfData
  ),
  stockTransfer: createEntityDataDecoder('stockTransfer', Fairmint.OpenCapTable.OCF.StockTransfer.StockTransferOcfData),
  valuation: createEntityDataDecoder('valuation', Fairmint.OpenCapTable.OCF.Valuation.ValuationOcfData),
  vestingAcceleration: createEntityDataDecoder(
    'vestingAcceleration',
    Fairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData
  ),
  vestingEvent: createEntityDataDecoder('vestingEvent', Fairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData),
  vestingStart: createEntityDataDecoder('vestingStart', Fairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData),
  vestingTerms: createEntityDataDecoder('vestingTerms', Fairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData),
  warrantAcceptance: createEntityDataDecoder(
    'warrantAcceptance',
    Fairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptanceOcfData
  ),
  warrantCancellation: createEntityDataDecoder(
    'warrantCancellation',
    Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellationOcfData
  ),
  warrantExercise: createEntityDataDecoder(
    'warrantExercise',
    Fairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData
  ),
  warrantIssuance: createEntityDataDecoder(
    'warrantIssuance',
    Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData
  ),
  warrantRetraction: createEntityDataDecoder(
    'warrantRetraction',
    Fairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetractionOcfData
  ),
  warrantTransfer: createEntityDataDecoder(
    'warrantTransfer',
    Fairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransferOcfData
  ),
} as const satisfies EntityDataDecoderMap;

/** Extract the entity-specific data object from a ledger create argument. */
export function extractEntityData(entityType: OcfEntityType, createArgument: unknown): Record<string, unknown> {
  assertSupportedOcfEntityType(entityType, 'damlToOcf.extractEntityData.entityType');
  const rootPath = `damlToOcf.${entityType}.createArgument`;
  const dataFieldName = ENTITY_DATA_FIELD_MAP[entityType];
  if (
    entityType === 'document' ||
    entityType === 'issuer' ||
    entityType === 'stockClassConversionRatioAdjustment' ||
    entityType === 'stockPlan' ||
    entityType === 'vestingTerms'
  ) {
    return extractGeneratedCreateArgumentData(createArgument, rootPath, {
      dataField: dataFieldName,
    });
  }

  return extractGeneratedCreateArgumentData(createArgument, rootPath, {
    dataField: dataFieldName,
    missingDataFieldSource: rootPath,
  });
}

/** Decode unknown ledger JSON into the exact generated DAML payload for an entity kind. */
export function decodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  input: unknown
): ReadonlyDamlDataTypeFor<EntityType>;
export function decodeDamlEntityData(
  entityType: OcfEntityType,
  input: unknown
): ReadonlyDamlDataTypeFor<OcfEntityType> {
  assertSupportedOcfEntityType(entityType, 'damlToOcf.decodeDamlEntityData.entityType');
  return ENTITY_DATA_DECODER_MAP[entityType](input);
}

/** Extract and decode one correlated generated DAML entity payload from a ledger create argument. */
export function extractAndDecodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  createArgument: unknown
): ReadonlyDamlDataTypeFor<EntityType>;
export function extractAndDecodeDamlEntityData(
  entityType: OcfEntityType,
  createArgument: unknown
): ReadonlyDamlDataTypeFor<OcfEntityType> {
  if (isAcceptanceEntityType(entityType)) {
    return extractAndDecodeAcceptanceData(entityType, createArgument);
  }

  if (isCancellationEntityType(entityType)) {
    return extractAndDecodeCancellationData(entityType, createArgument);
  }

  if (isTransferEntityType(entityType)) {
    return extractAndDecodeTransferData(entityType, createArgument);
  }

  return decodeDamlEntityData(entityType, extractEntityData(entityType, createArgument));
}
