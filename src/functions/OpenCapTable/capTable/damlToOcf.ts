/**
 * Centralized DAML to OCF converter dispatcher.
 *
 * This module provides a unified interface for converting DAML contract data to native OCF format.
 * It mirrors the `ocfToDaml.ts` dispatcher for writes, providing a symmetric API for reads.
 *
 * IMPORTANT: This file is a DISPATCHER ONLY. All converter implementations should be in their
 * respective entity folders (e.g., stockRetraction/damlToOcf.ts).
 * See CLAUDE.md "Entity Folder Organization (CRITICAL)" for details.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { ReadScopeParams } from '../../../types/common';
import { assertCanonicalJsonGraph } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor, type OcfDataTypeFor, type OcfEntityType } from './batchTypes';
import { extractAndDecodeDamlEntityData } from './damlEntityData';

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
import { decodeStockClassConversionRatioAdjustmentCreateArgument } from '../stockClassConversionRatioAdjustment/getStockClassConversionRatioAdjustmentAsOcf';
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

export { ENTITY_DATA_FIELD_MAP, ENTITY_TEMPLATE_ID_MAP } from './batchTypes';
export { decodeDamlEntityData, extractAndDecodeDamlEntityData, extractEntityData } from './damlEntityData';

// Note: DAML input type definitions and converter implementations have been moved to their
// respective entity folders (e.g., stockTransfer/damlToOcf.ts) following the Entity Folder
// Organization pattern. This dispatcher now imports and delegates to those implementations.

/**
 * Supported entity types for the convertToOcf dispatcher.
 *
 * This dispatcher supports all core OCF entity types. Each converter is imported from its
 * respective entity folder following the Entity Folder Organization pattern.
 */
