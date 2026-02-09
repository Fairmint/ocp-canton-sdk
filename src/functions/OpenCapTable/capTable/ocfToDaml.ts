/**
 * Centralized OCF to DAML converter dispatcher.
 *
 * This module provides a unified interface for converting native OCF data types to their DAML equivalents, used by the
 * batch UpdateCapTable API.
 *
 * IMPORTANT: This file is a DISPATCHER ONLY. All converter implementations should be in their
 * respective entity folders (e.g., stakeholder/stakeholderDataToDaml.ts).
 * See llms.txt "Entity Folder Organization (CRITICAL)" for details.
 */

import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfDataTypeFor, OcfEntityType } from './batchTypes';

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
import { planSecurityExerciseDataToDaml } from '../planSecurityExercise/planSecurityExerciseDataToDaml';
import { planSecurityIssuanceDataToDaml } from '../planSecurityIssuance/planSecurityIssuanceDataToDaml';
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
export function convertToDaml<T extends OcfEntityType>(type: T, data: OcfDataTypeFor<T>): Record<string, unknown> {
  const d = data;

  switch (type) {
    case 'stakeholder':
      return stakeholderDataToDaml(d as OcfDataTypeFor<'stakeholder'>);
    case 'stockClass':
      return stockClassDataToDaml(d as OcfDataTypeFor<'stockClass'>);
    case 'stockIssuance':
      return stockIssuanceDataToDaml(d as OcfDataTypeFor<'stockIssuance'>);
    case 'vestingTerms':
      return vestingTermsDataToDaml(d as OcfDataTypeFor<'vestingTerms'>);
    case 'document':
      return documentDataToDaml(d as OcfDataTypeFor<'document'>);
    case 'stockLegendTemplate':
      return stockLegendTemplateDataToDaml(d as OcfDataTypeFor<'stockLegendTemplate'>);
    case 'stockPlan':
      return stockPlanDataToDaml(d as OcfDataTypeFor<'stockPlan'>);
    case 'equityCompensationIssuance':
      return equityCompensationIssuanceDataToDaml(d as OcfDataTypeFor<'equityCompensationIssuance'>);
    case 'convertibleIssuance':
      // The converter expects a specific input type, cast through unknown
      return convertibleIssuanceDataToDaml(d as unknown as Parameters<typeof convertibleIssuanceDataToDaml>[0]);
    case 'warrantIssuance':
      // The converter expects a specific input type, cast through unknown
      return warrantIssuanceDataToDaml(d as unknown as Parameters<typeof warrantIssuanceDataToDaml>[0]);
    case 'stockCancellation':
      return stockCancellationDataToDaml(d as OcfDataTypeFor<'stockCancellation'>);
    case 'equityCompensationExercise':
      return equityCompensationExerciseDataToDaml(d as OcfDataTypeFor<'equityCompensationExercise'>);
    case 'stockTransfer':
      return stockTransferDataToDaml(d as OcfDataTypeFor<'stockTransfer'>);
    case 'stockRepurchase':
      return stockRepurchaseDataToDaml(d as OcfDataTypeFor<'stockRepurchase'>);
    case 'issuer':
      return issuerDataToDaml(d as OcfDataTypeFor<'issuer'>);
    case 'issuerAuthorizedSharesAdjustment':
      return issuerAuthorizedSharesAdjustmentDataToDaml(d as OcfDataTypeFor<'issuerAuthorizedSharesAdjustment'>);
    case 'stockClassAuthorizedSharesAdjustment':
      return stockClassAuthorizedSharesAdjustmentDataToDaml(
        d as OcfDataTypeFor<'stockClassAuthorizedSharesAdjustment'>
      );
    case 'stockPlanPoolAdjustment':
      return stockPlanPoolAdjustmentDataToDaml(d as OcfDataTypeFor<'stockPlanPoolAdjustment'>);
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
    case 'stockConversion':
      return stockConversionDataToDaml(d as OcfDataTypeFor<'stockConversion'>);
    case 'stockReissuance':
      return stockReissuanceDataToDaml(d as OcfDataTypeFor<'stockReissuance'>);
    case 'stockConsolidation':
      return stockConsolidationDataToDaml(d as OcfDataTypeFor<'stockConsolidation'>);
    case 'stockClassSplit':
      return stockClassSplitDataToDaml(d as OcfDataTypeFor<'stockClassSplit'>);
    case 'stockClassConversionRatioAdjustment':
      return stockClassConversionRatioAdjustmentDataToDaml(d as OcfDataTypeFor<'stockClassConversionRatioAdjustment'>);
    case 'stockPlanReturnToPool':
      return stockPlanReturnToPoolDataToDaml(d as OcfDataTypeFor<'stockPlanReturnToPool'>);
    case 'valuation':
      return valuationDataToDaml(d as OcfDataTypeFor<'valuation'>);
    case 'vestingStart':
      return vestingStartDataToDaml(d as OcfDataTypeFor<'vestingStart'>);
    case 'vestingEvent':
      return vestingEventDataToDaml(d as OcfDataTypeFor<'vestingEvent'>);
    case 'vestingAcceleration':
      return vestingAccelerationDataToDaml(d as OcfDataTypeFor<'vestingAcceleration'>);
    case 'warrantAcceptance':
      return warrantAcceptanceDataToDaml(d as OcfDataTypeFor<'warrantAcceptance'>);
    case 'warrantExercise':
      return warrantExerciseDataToDaml(d as OcfDataTypeFor<'warrantExercise'>);
    case 'warrantRetraction':
      return warrantRetractionDataToDaml(d as OcfDataTypeFor<'warrantRetraction'>);
    case 'warrantTransfer':
      return warrantTransferDataToDaml(d as OcfDataTypeFor<'warrantTransfer'>);
    case 'convertibleAcceptance':
      return convertibleAcceptanceDataToDaml(d as OcfDataTypeFor<'convertibleAcceptance'>);
    case 'convertibleConversion':
      return convertibleConversionDataToDaml(d as OcfDataTypeFor<'convertibleConversion'>);
    case 'convertibleRetraction':
      return convertibleRetractionDataToDaml(d as OcfDataTypeFor<'convertibleRetraction'>);
    case 'convertibleTransfer':
      return convertibleTransferDataToDaml(d as OcfDataTypeFor<'convertibleTransfer'>);
    case 'equityCompensationAcceptance':
      return equityCompensationAcceptanceDataToDaml(d as OcfDataTypeFor<'equityCompensationAcceptance'>);
    case 'equityCompensationRelease':
      return equityCompensationReleaseDataToDaml(d as OcfDataTypeFor<'equityCompensationRelease'>);
    case 'equityCompensationRepricing':
      return equityCompensationRepricingDataToDaml(d as OcfDataTypeFor<'equityCompensationRepricing'>);
    case 'equityCompensationRetraction':
      return equityCompensationRetractionDataToDaml(d as OcfDataTypeFor<'equityCompensationRetraction'>);
    case 'equityCompensationTransfer':
      return equityCompensationTransferDataToDaml(d as OcfDataTypeFor<'equityCompensationTransfer'>);

    // PlanSecurity aliases - delegate to dedicated converters or EquityCompensation converters
    case 'planSecurityIssuance':
      return planSecurityIssuanceDataToDaml(d as OcfDataTypeFor<'planSecurityIssuance'>);
    case 'planSecurityExercise':
      return planSecurityExerciseDataToDaml(d as OcfDataTypeFor<'planSecurityExercise'>);
    case 'planSecurityCancellation':
      return equityCompensationCancellationDataToDaml(d as unknown as OcfDataTypeFor<'equityCompensationCancellation'>);
    case 'planSecurityAcceptance':
      return equityCompensationAcceptanceDataToDaml(d as unknown as OcfDataTypeFor<'equityCompensationAcceptance'>);
    case 'planSecurityRelease':
      return equityCompensationReleaseDataToDaml(d as unknown as OcfDataTypeFor<'equityCompensationRelease'>);
    case 'planSecurityRetraction':
      return equityCompensationRetractionDataToDaml(d as unknown as OcfDataTypeFor<'equityCompensationRetraction'>);
    case 'planSecurityTransfer':
      return equityCompensationTransferDataToDaml(d as unknown as OcfDataTypeFor<'equityCompensationTransfer'>);

    // Stakeholder change events
    case 'stakeholderRelationshipChangeEvent':
      return stakeholderRelationshipChangeEventDataToDaml(d as OcfDataTypeFor<'stakeholderRelationshipChangeEvent'>);
    case 'stakeholderStatusChangeEvent':
      return stakeholderStatusChangeEventDataToDaml(d as OcfDataTypeFor<'stakeholderStatusChangeEvent'>);

    default: {
      const exhaustiveCheck: never = type;
      throw new OcpParseError(`Unsupported entity type: ${exhaustiveCheck as string}`, {
        source: 'entityType',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}
