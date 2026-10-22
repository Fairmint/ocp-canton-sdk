/**
 * Centralized OCF to DAML converter dispatcher.
 *
 * This module provides a unified interface for converting native OCF data types to their DAML equivalents.
 *
 * IMPORTANT: This file is a DISPATCHER ONLY. All converter implementations should be in their
 * respective entity folders (e.g., stakeholder/stakeholderDataToDaml.ts).
 * See CLAUDE.md "Entity Folder Organization (CRITICAL)" for details.
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import {
  ENTITY_REGISTRY,
  isOcfEditableEntityType,
  type DamlDataTypeFor,
  type DamlRecordDataFor,
  type OcfDataTypeFor,
  type OcfEditableEntityType,
  type OcfEntityArguments,
} from './batchTypes';

// Import converters from entity folders
import { convertibleAcceptanceDataToDaml } from '../convertibleAcceptance/convertibleAcceptanceDataToDaml';
import { convertibleCancellationDataToDaml } from '../convertibleCancellation/createConvertibleCancellation';
import { convertibleConversionDataToDaml } from '../convertibleConversion/convertibleConversionDataToDaml';
import { convertibleIssuanceDataToDaml } from '../convertibleIssuance/createConvertibleIssuance';
import { convertibleRetractionDataToDaml } from '../convertibleRetraction/convertibleRetractionDataToDaml';
import { convertibleTransferDataToDaml } from '../convertibleTransfer/convertibleTransferDataToDaml';
import { documentDataToDaml } from '../document/createDocument';
import { equityCompensationAcceptanceDataToDaml } from '../equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
import { equityCompensationCancellationDataToDaml } from '../equityCompensationCancellation/createEquityCompensationCancellation';
import { equityCompensationExerciseDataToDaml } from '../equityCompensationExercise/createEquityCompensationExercise';
import { equityCompensationIssuanceDataToDaml } from '../equityCompensationIssuance/createEquityCompensationIssuance';
import { equityCompensationReleaseDataToDaml } from '../equityCompensationRelease/equityCompensationReleaseDataToDaml';
import { equityCompensationRepricingDataToDaml } from '../equityCompensationRepricing/equityCompensationRepricingDataToDaml';
import { equityCompensationRetractionDataToDaml } from '../equityCompensationRetraction/equityCompensationRetractionDataToDaml';
import { equityCompensationTransferDataToDaml } from '../equityCompensationTransfer/equityCompensationTransferDataToDaml';
import { financingDataToDaml } from '../financing/financingDataToDaml';
import { issuerDataToDaml } from '../issuer/createIssuer';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { stakeholderDataToDaml } from '../stakeholder/stakeholderDataToDaml';
import { stakeholderRelationshipChangeEventDataToDaml } from '../stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import { stakeholderStatusChangeEventDataToDaml } from '../stakeholderStatusChangeEvent/stakeholderStatusChangeEventDataToDaml';
import { stockAcceptanceDataToDaml } from '../stockAcceptance/stockAcceptanceDataToDaml';
import { stockCancellationDataToDaml } from '../stockCancellation/createStockCancellation';
import { stockClassDataToDaml } from '../stockClass/stockClassDataToDaml';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { stockClassConversionRatioAdjustmentDataToDaml } from '../stockClassConversionRatioAdjustment/stockClassConversionRatioAdjustmentDataToDaml';
import { stockClassSplitDataToDaml } from '../stockClassSplit/stockClassSplitDataToDaml';
import { stockConsolidationDataToDaml } from '../stockConsolidation/stockConsolidationDataToDaml';
import { stockConversionDataToDaml } from '../stockConversion/stockConversionDataToDaml';
import { stockIssuanceDataToDaml } from '../stockIssuance/createStockIssuance';
import { stockLegendTemplateDataToDaml } from '../stockLegendTemplate/createStockLegendTemplate';
import { stockPlanDataToDaml } from '../stockPlan/createStockPlan';
import { stockPlanPoolAdjustmentDataToDaml } from '../stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { stockPlanReturnToPoolDataToDaml } from '../stockPlanReturnToPool/stockPlanReturnToPoolDataToDaml';
import { stockReissuanceDataToDaml } from '../stockReissuance/stockReissuanceDataToDaml';
import { stockRepurchaseDataToDaml } from '../stockRepurchase/stockRepurchaseDataToDaml';
import { stockRetractionDataToDaml } from '../stockRetraction/stockRetractionDataToDaml';
import { stockTransferDataToDaml } from '../stockTransfer/createStockTransfer';
import { valuationDataToDaml } from '../valuation/valuationDataToDaml';
import { vestingAccelerationDataToDaml } from '../vestingAcceleration/vestingAccelerationDataToDaml';
import { vestingEventDataToDaml } from '../vestingEvent/vestingEventDataToDaml';
import { vestingStartDataToDaml } from '../vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../vestingTerms/createVestingTerms';
import { warrantAcceptanceDataToDaml } from '../warrantAcceptance/warrantAcceptanceDataToDaml';
import { warrantCancellationDataToDaml } from '../warrantCancellation/createWarrantCancellation';
import { warrantExerciseDataToDaml } from '../warrantExercise/warrantExerciseDataToDaml';
import { warrantIssuanceDataToDaml } from '../warrantIssuance/createWarrantIssuance';
import { warrantRetractionDataToDaml } from '../warrantRetraction/warrantRetractionDataToDaml';
import { warrantTransferDataToDaml } from '../warrantTransfer/warrantTransferDataToDaml';

/**
 * One converter per writable entity kind: the parsed native OCF data in, the exact generated `<Name>OcfData` payload
 * out. The register writes the hold pair itself, so it has no converter here.
 */
