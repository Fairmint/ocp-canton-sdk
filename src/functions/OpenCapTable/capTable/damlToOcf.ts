/**
 * Centralized DAML to OCF converter dispatcher.
 *
 * This module provides a unified interface for converting DAML contract data to native OCF format.
 * It mirrors the `ocfToDaml.ts` dispatcher for writes, providing a symmetric API for reads.
 *
 * IMPORTANT: This file is a DISPATCHER ONLY. All converter implementations should be in their
 * respective entity folders (e.g., stockRetraction/damlToOcf.ts).
 * See llms.txt "Entity Folder Organization (CRITICAL)" for details.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfDataTypeFor, OcfEntityType } from './batchTypes';

// Import converters from entity folders
import { damlConvertibleAcceptanceToNative } from '../convertibleAcceptance/convertibleAcceptanceDataToDaml';
import { damlConvertibleCancellationToNative } from '../convertibleCancellation/damlToOcf';
import { damlConvertibleConversionToNative } from '../convertibleConversion/damlToOcf';
import { damlConvertibleIssuanceDataToNative } from '../convertibleIssuance/getConvertibleIssuanceAsOcf';
import { damlConvertibleRetractionToNative } from '../convertibleRetraction/damlToOcf';
import { damlConvertibleTransferToNative } from '../convertibleTransfer/damlToOcf';
import { damlDocumentDataToNative } from '../document/getDocumentAsOcf';
import { damlEquityCompensationAcceptanceToNative } from '../equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
import { damlEquityCompensationCancellationToNative } from '../equityCompensationCancellation/damlToOcf';
import { damlEquityCompensationExerciseDataToNative } from '../equityCompensationExercise/getEquityCompensationExerciseAsOcf';
import { damlEquityCompensationIssuanceDataToNative } from '../equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { damlEquityCompensationReleaseToNative } from '../equityCompensationRelease/damlToOcf';
import { damlEquityCompensationRepricingToNative } from '../equityCompensationRepricing/damlToOcf';
import { damlEquityCompensationRetractionToNative } from '../equityCompensationRetraction/damlToOcf';
import { damlEquityCompensationTransferToNative } from '../equityCompensationTransfer/damlToOcf';
import { damlIssuerDataToNative } from '../issuer/getIssuerAsOcf';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStakeholderDataToNative } from '../stakeholder/getStakeholderAsOcf';
import { damlStakeholderRelationshipChangeEventToNative } from '../stakeholderRelationshipChangeEvent/damlToOcf';
import { damlStakeholderStatusChangeEventToNative } from '../stakeholderStatusChangeEvent/damlToOcf';
import { damlStockAcceptanceToNative } from '../stockAcceptance/stockAcceptanceDataToDaml';
import { damlStockCancellationToNative } from '../stockCancellation/damlToOcf';
import { damlStockClassDataToNative } from '../stockClass/getStockClassAsOcf';
import { damlStockClassAuthorizedSharesAdjustmentDataToNative } from '../stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassConversionRatioAdjustmentToNative } from '../stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { damlStockClassSplitToNative } from '../stockClassSplit/damlToStockClassSplit';
import { damlStockConsolidationToNative } from '../stockConsolidation/damlToStockConsolidation';
import { damlStockConversionToNative } from '../stockConversion/damlToOcf';
import { damlStockIssuanceDataToNative } from '../stockIssuance/getStockIssuanceAsOcf';
import { damlStockLegendTemplateDataToNative } from '../stockLegendTemplate/getStockLegendTemplateAsOcf';
import { damlStockPlanDataToNative } from '../stockPlan/getStockPlanAsOcf';
import { damlStockPlanPoolAdjustmentDataToNative } from '../stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
import { damlStockPlanReturnToPoolToNative } from '../stockPlanReturnToPool/damlToOcf';
import { damlStockReissuanceToNative } from '../stockReissuance/damlToStockReissuance';
import { damlStockRepurchaseToNative } from '../stockRepurchase/damlToOcf';
import { damlStockRetractionToNative } from '../stockRetraction/damlToOcf';
import { damlStockTransferToNative } from '../stockTransfer/damlToOcf';
import { damlValuationToNative } from '../valuation/damlToOcf';
import { damlVestingAccelerationToNative } from '../vestingAcceleration/damlToOcf';
import { damlVestingEventToNative } from '../vestingEvent/damlToOcf';
import { damlVestingStartToNative } from '../vestingStart/damlToOcf';
import { damlVestingTermsDataToNative } from '../vestingTerms/getVestingTermsAsOcf';
import { damlWarrantAcceptanceToNative } from '../warrantAcceptance/warrantAcceptanceDataToDaml';
import { damlWarrantCancellationToNative } from '../warrantCancellation/damlToOcf';
import { damlWarrantExerciseToNative } from '../warrantExercise/damlToOcf';
import { damlWarrantIssuanceDataToNative } from '../warrantIssuance/getWarrantIssuanceAsOcf';
import { damlWarrantRetractionToNative } from '../warrantRetraction/damlToOcf';
import { damlWarrantTransferToNative } from '../warrantTransfer/damlToOcf';

// ===== Data field name mapping for contract extraction =====

/**
 * Maps entity types to the field name containing the entity data in the DAML contract.
 * For example, 'stakeholder' contracts have data in 'stakeholder_data' field.
 *
 * Note: PlanSecurity types use the same data fields as EquityCompensation since they
 * share the same underlying DAML contracts.
 */
