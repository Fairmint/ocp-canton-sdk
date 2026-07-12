import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import {
  assertSafeGeneratedDamlJson,
  extractGeneratedCreateArgumentData,
  generatedDamlDecoderSource,
  requireGeneratedRecord,
} from '../../../utils/generatedDamlValidation';
import { initialSharesAuthorizedFromDaml } from '../../../utils/typeConversions';
import { projectDamlIssuerDataToNative } from '../issuer/getIssuerAsOcf';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { assertCanonicalJsonGraph, requireDecimalString } from '../shared/ocfValues';
import {
  preflightDamlStakeholderStatus,
  preflightOptionalDamlStakeholderRelationship,
} from '../shared/stakeholderEventValues';
import { extractAndDecodeAcceptanceData, isAcceptanceEntityType } from './acceptanceContractData';
import {
  extractAndDecodeAdministrativeAdjustmentData,
  isAdministrativeAdjustmentEntityType,
  validateAdministrativeAdjustmentDamlDataInput,
} from './adjustmentContractData';
import { validateAdministrativeAdjustmentDamlSemantics } from './administrativeAdjustmentValidation';
import { ENTITY_DATA_FIELD_MAP, ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor, type OcfEntityType } from './batchTypes';
import { extractAndDecodeCancellationData, isCancellationEntityType } from './cancellationContractData';
import { validateDecodedGeneratedDamlValue } from './damlCodecLosslessness';
import {
  decodeComplexIssuanceDamlData,
  extractAndDecodeComplexIssuanceData,
  isComplexIssuanceEntityType,
  validateComplexIssuanceDamlDataInput,
} from './issuanceContractData';
import { extractAndDecodeStakeholderEventData, isStakeholderEventEntityType } from './stakeholderEventContractData';
import {
  extractAndDecodeTransferData,
  isTransferEntityType,
  validateTransferDamlDataInput,
} from './transferContractData';
import { extractAndDecodeVestingData, isVestingEntityType, validateVestingDamlDataInput } from './vestingContractData';

interface EntityDataCodec<T> {
  readonly decoder: {
    run(
      input: unknown
    ):
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: { readonly at: string; readonly message: string } };
    runWithException(input: unknown): T;
  };
  encode(value: T): unknown;
}

type EntityDataDecoder<T> = (input: unknown) => T;

type EntityDataDecoderMap = {
  readonly [EntityType in OcfEntityType]: EntityDataDecoder<DamlDataTypeFor<EntityType>>;
};

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
    const rootPath = entityType;
    const relationship = requireGeneratedRecord(input, rootPath);
    for (const field of ['relationship_started', 'relationship_ended'] as const) {
      preflightOptionalDamlStakeholderRelationship(relationship[field], `${rootPath}.${field}`);
    }
  } else if (entityType === 'stakeholderStatusChangeEvent') {
    const rootPath = entityType;
    const status = requireGeneratedRecord(input, rootPath);
    preflightDamlStakeholderStatus(status.new_status, `${rootPath}.new_status`);
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
    if (isAdministrativeAdjustmentEntityType(entityType)) {
      validateAdministrativeAdjustmentDamlDataInput(entityType, input);
    }
    if (isTransferEntityType(entityType)) {
      validateTransferDamlDataInput(entityType, input);
    }
    if (isVestingEntityType(entityType)) {
      validateVestingDamlDataInput(entityType, input);
    }
    if (isComplexIssuanceEntityType(entityType)) {
      validateComplexIssuanceDamlDataInput(entityType, input);
    }
    if (entityType === 'stakeholder' || isStakeholderEventEntityType(entityType)) {
      assertSafeGeneratedDamlJson(input, entityType);
    } else {
      assertCanonicalJsonGraph(input, entityType);
    }
    preflightSemanticDamlEntityData(entityType, input);
    const options = {
      rootPath: entityType,
      description: entityType,
      decodeSource: `damlToOcf.${entityType}`,
      context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] },
    } as const;
    const decoded = codec.decoder.run(input);
    if (!decoded.ok) {
      const { at: decoderPath, message: decoderMessage } = decoded.error;
      const source = isStakeholderEventEntityType(entityType)
        ? generatedDamlDecoderSource(entityType, decoderPath, decoderMessage)
        : `damlToOcf.${entityType}`;
      throw new OcpParseError(`Invalid generated DAML ${entityType} at ${decoderPath}: ${decoderMessage}`, {
        source,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'invalid_generated_daml_data',
        context: {
          ...options.context,
          decoderPath,
          decoderMessage,
        },
      });
    }

    const validated = validateDecodedGeneratedDamlValue(codec, decoded.result, input, options);
    if (isAdministrativeAdjustmentEntityType(entityType)) {
      validateAdministrativeAdjustmentDamlSemantics(entityType, validated);
    }
    return validated;
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
): DamlDataTypeFor<EntityType>;
export function decodeDamlEntityData(entityType: OcfEntityType, input: unknown): DamlDataTypeFor<OcfEntityType> {
  if (isComplexIssuanceEntityType(entityType)) {
    return decodeComplexIssuanceDamlData(entityType, input);
  }
  return ENTITY_DATA_DECODER_MAP[entityType](input);
}

/** Extract and decode one correlated generated DAML entity payload from a ledger create argument. */
export function extractAndDecodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  createArgument: unknown
): DamlDataTypeFor<EntityType>;
export function extractAndDecodeDamlEntityData(
  entityType: OcfEntityType,
  createArgument: unknown
): DamlDataTypeFor<OcfEntityType> {
  if (isStakeholderEventEntityType(entityType)) {
    return extractAndDecodeStakeholderEventData(entityType, createArgument);
  }

  if (isAdministrativeAdjustmentEntityType(entityType)) {
    return extractAndDecodeAdministrativeAdjustmentData(entityType, createArgument);
  }

  if (isComplexIssuanceEntityType(entityType)) {
    return extractAndDecodeComplexIssuanceData(entityType, createArgument);
  }

  if (isAcceptanceEntityType(entityType)) {
    return extractAndDecodeAcceptanceData(entityType, createArgument);
  }

  if (isCancellationEntityType(entityType)) {
    return extractAndDecodeCancellationData(entityType, createArgument);
  }

  if (isTransferEntityType(entityType)) {
    return extractAndDecodeTransferData(entityType, createArgument);
  }

  if (isVestingEntityType(entityType)) {
    return extractAndDecodeVestingData(entityType, createArgument);
  }

  return decodeDamlEntityData(entityType, extractEntityData(entityType, createArgument));
}
