/**
 * Centralized OCF to DAML converter dispatcher.
 *
 * This module provides a unified interface for converting native OCF data types to their DAML equivalents, used by the
 * batch UpdateCapTable API.
 *
 * IMPORTANT: This file is a DISPATCHER ONLY. All converter implementations should be in their
 * respective entity folders (e.g., stakeholder/stakeholderDataToDaml.ts).
 * See CLAUDE.md "Entity Folder Organization (CRITICAL)" for details.
 */

import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { parseOcfEntityInput } from '../../../utils/ocfZodSchemas';
import type {
  OcfCreateOperation,
  OcfDataTypeFor,
  OcfEditOperation,
  OcfEntityArguments,
  OcfEntityType,
  OcfWritableDataTypeFor,
  ReadonlyDamlDataTypeFor,
} from './batchTypes';
import { isOcfEntityType } from './entityTypes';
import { requireOcfOperationEnvelope } from './operationEnvelope';

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
import { issuerDataToDaml } from '../issuer/createIssuer';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';
import { deepFreezePlainDataValue } from '../shared/plainDataValidation';
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
 * Convert native OCF data to DAML format based on entity type.
 *
 * @param type - The OCF entity type
 * @param data - The native OCF data object
 * @returns The DAML-formatted data object
 */
export function convertToDaml<const Arguments extends OcfEntityArguments>(
  ...args: Arguments
): ReadonlyDamlDataTypeFor<Arguments[0]> {
  const [type, data] = args;
  return deepFreezePlainDataValue(convertEntityToDaml(type, data)) as unknown as ReadonlyDamlDataTypeFor<Arguments[0]>;
}

/** Convert a correlated create/edit operation object to its generated DAML payload. */
export function convertOperationToDaml<const Operation extends OcfCreateOperation | OcfEditOperation>(
  operation: Operation
): ReadonlyDamlDataTypeFor<Operation['type']> {
  const envelope = requireOcfOperationEnvelope(operation, 'operation');
  if (!isOcfEntityType(envelope.type)) {
    throw new OcpValidationError('operation.type', `Unsupported OCF entity type: ${envelope.type}`, {
      code: OcpErrorCodes.INVALID_TYPE,
      expectedType: 'supported OCF entity type',
      receivedValue: envelope.type,
    });
  }
  return deepFreezePlainDataValue(
    convertEntityToDaml(envelope.type, envelope.data as OcfWritableDataTypeFor<OcfEntityType>)
  ) as unknown as ReadonlyDamlDataTypeFor<Operation['type']>;
}