export const ENTITY_DATA_FIELD_MAP: Record<OcfEntityType, string> = {
  convertibleAcceptance: 'acceptance_data',
  convertibleCancellation: 'cancellation_data',
  convertibleConversion: 'conversion_data',
  convertibleIssuance: 'issuance_data',
  convertibleRetraction: 'retraction_data',
  convertibleTransfer: 'transfer_data',
  document: 'document_data',
  equityCompensationAcceptance: 'acceptance_data',
  equityCompensationCancellation: 'cancellation_data',
  equityCompensationExercise: 'exercise_data',
  equityCompensationIssuance: 'issuance_data',
  equityCompensationRelease: 'release_data',
  equityCompensationRepricing: 'repricing_data',
  equityCompensationRetraction: 'retraction_data',
  equityCompensationTransfer: 'transfer_data',
  // Issuer is edit-only (stored as a single reference in CapTable, not a map)
  issuer: 'issuer_data',
  issuerAuthorizedSharesAdjustment: 'adjustment_data',
  // PlanSecurity aliases - use EquityCompensation data field names
  planSecurityAcceptance: 'acceptance_data',
  planSecurityCancellation: 'cancellation_data',
  planSecurityExercise: 'exercise_data',
  planSecurityIssuance: 'issuance_data',
  planSecurityRelease: 'release_data',
  planSecurityRetraction: 'retraction_data',
  planSecurityTransfer: 'transfer_data',
  stakeholder: 'stakeholder_data',
  stakeholderRelationshipChangeEvent: 'relationship_change_data',
  stakeholderStatusChangeEvent: 'status_change_data',
  stockAcceptance: 'acceptance_data',
  stockCancellation: 'cancellation_data',
  stockClass: 'stock_class_data',
  stockClassAuthorizedSharesAdjustment: 'adjustment_data',
  stockClassConversionRatioAdjustment: 'adjustment_data',
  stockClassSplit: 'split_data',
  stockConsolidation: 'consolidation_data',
  stockConversion: 'conversion_data',
  stockIssuance: 'issuance_data',
  stockLegendTemplate: 'stock_legend_template_data',
  stockPlan: 'stock_plan_data',
  stockPlanPoolAdjustment: 'adjustment_data',
  stockPlanReturnToPool: 'return_data',
  stockReissuance: 'reissuance_data',
  stockRepurchase: 'repurchase_data',
  stockRetraction: 'retraction_data',
  stockTransfer: 'transfer_data',
  valuation: 'valuation_data',
  vestingAcceleration: 'vesting_acceleration_data',
  vestingEvent: 'vesting_event_data',
  vestingStart: 'vesting_start_data',
  vestingTerms: 'vesting_terms_data',
  warrantAcceptance: 'acceptance_data',
  warrantCancellation: 'cancellation_data',
  warrantExercise: 'exercise_data',
  warrantIssuance: 'issuance_data',
  warrantRetraction: 'retraction_data',
  warrantTransfer: 'transfer_data',
};