type DataToDamlConverters = {
  readonly [EntityType in OcfEditableEntityType]: (data: OcfDataTypeFor<EntityType>) => DamlDataTypeFor<EntityType>;
};

const DATA_TO_DAML: DataToDamlConverters = {
  convertibleAcceptance: convertibleAcceptanceDataToDaml,
  convertibleCancellation: convertibleCancellationDataToDaml,
  convertibleConversion: convertibleConversionDataToDaml,
  convertibleIssuance: convertibleIssuanceDataToDaml,
  convertibleRetraction: convertibleRetractionDataToDaml,
  convertibleTransfer: convertibleTransferDataToDaml,
  document: documentDataToDaml,
  equityCompensationAcceptance: equityCompensationAcceptanceDataToDaml,
  equityCompensationCancellation: equityCompensationCancellationDataToDaml,
  equityCompensationExercise: equityCompensationExerciseDataToDaml,
  equityCompensationIssuance: equityCompensationIssuanceDataToDaml,
  equityCompensationRelease: equityCompensationReleaseDataToDaml,
  equityCompensationRepricing: equityCompensationRepricingDataToDaml,
  equityCompensationRetraction: equityCompensationRetractionDataToDaml,
  equityCompensationTransfer: equityCompensationTransferDataToDaml,
  financing: financingDataToDaml,
  issuerAuthorizedSharesAdjustment: issuerAuthorizedSharesAdjustmentDataToDaml,
  issuer: (data) => issuerDataToDaml(data, { skipSchemaParse: true }),
  stakeholder: stakeholderDataToDaml,
  stakeholderRelationshipChangeEvent: stakeholderRelationshipChangeEventDataToDaml,
  stakeholderStatusChangeEvent: stakeholderStatusChangeEventDataToDaml,
  stockAcceptance: stockAcceptanceDataToDaml,
  stockCancellation: stockCancellationDataToDaml,
  stockClassAuthorizedSharesAdjustment: stockClassAuthorizedSharesAdjustmentDataToDaml,
  stockClassConversionRatioAdjustment: stockClassConversionRatioAdjustmentDataToDaml,
  stockClass: stockClassDataToDaml,
  stockClassSplit: stockClassSplitDataToDaml,
  stockConsolidation: stockConsolidationDataToDaml,
  stockConversion: stockConversionDataToDaml,
  stockIssuance: stockIssuanceDataToDaml,
  stockLegendTemplate: stockLegendTemplateDataToDaml,
  stockPlan: stockPlanDataToDaml,
  stockPlanPoolAdjustment: stockPlanPoolAdjustmentDataToDaml,
  stockPlanReturnToPool: stockPlanReturnToPoolDataToDaml,
  stockReissuance: stockReissuanceDataToDaml,
  stockRepurchase: stockRepurchaseDataToDaml,
  stockRetraction: stockRetractionDataToDaml,
  stockTransfer: stockTransferDataToDaml,
  valuation: valuationDataToDaml,
  vestingAcceleration: vestingAccelerationDataToDaml,
  vestingEvent: vestingEventDataToDaml,
  vestingStart: vestingStartDataToDaml,
  vestingTerms: vestingTermsDataToDaml,
  warrantAcceptance: warrantAcceptanceDataToDaml,
  warrantCancellation: warrantCancellationDataToDaml,
  warrantExercise: warrantExerciseDataToDaml,
  warrantIssuance: warrantIssuanceDataToDaml,
  warrantRetraction: warrantRetractionDataToDaml,
  warrantTransfer: warrantTransferDataToDaml,
};