export type SupportedOcfReadType = OcfEntityType;

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
export function convertToOcf<const EntityType extends SupportedOcfReadType>(
  type: EntityType,
  damlData: DamlDataTypeFor<EntityType>
): OcfDataTypeFor<EntityType>;
export function convertToOcf(
  type: SupportedOcfReadType,
  data: DamlDataTypeFor<SupportedOcfReadType>
): OcfDataTypeFor<SupportedOcfReadType> {
  // Transfer converters perform their own parse-error preflight before generated
  // decoding. Dispatch them before the generic writer-oriented JSON validator so
  // every direct and dispatcher transfer read reports the same public error family.
  if (type === 'stockTransfer') {
    return damlStockTransferToNative(data as Parameters<typeof damlStockTransferToNative>[0]);
  }
  if (type === 'warrantTransfer') {
    return damlWarrantTransferToNative(data as Parameters<typeof damlWarrantTransferToNative>[0]);
  }
  if (type === 'equityCompensationTransfer') {
    return damlEquityCompensationTransferToNative(data as Parameters<typeof damlEquityCompensationTransferToNative>[0]);
  }
  if (type === 'convertibleTransfer') {
    return damlConvertibleTransferToNative(data as Parameters<typeof damlConvertibleTransferToNative>[0]);
  }
  // Vesting converters share the same trap-free plain-data preflight as their
  // full-wrapper and ledger readers, so dispatch them before the generic guard.
  if (type === 'vestingTerms') {
    return damlVestingTermsDataToNative(data as Parameters<typeof damlVestingTermsDataToNative>[0]);
  }
  if (type === 'vestingAcceleration') {
    return damlVestingAccelerationToNative(data as Parameters<typeof damlVestingAccelerationToNative>[0]);
  }
  if (type === 'vestingEvent') {
    return damlVestingEventToNative(data as Parameters<typeof damlVestingEventToNative>[0]);
  }
  if (type === 'vestingStart') {
    return damlVestingStartToNative(data as Parameters<typeof damlVestingStartToNative>[0]);
  }
  // Administrative adjustments decode through their correlated generated codec
  // before any field is dereferenced, matching direct and ledger reader safety.
  if (type === 'issuerAuthorizedSharesAdjustment') {
    return damlIssuerAuthorizedSharesAdjustmentDataToNative(
      data as Parameters<typeof damlIssuerAuthorizedSharesAdjustmentDataToNative>[0]
    );
  }
  if (type === 'stockClassAuthorizedSharesAdjustment') {
    return damlStockClassAuthorizedSharesAdjustmentDataToNative(
      data as Parameters<typeof damlStockClassAuthorizedSharesAdjustmentDataToNative>[0]
    );
  }
  if (type === 'stockPlanPoolAdjustment') {
    return damlStockPlanPoolAdjustmentDataToNative(
      data as Parameters<typeof damlStockPlanPoolAdjustmentDataToNative>[0]
    );
  }

  // Issuance converters run their correlated generated-codec preflight first,
  // preserving one parse-error family across direct, dispatcher, and ledger reads.
  if (type === 'convertibleIssuance') {
    return damlConvertibleIssuanceDataToNative(data as Parameters<typeof damlConvertibleIssuanceDataToNative>[0]);
  }
  if (type === 'equityCompensationIssuance') {
    return damlEquityCompensationIssuanceDataToNative(
      data as Parameters<typeof damlEquityCompensationIssuanceDataToNative>[0]
    );
  }
  if (type === 'stockIssuance') {
    return damlStockIssuanceDataToNative(data as Parameters<typeof damlStockIssuanceDataToNative>[0]);
  }
  if (type === 'warrantIssuance') {
    return damlWarrantIssuanceDataToNative(data as Parameters<typeof damlWarrantIssuanceDataToNative>[0]);
  }

  // Conversion and exercise converters own their generated-codec preflight and
  // semantic Numeric/date validation. Dispatch them before the generic guard so
  // direct, dispatcher, and ledger-reader boundaries expose identical behavior.
  if (type === 'convertibleConversion') {
    return damlConvertibleConversionToNative(data as Parameters<typeof damlConvertibleConversionToNative>[0]);
  }
  if (type === 'stockConversion') {
    return damlStockConversionToNative(data as Parameters<typeof damlStockConversionToNative>[0]);
  }
  if (type === 'equityCompensationExercise') {
    return damlEquityCompensationExerciseDataToNative(
      data as Parameters<typeof damlEquityCompensationExerciseDataToNative>[0]
    );
  }
  if (type === 'warrantExercise') {
    return damlWarrantExerciseToNative(data as Parameters<typeof damlWarrantExerciseToNative>[0]);
  }

  assertCanonicalJsonGraph(data, type);
  switch (type) {
    // ===== Core objects =====
    case 'document':
      return damlDocumentDataToNative(data);
    case 'issuer':
      return damlIssuerDataToNative(data);
    case 'stakeholder':
      return damlStakeholderDataToNative(data as Parameters<typeof damlStakeholderDataToNative>[0]);
    case 'stockClass':
      return damlStockClassDataToNative(data);
    case 'stockLegendTemplate':
      return damlStockLegendTemplateDataToNative(data as Parameters<typeof damlStockLegendTemplateDataToNative>[0]);
    case 'stockPlan':
      return damlStockPlanDataToNative(data);

    // ===== Acceptance types =====
    case 'stockAcceptance':
      return damlStockAcceptanceToNative(data as Parameters<typeof damlStockAcceptanceToNative>[0]);
    case 'convertibleAcceptance':
      return damlConvertibleAcceptanceToNative(data as Parameters<typeof damlConvertibleAcceptanceToNative>[0]);
    case 'equityCompensationAcceptance':
      return damlEquityCompensationAcceptanceToNative(
        data as Parameters<typeof damlEquityCompensationAcceptanceToNative>[0]
      );
    case 'warrantAcceptance':
      return damlWarrantAcceptanceToNative(data as Parameters<typeof damlWarrantAcceptanceToNative>[0]);

    // Stock class adjustments (with converters from entity folders)
    case 'stockClassConversionRatioAdjustment':
      return damlStockClassConversionRatioAdjustmentToNative(
        data as Parameters<typeof damlStockClassConversionRatioAdjustmentToNative>[0]
      );
    case 'stockClassSplit':
      return damlStockClassSplitToNative(data as Parameters<typeof damlStockClassSplitToNative>[0]);
    case 'stockConsolidation':
      return damlStockConsolidationToNative(data as Parameters<typeof damlStockConsolidationToNative>[0]);

    // Valuation and vesting (with converters from entity folders)
    case 'valuation':
      return damlValuationToNative(data as Parameters<typeof damlValuationToNative>[0]);

    // Types with converters imported from entity folders
    case 'stockRetraction':
      return damlStockRetractionToNative(data as Parameters<typeof damlStockRetractionToNative>[0]);
    case 'stockPlanReturnToPool':
      return damlStockPlanReturnToPoolToNative(data as Parameters<typeof damlStockPlanReturnToPoolToNative>[0]);
    case 'stockReissuance':
      return damlStockReissuanceToNative(data as Parameters<typeof damlStockReissuanceToNative>[0]);
    case 'warrantRetraction':
      return damlWarrantRetractionToNative(data as Parameters<typeof damlWarrantRetractionToNative>[0]);
    case 'convertibleRetraction':
      return damlConvertibleRetractionToNative(data as Parameters<typeof damlConvertibleRetractionToNative>[0]);
    case 'equityCompensationRelease':
      return damlEquityCompensationReleaseToNative(data as Parameters<typeof damlEquityCompensationReleaseToNative>[0]);
    case 'equityCompensationRepricing':
      return damlEquityCompensationRepricingToNative(
        data as Parameters<typeof damlEquityCompensationRepricingToNative>[0]
      );
    case 'equityCompensationRetraction':
      return damlEquityCompensationRetractionToNative(
        data as Parameters<typeof damlEquityCompensationRetractionToNative>[0]
      );

    // Cancellation types (with converters from entity folders)
    case 'stockCancellation':
      return damlStockCancellationToNative(data as Parameters<typeof damlStockCancellationToNative>[0]);
    case 'warrantCancellation':
      return damlWarrantCancellationToNative(data as Parameters<typeof damlWarrantCancellationToNative>[0]);
    case 'equityCompensationCancellation':
      return damlEquityCompensationCancellationToNative(
        data as Parameters<typeof damlEquityCompensationCancellationToNative>[0]
      );
    case 'convertibleCancellation':
      return damlConvertibleCancellationToNative(data as Parameters<typeof damlConvertibleCancellationToNative>[0]);

    // Repurchase (with converter from entity folder)
    case 'stockRepurchase':
      return damlStockRepurchaseToNative(data as Parameters<typeof damlStockRepurchaseToNative>[0]);

    // Stakeholder events (with converters from entity folders)
    case 'stakeholderRelationshipChangeEvent':
      return damlStakeholderRelationshipChangeEventToNative(
        data as Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0]
      );
    case 'stakeholderStatusChangeEvent':
      return damlStakeholderStatusChangeEventToNative(
        data as Parameters<typeof damlStakeholderStatusChangeEventToNative>[0]
      );

    default: {
      throw new OcpParseError(`Unsupported entity type for convertToOcf: ${String(type)}`, {
        source: 'damlToOcf.convertToOcf',
        code: OcpErrorCodes.UNKNOWN_ENTITY_TYPE,
      });
    }
  }
}

export { extractCreateArgument } from '../shared/singleContractRead';

/**
 * Result type for getEntityAsOcf.
 */
export interface GetEntityAsOcfResult<T extends SupportedOcfReadType> {
  /** The native OCF data */
  data: OcfDataTypeFor<T>;
  /** The contract ID */
  contractId: string;
}

export interface GetEntityAsOcfOptions extends ReadScopeParams {}

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
  contractId: string,
  options: GetEntityAsOcfOptions = {}
): Promise<GetEntityAsOcfResult<T>> {
  const { createArgument } = await readSingleContract(
    client,
    {
      contractId,
      ...options,
    },
    {
      operation: `getEntityAsOcf(${entityType})`,
      missingDataError: 'parse',
      expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType],
    }
  );

  const decodedEntityData = extractAndDecodeDamlEntityData(entityType, createArgument);

  // Convert DAML data to native OCF format
  const nativeData = convertToOcf(entityType, decodedEntityData);
  if (entityType === 'stockClassConversionRatioAdjustment') {
    decodeStockClassConversionRatioAdjustmentCreateArgument(createArgument, `damlToOcf.${entityType}.createArgument`);
  }

  return {
    data: nativeData,
    contractId,
  };
}