// Note: DAML input type definitions and converter implementations have been moved to their
// respective entity folders (e.g., stockTransfer/damlToOcf.ts) following the Entity Folder
// Organization pattern. This dispatcher now imports and delegates to those implementations.

/**
 * Supported entity types for the convertToOcf dispatcher.
 *
 * This dispatcher supports all core OCF entity types. Each converter is imported from its
 * respective entity folder following the Entity Folder Organization pattern.
 *
 * PlanSecurity types are aliases that delegate to EquityCompensation converters.
 */
export type SupportedOcfReadType =
  // Core objects
  | 'document'
  | 'issuer'
  | 'stakeholder'
  | 'stockClass'
  | 'stockLegendTemplate'
  | 'stockPlan'
  | 'vestingTerms'
  // Issuance types
  | 'convertibleIssuance'
  | 'equityCompensationIssuance'
  | 'stockIssuance'
  | 'warrantIssuance'
  // Acceptance types
  | 'convertibleAcceptance'
  | 'equityCompensationAcceptance'
  | 'stockAcceptance'
  | 'warrantAcceptance'
  // Cancellation types
  | 'convertibleCancellation'
  | 'equityCompensationCancellation'
  | 'stockCancellation'
  | 'warrantCancellation'
  // Transfer types
  | 'convertibleTransfer'
  | 'equityCompensationTransfer'
  | 'stockTransfer'
  | 'warrantTransfer'
  // Retraction types
  | 'convertibleRetraction'
  | 'equityCompensationRetraction'
  | 'stockRetraction'
  | 'warrantRetraction'
  // Conversion types
  | 'convertibleConversion'
  | 'stockConversion'
  // Exercise types
  | 'equityCompensationExercise'
  | 'warrantExercise'
  // Release and other equity compensation
  | 'equityCompensationRelease'
  | 'equityCompensationRepricing'
  // Stock adjustments
  | 'stockClassAuthorizedSharesAdjustment'
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockPlanPoolAdjustment'
  | 'stockPlanReturnToPool'
  | 'stockReissuance'
  | 'stockRepurchase'
  // Issuer adjustment
  | 'issuerAuthorizedSharesAdjustment'
  // Stakeholder events
  | 'stakeholderRelationshipChangeEvent'
  | 'stakeholderStatusChangeEvent'
  // Valuation and vesting
  | 'valuation'
  | 'vestingAcceleration'
  | 'vestingEvent'
  | 'vestingStart'
  // PlanSecurity aliases (delegate to EquityCompensation)
  | 'planSecurityAcceptance'
  | 'planSecurityCancellation'
  | 'planSecurityExercise'
  | 'planSecurityIssuance'
  | 'planSecurityRelease'
  | 'planSecurityRetraction'
  | 'planSecurityTransfer';

/**
 * Convert DAML entity data to native OCF format based on entity type.
 *
 * This is the inverse of `convertToDaml()` - it transforms DAML contract data
 * back into native OCF format for reads.
 *
 * @param type - The OCF entity type
 * @param damlData - The DAML contract data (from createArgument)
 * @returns The native OCF data object
 * @throws OcpParseError if the entity type is not supported
 *
 * @example
 * ```typescript
 * const damlData = contract.createArgument.acceptance_data;
 * const native = convertToOcf('stockAcceptance', damlData);
 * ```
 */