/**
 * An `OcfRecordData` variant (`{ tag, value }`) as the register's choices take it: the constructor tag of the entity kind
 * and its Daml `<Name>OcfData` payload.
 */
export type DamlRecordDataInput<EntityType extends OcfEditableEntityType = OcfEditableEntityType> =
  DamlRecordDataFor<EntityType>;

/**
 * Convert native OCF data to the DAML `OcfRecordData` variant for its entity type.
 *
 * @param type - The OCF entity type
 * @param data - The native OCF data object
 * @returns The variant `{ tag, value }`, with `value` the Daml `<Name>OcfData` payload
 */
export function convertToDaml<const EntityType extends OcfEditableEntityType>(
  type: EntityType,
  data: OcfDataTypeFor<EntityType>
): DamlRecordDataInput<EntityType>;
export function convertToDaml(...args: OcfEntityArguments): DamlRecordDataInput {
  const [type, data] = args;
  // The tag and the payload come from the same entity kind; the union of variants cannot be correlated by type.
  return { tag: ENTITY_REGISTRY[type].recordTag, value: convertEntityToDaml(type, data) } as DamlRecordDataInput;
}

/**
 * Convert native OCF data to the bare DAML `<Name>OcfData` payload (the `ocf_data` field of the record's contract).
 *
 * @param type - The OCF entity type
 * @param data - The native OCF data object
 * @returns The DAML-formatted data object
 */
export function convertToDamlData<const EntityType extends OcfEditableEntityType>(
  type: EntityType,
  data: OcfDataTypeFor<EntityType>
): DamlDataTypeFor<EntityType>;
export function convertToDamlData(...args: OcfEntityArguments): DamlDataTypeFor<OcfEditableEntityType> {
  const [type, data] = args;
  return convertEntityToDaml(type, data);
}

function convertEntityToDaml<EntityType extends OcfEditableEntityType>(
  type: EntityType,
  data: OcfDataTypeFor<EntityType>
): DamlDataTypeFor<EntityType> {
  // Runtime guard: the type is raw caller input, and the register's hold pair has no writer.
  if (!Object.prototype.hasOwnProperty.call(DATA_TO_DAML, type) || !isOcfEditableEntityType(type)) {
    throw new OcpParseError(`Unsupported entity type: ${String(type)}`, {
      source: 'entityType',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  const convert: DataToDamlConverters[EntityType] = DATA_TO_DAML[type];
  return convert(parseOcfEntityInput(type, data));
}
