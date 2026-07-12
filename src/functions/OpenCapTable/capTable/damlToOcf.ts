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
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { ReadScopeParams } from '../../../types/common';
import { extractGeneratedCreateArgumentData, requireGeneratedRecord } from '../../../utils/generatedDamlValidation';
import { initialSharesAuthorizedFromDaml } from '../../../utils/typeConversions';
import { parseDamlSafeInteger } from '../shared/damlIntegers';
import { assertCanonicalJsonGraph, requireDecimalString } from '../shared/ocfValues';
import { readSingleContract } from '../shared/singleContractRead';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TAG_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
  type OcfDataTypeFor,
  type OcfEntityType,
} from './batchTypes';
import { decodeLosslessGeneratedDamlValue } from './damlCodecLosslessness';

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
import { damlIssuerDataToNative, projectDamlIssuerDataToNative } from '../issuer/getIssuerAsOcf';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStakeholderDataToNative } from '../stakeholder/getStakeholderAsOcf';
import {
  damlOptionalStakeholderRelationshipToNative,
  damlStakeholderRelationshipChangeEventToNative,
} from '../stakeholderRelationshipChangeEvent/damlToOcf';
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

export { ENTITY_DATA_FIELD_MAP, ENTITY_TEMPLATE_ID_MAP };

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
  assertCanonicalJsonGraph(data, type);
  switch (type) {
    // ===== Core objects =====
    case 'document':
      return damlDocumentDataToNative(data as Parameters<typeof damlDocumentDataToNative>[0]);
    case 'issuer':
      return damlIssuerDataToNative(data as Parameters<typeof damlIssuerDataToNative>[0]);
    case 'stakeholder':
      return damlStakeholderDataToNative(data as Parameters<typeof damlStakeholderDataToNative>[0]);
    case 'stockClass':
      return damlStockClassDataToNative(data);
    case 'stockLegendTemplate':
      return damlStockLegendTemplateDataToNative(data as Parameters<typeof damlStockLegendTemplateDataToNative>[0]);
    case 'stockPlan':
      return damlStockPlanDataToNative(data as Parameters<typeof damlStockPlanDataToNative>[0]);
    case 'vestingTerms':
      return damlVestingTermsDataToNative(data as Parameters<typeof damlVestingTermsDataToNative>[0]);

    // ===== Issuance types =====
    case 'convertibleIssuance':
      return damlConvertibleIssuanceDataToNative(data);
    case 'equityCompensationIssuance':
      return damlEquityCompensationIssuanceDataToNative(data);
    case 'stockIssuance':
      return damlStockIssuanceDataToNative(data as Parameters<typeof damlStockIssuanceDataToNative>[0]);
    case 'warrantIssuance':
      return damlWarrantIssuanceDataToNative(data);

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

    // ===== Exercise types =====
    case 'equityCompensationExercise':
      return damlEquityCompensationExerciseDataToNative(data);

    // ===== Adjustment types =====
    case 'issuerAuthorizedSharesAdjustment':
      return damlIssuerAuthorizedSharesAdjustmentDataToNative(data);
    case 'stockClassAuthorizedSharesAdjustment':
      return damlStockClassAuthorizedSharesAdjustmentDataToNative(
        data as Parameters<typeof damlStockClassAuthorizedSharesAdjustmentDataToNative>[0]
      );
    case 'stockPlanPoolAdjustment':
      return damlStockPlanPoolAdjustmentDataToNative(
        data as Parameters<typeof damlStockPlanPoolAdjustmentDataToNative>[0]
      );

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
    case 'vestingAcceleration':
      return damlVestingAccelerationToNative(data as Parameters<typeof damlVestingAccelerationToNative>[0]);
    case 'vestingEvent':
      return damlVestingEventToNative(data as Parameters<typeof damlVestingEventToNative>[0]);
    case 'vestingStart':
      return damlVestingStartToNative(data as Parameters<typeof damlVestingStartToNative>[0]);

    // Types with converters imported from entity folders
    case 'stockRetraction':
      return damlStockRetractionToNative(data as Parameters<typeof damlStockRetractionToNative>[0]);
    case 'stockConversion':
      return damlStockConversionToNative(data as Parameters<typeof damlStockConversionToNative>[0]);
    case 'stockPlanReturnToPool':
      return damlStockPlanReturnToPoolToNative(data as Parameters<typeof damlStockPlanReturnToPoolToNative>[0]);
    case 'stockReissuance':
      return damlStockReissuanceToNative(data as Parameters<typeof damlStockReissuanceToNative>[0]);
    case 'warrantExercise':
      return damlWarrantExerciseToNative(data);
    case 'warrantRetraction':
      return damlWarrantRetractionToNative(data as Parameters<typeof damlWarrantRetractionToNative>[0]);
    case 'convertibleConversion':
      return damlConvertibleConversionToNative(data as Parameters<typeof damlConvertibleConversionToNative>[0]);
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

    // Transfer types (with converters from entity folders)
    case 'stockTransfer':
      return damlStockTransferToNative(data as Parameters<typeof damlStockTransferToNative>[0]);
    case 'warrantTransfer':
      return damlWarrantTransferToNative(data as Parameters<typeof damlWarrantTransferToNative>[0]);
    case 'equityCompensationTransfer':
      return damlEquityCompensationTransferToNative(
        data as Parameters<typeof damlEquityCompensationTransferToNative>[0]
      );
    case 'convertibleTransfer':
      return damlConvertibleTransferToNative(data as Parameters<typeof damlConvertibleTransferToNative>[0]);

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

/** Decode unknown ledger JSON into the exact generated DAML payload for an entity kind. */
export function decodeDamlEntityData<const EntityType extends OcfEntityType>(
  entityType: EntityType,
  input: unknown
): DamlDataTypeFor<EntityType>;
export function decodeDamlEntityData(entityType: OcfEntityType, input: unknown): DamlDataTypeFor<OcfEntityType> {
  assertCanonicalJsonGraph(input, entityType);
  preflightSemanticDamlEntityData(entityType, input);
  const tag = ENTITY_TAG_MAP[entityType].edit;
  const rootPath = `damlToOcf.${entityType}`;
  if (entityType === 'stakeholderRelationshipChangeEvent') {
    const relationship = requireGeneratedRecord(input, rootPath);
    for (const field of ['relationship_started', 'relationship_ended'] as const) {
      damlOptionalStakeholderRelationshipToNative(relationship[field], `${rootPath}.${field}`);
    }
  }
  const decoded = decodeLosslessGeneratedDamlValue(
    Fairmint.OpenCapTable.CapTable.OcfEditData,
    { tag, value: input },
    {
      rootPath: entityType,
      description: entityType,
      decodeSource: `damlToOcf.${entityType}`,
      context: { entityType, expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[entityType] },
    },
    {
      raw: input,
      encoded: (encoded) => (isRecord(encoded) ? encoded.value : undefined),
      decoded: (value) => value.value,
    }
  );

  return decoded.value;
}

function hasOwnField(record: object, field: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function preflightSemanticDamlEntityData(entityType: OcfEntityType, input: unknown): void {
  if (!isRecord(input)) return;

  if (entityType === 'issuer') {
    projectDamlIssuerDataToNative(input as Parameters<typeof projectDamlIssuerDataToNative>[0]);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

  // Extract entity-specific data field
  const entityData = extractEntityData(entityType, createArgument);
  const decodedEntityData = decodeDamlEntityData(entityType, entityData);

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