export function convertToOcf<T extends SupportedOcfReadType>(
  type: T,
  damlData: Record<string, unknown>
): OcfDataTypeFor<T> {
  // Cast through unknown to allow conversion from Record<string, unknown> to specific types
  const data = damlData as unknown;

  switch (type) {
    // ===== Core objects =====
    case 'document':
      return damlDocumentDataToNative(data as Parameters<typeof damlDocumentDataToNative>[0]) as OcfDataTypeFor<T>;
    case 'issuer':
      return damlIssuerDataToNative(data as Parameters<typeof damlIssuerDataToNative>[0]) as OcfDataTypeFor<T>;
    case 'stakeholder':
      return damlStakeholderDataToNative(
        data as Parameters<typeof damlStakeholderDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockClass':
      return damlStockClassDataToNative(data as Parameters<typeof damlStockClassDataToNative>[0]) as OcfDataTypeFor<T>;
    case 'stockLegendTemplate':
      return damlStockLegendTemplateDataToNative(
        data as Parameters<typeof damlStockLegendTemplateDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockPlan':
      return damlStockPlanDataToNative(data as Parameters<typeof damlStockPlanDataToNative>[0]) as OcfDataTypeFor<T>;
    case 'vestingTerms':
      return damlVestingTermsDataToNative(
        data as Parameters<typeof damlVestingTermsDataToNative>[0]
      ) as OcfDataTypeFor<T>;

    // ===== Issuance types =====
    case 'convertibleIssuance':
      return damlConvertibleIssuanceDataToNative(
        data as Parameters<typeof damlConvertibleIssuanceDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationIssuance':
      return damlEquityCompensationIssuanceDataToNative(
        data as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockIssuance':
      return damlStockIssuanceDataToNative(
        data as Parameters<typeof damlStockIssuanceDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'warrantIssuance':
      return damlWarrantIssuanceDataToNative(
        data as Parameters<typeof damlWarrantIssuanceDataToNative>[0]
      ) as OcfDataTypeFor<T>;

    // ===== Acceptance types =====
    case 'stockAcceptance':
      return damlStockAcceptanceToNative(
        data as Parameters<typeof damlStockAcceptanceToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'convertibleAcceptance':
      return damlConvertibleAcceptanceToNative(
        data as Parameters<typeof damlConvertibleAcceptanceToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationAcceptance':
      return damlEquityCompensationAcceptanceToNative(
        data as Parameters<typeof damlEquityCompensationAcceptanceToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'warrantAcceptance':
      return damlWarrantAcceptanceToNative(
        data as Parameters<typeof damlWarrantAcceptanceToNative>[0]
      ) as OcfDataTypeFor<T>;

    // ===== Exercise types =====
    case 'equityCompensationExercise':
      return damlEquityCompensationExerciseDataToNative(
        data as Parameters<typeof damlEquityCompensationExerciseDataToNative>[0]
      ) as OcfDataTypeFor<T>;

    // ===== Adjustment types =====
    case 'issuerAuthorizedSharesAdjustment':
      return damlIssuerAuthorizedSharesAdjustmentDataToNative(
        data as Parameters<typeof damlIssuerAuthorizedSharesAdjustmentDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockClassAuthorizedSharesAdjustment':
      return damlStockClassAuthorizedSharesAdjustmentDataToNative(
        data as Parameters<typeof damlStockClassAuthorizedSharesAdjustmentDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockPlanPoolAdjustment':
      return damlStockPlanPoolAdjustmentDataToNative(
        data as Parameters<typeof damlStockPlanPoolAdjustmentDataToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Stock class adjustments (with converters from entity folders)
    case 'stockClassConversionRatioAdjustment':
      return damlStockClassConversionRatioAdjustmentToNative(
        data as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockClassSplit':
      return damlStockClassSplitToNative(
        data as Parameters<typeof damlStockClassSplitToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockConsolidation':
      return damlStockConsolidationToNative(
        data as Parameters<typeof damlStockConsolidationToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Valuation and vesting (with converters from entity folders)
    case 'valuation':
      return damlValuationToNative(data as Parameters<typeof damlValuationToNative>[0]) as OcfDataTypeFor<T>;
    case 'vestingAcceleration':
      return damlVestingAccelerationToNative(
        data as Parameters<typeof damlVestingAccelerationToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'vestingEvent':
      return damlVestingEventToNative(data as Parameters<typeof damlVestingEventToNative>[0]) as OcfDataTypeFor<T>;
    case 'vestingStart':
      return damlVestingStartToNative(data as Parameters<typeof damlVestingStartToNative>[0]) as OcfDataTypeFor<T>;

    // Types with converters imported from entity folders
    case 'stockRetraction':
      return damlStockRetractionToNative(
        data as Parameters<typeof damlStockRetractionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockConversion':
      return damlStockConversionToNative(
        data as Parameters<typeof damlStockConversionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockPlanReturnToPool':
      return damlStockPlanReturnToPoolToNative(
        data as Parameters<typeof damlStockPlanReturnToPoolToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stockReissuance':
      return damlStockReissuanceToNative(
        data as Parameters<typeof damlStockReissuanceToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'warrantExercise':
      return damlWarrantExerciseToNative(
        data as Parameters<typeof damlWarrantExerciseToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'warrantRetraction':
      return damlWarrantRetractionToNative(
        data as Parameters<typeof damlWarrantRetractionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'convertibleConversion':
      return damlConvertibleConversionToNative(
        data as Parameters<typeof damlConvertibleConversionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'convertibleRetraction':
      return damlConvertibleRetractionToNative(
        data as Parameters<typeof damlConvertibleRetractionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationRelease':
      return damlEquityCompensationReleaseToNative(
        data as Parameters<typeof damlEquityCompensationReleaseToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationRepricing':
      return damlEquityCompensationRepricingToNative(
        data as Parameters<typeof damlEquityCompensationRepricingToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationRetraction':
      return damlEquityCompensationRetractionToNative(
        data as Parameters<typeof damlEquityCompensationRetractionToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Transfer types (with converters from entity folders)
    case 'stockTransfer':
      return damlStockTransferToNative(data as Parameters<typeof damlStockTransferToNative>[0]) as OcfDataTypeFor<T>;
    case 'warrantTransfer':
      return damlWarrantTransferToNative(
        data as Parameters<typeof damlWarrantTransferToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationTransfer':
      return damlEquityCompensationTransferToNative(
        data as Parameters<typeof damlEquityCompensationTransferToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'convertibleTransfer':
      return damlConvertibleTransferToNative(
        data as Parameters<typeof damlConvertibleTransferToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Cancellation types (with converters from entity folders)
    case 'stockCancellation':
      return damlStockCancellationToNative(
        data as Parameters<typeof damlStockCancellationToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'warrantCancellation':
      return damlWarrantCancellationToNative(
        data as Parameters<typeof damlWarrantCancellationToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'equityCompensationCancellation':
      return damlEquityCompensationCancellationToNative(
        data as Parameters<typeof damlEquityCompensationCancellationToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'convertibleCancellation':
      return damlConvertibleCancellationToNative(
        data as Parameters<typeof damlConvertibleCancellationToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Repurchase (with converter from entity folder)
    case 'stockRepurchase':
      return damlStockRepurchaseToNative(
        data as Parameters<typeof damlStockRepurchaseToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Stakeholder events (with converters from entity folders)
    case 'stakeholderRelationshipChangeEvent':
      return damlStakeholderRelationshipChangeEventToNative(
        data as Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'stakeholderStatusChangeEvent':
      return damlStakeholderStatusChangeEventToNative(
        data as Parameters<typeof damlStakeholderStatusChangeEventToNative>[0]
      ) as OcfDataTypeFor<T>;

    // PlanSecurity aliases - delegate to EquityCompensation converters
    case 'planSecurityAcceptance':
      return damlEquityCompensationAcceptanceToNative(
        data as Parameters<typeof damlEquityCompensationAcceptanceToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityCancellation':
      return damlEquityCompensationCancellationToNative(
        data as Parameters<typeof damlEquityCompensationCancellationToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityExercise':
      return damlEquityCompensationExerciseDataToNative(
        data as Parameters<typeof damlEquityCompensationExerciseDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityIssuance':
      return damlEquityCompensationIssuanceDataToNative(
        data as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityRelease':
      return damlEquityCompensationReleaseToNative(
        damlData as unknown as Parameters<typeof damlEquityCompensationReleaseToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityRetraction':
      return damlEquityCompensationRetractionToNative(
        damlData as unknown as Parameters<typeof damlEquityCompensationRetractionToNative>[0]
      ) as OcfDataTypeFor<T>;
    case 'planSecurityTransfer':
      return damlEquityCompensationTransferToNative(
        data as Parameters<typeof damlEquityCompensationTransferToNative>[0]
      ) as OcfDataTypeFor<T>;

    default: {
      throw new OcpParseError(`Unsupported entity type for convertToOcf: ${type}`, {
        source: 'damlToOcf.convertToOcf',
        code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
      });
    }
  }
}

/**
 * Extract entity data from a DAML contract's create argument.
 *
 * This helper extracts the entity-specific data field from a contract's createArgument,
 * using the entity type to determine the correct field name.
 *
 * @param entityType - The OCF entity type
 * @param createArgument - The contract's createArgument
 * @returns The extracted entity data
 * @throws OcpParseError if the expected data field is not found
 *
 * @example
 * ```typescript
 * const createArg = eventsResponse.created.createdEvent.createArgument;
 * const stockAcceptanceData = extractEntityData('stockAcceptance', createArg);
 * ```
 */
export function extractEntityData(entityType: OcfEntityType, createArgument: unknown): Record<string, unknown> {
  if (!createArgument || typeof createArgument !== 'object') {
    throw new OcpParseError('Invalid createArgument: expected an object', {
      source: entityType,
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }

  const dataFieldName = ENTITY_DATA_FIELD_MAP[entityType];
  const record = createArgument as Record<string, unknown>;

  if (!(dataFieldName in record)) {
    throw new OcpParseError(
      `Expected field '${dataFieldName}' not found in contract create argument for ${entityType}`,
      {
        source: entityType,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      }
    );
  }

  const entityData = record[dataFieldName];
  if (!entityData || typeof entityData !== 'object') {
    throw new OcpParseError(`Entity data field '${dataFieldName}' is not an object for ${entityType}`, {
      source: entityType,
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  return entityData as Record<string, unknown>;
}

/**
 * Contract events response type from the ledger client.
 */
interface ContractEventsResponse {
  created?: {
    createdEvent: {
      createArgument?: unknown;
    };
  };
}

/**
 * Extract the createArgument from a contract events response.
 *
 * This helper provides consistent error handling for contract data extraction,
 * replacing the duplicated pattern across get*AsOcf functions.
 *
 * @param eventsResponse - The response from getEventsByContractId
 * @param contractId - The contract ID (for error messages)
 * @returns The createArgument from the contract's created event
 * @throws OcpParseError if the response is missing expected fields
 *
 * @example
 * ```typescript
 * const eventsResponse = await client.getEventsByContractId({ contractId });
 * const createArg = extractCreateArgument(eventsResponse, contractId);
 * ```
 */
export function extractCreateArgument(eventsResponse: ContractEventsResponse, contractId: string): unknown {
  if (!eventsResponse.created?.createdEvent) {
    throw new OcpParseError('Invalid contract events response: missing created event', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;
  if (!createArgument) {
    throw new OcpParseError('Invalid contract events response: missing create argument', {
      source: `contract ${contractId}`,
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }

  return createArgument;
}

/**
 * Result type for getEntityAsOcf.
 */
export interface GetEntityAsOcfResult<T extends SupportedOcfReadType> {
  /** The native OCF data */
  data: OcfDataTypeFor<T>;
  /** The contract ID */
  contractId: string;
}

/**
 * Generic function to retrieve and convert a contract to OCF format.
 *
 * This function combines contract fetching, data extraction, and OCF conversion
 * into a single operation, eliminating the duplicated pattern across get*AsOcf functions.
 *
 * @param client - The LedgerJsonApiClient instance
 * @param entityType - The OCF entity type
 * @param contractId - The contract ID to fetch
 * @returns The entity data in native OCF format along with the contract ID
 * @throws OcpParseError if the contract data is invalid or conversion fails
 *
 * @example
 * ```typescript
 * // Generic read using dispatcher
 * const result = await getEntityAsOcf(client, 'stockAcceptance', contractId);
 * // result.data is typed as OcfStockAcceptance
 *
 * // Can be used in place of specific get*AsOcf functions
 * const acceptance = await getEntityAsOcf(client, 'convertibleAcceptance', id);
 * ```
 */
export async function getEntityAsOcf<T extends SupportedOcfReadType>(
  client: LedgerJsonApiClient,
  entityType: T,
  contractId: string
): Promise<GetEntityAsOcfResult<T>> {
  // Fetch contract events
  const eventsResponse = await client.getEventsByContractId({ contractId });

  // Extract createArgument with proper error handling
  const createArgument = extractCreateArgument(eventsResponse, contractId);

  // Extract entity-specific data field
  const entityData = extractEntityData(entityType, createArgument);

  // Convert DAML data to native OCF format
  const nativeData = convertToOcf(entityType, entityData);

  return {
    data: nativeData,
    contractId,
  };
}