function convertEntityToDaml(
  type: OcfEntityType,
  data: OcfWritableDataTypeFor<OcfEntityType>
): Record<string, unknown> {
  // Transfer writers own their descriptor-only preflight and contextual validation.
  // Dispatch before the generic schema parser can observe an untrusted property.
  if (type === 'stockTransfer') return stockTransferDataToDaml(data as OcfDataTypeFor<'stockTransfer'>);
  if (type === 'warrantTransfer') return warrantTransferDataToDaml(data as OcfDataTypeFor<'warrantTransfer'>);
  if (type === 'convertibleTransfer') {
    return convertibleTransferDataToDaml(data as OcfDataTypeFor<'convertibleTransfer'>);
  }
  if (type === 'equityCompensationTransfer') {
    return equityCompensationTransferDataToDaml(data as OcfDataTypeFor<'equityCompensationTransfer'>);
  }
  // Administrative-adjustment writers own the same trap-safe preflight and contextual validation.
  if (type === 'issuerAuthorizedSharesAdjustment') {
    return issuerAuthorizedSharesAdjustmentDataToDaml(data as OcfDataTypeFor<'issuerAuthorizedSharesAdjustment'>);
  }
  if (type === 'stockClassAuthorizedSharesAdjustment') {
    return stockClassAuthorizedSharesAdjustmentDataToDaml(
      data as OcfDataTypeFor<'stockClassAuthorizedSharesAdjustment'>
    );
  }
  if (type === 'stockPlanPoolAdjustment') {
    return stockPlanPoolAdjustmentDataToDaml(data as OcfDataTypeFor<'stockPlanPoolAdjustment'>);
  }

  // Vesting writers also own descriptor-only preflight and exact contextual errors.
  if (type === 'vestingStart') return vestingStartDataToDaml(data as OcfDataTypeFor<'vestingStart'>);
  if (type === 'vestingEvent') return vestingEventDataToDaml(data as OcfDataTypeFor<'vestingEvent'>);
  if (type === 'vestingAcceleration') {
    return vestingAccelerationDataToDaml(data as OcfDataTypeFor<'vestingAcceleration'>);
  }
  if (type === 'vestingTerms') return vestingTermsDataToDaml(data as OcfDataTypeFor<'vestingTerms'>);

  // These converters enforce DAML-v35 refinements that the OCF JSON schema cannot express. Run their exact
  // runtime validators before schema parsing so direct and generic write paths expose identical diagnostics.
  if (type === 'stockClassConversionRatioAdjustment') {
    const converted = stockClassConversionRatioAdjustmentDataToDaml(
      data as OcfDataTypeFor<'stockClassConversionRatioAdjustment'>
    );
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'stockClassSplit') {
    return stockClassSplitDataToDaml(data as OcfDataTypeFor<'stockClassSplit'>);
  }
  if (type === 'stockConsolidation') {
    return stockConsolidationDataToDaml(data as OcfDataTypeFor<'stockConsolidation'>);
  }
  if (type === 'stockReissuance') {
    return stockReissuanceDataToDaml(data as OcfDataTypeFor<'stockReissuance'>);
  }
  if (type === 'stockRepurchase') {
    return stockRepurchaseDataToDaml(data as OcfDataTypeFor<'stockRepurchase'>);
  }
  if (type === 'convertibleConversion') {
    const converted = convertibleConversionDataToDaml(data as OcfDataTypeFor<'convertibleConversion'>);
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'stockConversion') {
    const converted = stockConversionDataToDaml(data as OcfDataTypeFor<'stockConversion'>);
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'equityCompensationExercise') {
    const converted = equityCompensationExerciseDataToDaml(data as OcfDataTypeFor<'equityCompensationExercise'>);
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'warrantExercise') {
    const converted = warrantExerciseDataToDaml(data as OcfDataTypeFor<'warrantExercise'>);
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'stockClass') {
    const converted = stockClassDataToDaml(data as OcfDataTypeFor<'stockClass'>);
    parseOcfEntityInput(type, data);
    return converted;
  }
  if (type === 'convertibleIssuance') {
    return convertibleIssuanceDataToDaml(data as OcfDataTypeFor<'convertibleIssuance'>);
  }
  if (type === 'equityCompensationIssuance') {
    return equityCompensationIssuanceDataToDaml(data as OcfDataTypeFor<'equityCompensationIssuance'>);
  }
  if (type === 'stockIssuance') {
    return stockIssuanceDataToDaml(data as OcfDataTypeFor<'stockIssuance'>);
  }
  if (type === 'warrantIssuance') {
    return warrantIssuanceDataToDaml(data as OcfWritableDataTypeFor<'warrantIssuance'>);
  }

  // Stakeholder-event writers own exact descriptor-only preflight, contextual
  // enum/cardinality validation, and canonical schema validation. Dispatch
  // before the generic parser so every writer surface has identical behavior.
  if (type === 'stakeholderRelationshipChangeEvent') {
    return stakeholderRelationshipChangeEventDataToDaml(data as OcfDataTypeFor<'stakeholderRelationshipChangeEvent'>);
  }
  if (type === 'stakeholderStatusChangeEvent') {
    return stakeholderStatusChangeEventDataToDaml(data as OcfDataTypeFor<'stakeholderStatusChangeEvent'>);
  }

  assertCanonicalJsonGraph(data, type);

  const d = parseOcfEntityInput(type, data);

  switch (type) {
    case 'stakeholder':
      return stakeholderDataToDaml(d as OcfDataTypeFor<'stakeholder'>);
    case 'document':
      return documentDataToDaml(d as OcfDataTypeFor<'document'>);
    case 'stockLegendTemplate':
      return stockLegendTemplateDataToDaml(d as OcfDataTypeFor<'stockLegendTemplate'>);
    case 'stockPlan':
      return stockPlanDataToDaml(d as OcfDataTypeFor<'stockPlan'>);
    case 'stockCancellation':
      return stockCancellationDataToDaml(d as OcfDataTypeFor<'stockCancellation'>);
    case 'issuer':
      return issuerDataToDaml(d as OcfDataTypeFor<'issuer'>, { skipSchemaParse: true });
    case 'equityCompensationCancellation':
      return equityCompensationCancellationDataToDaml(d as OcfDataTypeFor<'equityCompensationCancellation'>);
    case 'convertibleCancellation':
      return convertibleCancellationDataToDaml(d as OcfDataTypeFor<'convertibleCancellation'>);
    case 'warrantCancellation':
      return warrantCancellationDataToDaml(d as OcfDataTypeFor<'warrantCancellation'>);

    // Types with converters imported from entity folders
    case 'stockAcceptance':
      return stockAcceptanceDataToDaml(d as OcfDataTypeFor<'stockAcceptance'>);
    case 'stockRetraction':
      return stockRetractionDataToDaml(d as OcfDataTypeFor<'stockRetraction'>);
    case 'stockPlanReturnToPool':
      return stockPlanReturnToPoolDataToDaml(d as OcfDataTypeFor<'stockPlanReturnToPool'>);
    case 'valuation':
      return valuationDataToDaml(d as OcfDataTypeFor<'valuation'>);
    case 'warrantAcceptance':
      return warrantAcceptanceDataToDaml(d as OcfDataTypeFor<'warrantAcceptance'>);
    case 'warrantRetraction':
      return warrantRetractionDataToDaml(d as OcfDataTypeFor<'warrantRetraction'>);
    case 'convertibleAcceptance':
      return convertibleAcceptanceDataToDaml(d as OcfDataTypeFor<'convertibleAcceptance'>);
    case 'convertibleRetraction':
      return convertibleRetractionDataToDaml(d as OcfDataTypeFor<'convertibleRetraction'>);
    case 'equityCompensationAcceptance':
      return equityCompensationAcceptanceDataToDaml(d as OcfDataTypeFor<'equityCompensationAcceptance'>);
    case 'equityCompensationRelease':
      return equityCompensationReleaseDataToDaml(d as OcfDataTypeFor<'equityCompensationRelease'>);
    case 'equityCompensationRepricing':
      return equityCompensationRepricingDataToDaml(d as OcfDataTypeFor<'equityCompensationRepricing'>);
    case 'equityCompensationRetraction':
      return equityCompensationRetractionDataToDaml(d as OcfDataTypeFor<'equityCompensationRetraction'>);

    default: {
      const exhaustiveCheck: never = type;
      throw new OcpParseError(`Unsupported entity type: ${exhaustiveCheck as string}`, {
        source: 'entityType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}
