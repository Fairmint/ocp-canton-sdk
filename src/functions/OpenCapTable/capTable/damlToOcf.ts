/**
 * Centralized DAML to OCF converter dispatcher.
 *
 * This module provides a unified interface for converting DAML contract data to native OCF format.
 * It mirrors the `ocfToDaml.ts` dispatcher for writes, providing a symmetric API for reads.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfDataTypeFor, OcfEntityType } from './batchTypes';

// Import existing converters from entity folders
import { damlConvertibleAcceptanceToNative } from '../convertibleAcceptance/convertibleAcceptanceDataToDaml';
import { damlEquityCompensationAcceptanceToNative } from '../equityCompensationAcceptance/equityCompensationAcceptanceDataToDaml';
import { damlStockAcceptanceToNative } from '../stockAcceptance/stockAcceptanceDataToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { damlStockClassSplitToNative } from '../stockClassSplit/damlToStockClassSplit';
import { damlStockConsolidationToNative } from '../stockConsolidation/damlToStockConsolidation';
import { damlStockReissuanceToNative } from '../stockReissuance/damlToStockReissuance';
import { damlValuationToNative } from '../valuation/damlToOcf';
import { damlVestingAccelerationToNative } from '../vestingAcceleration/damlToOcf';
import { damlVestingEventToNative } from '../vestingEvent/damlToOcf';
import { damlVestingStartToNative } from '../vestingStart/damlToOcf';
import { damlWarrantAcceptanceToNative } from '../warrantAcceptance/warrantAcceptanceDataToDaml';

// Import shared utilities
import {
  damlStakeholderRelationshipToNative,
  type DamlStakeholderRelationshipType,
} from '../../../utils/enumConversions';
import { damlMonetaryToNative, damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

// ===== Data field name mapping for contract extraction =====

/**
 * Maps entity types to the field name containing the entity data in the DAML contract.
 * For example, 'stakeholder' contracts have data in 'stakeholder_data' field.
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
  issuerAuthorizedSharesAdjustment: 'adjustment_data',
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

// ===== Simple inline converters for types without dedicated files =====
// These follow the same pattern as ocfToDaml.ts

function stockRetractionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    reason_text: d.reason_text as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function stockConversionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function stockPlanReturnToPoolDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    stock_plan_id: d.stock_plan_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    reason_text: d.reason_text as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function warrantExerciseDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function warrantRetractionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    reason_text: d.reason_text as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function convertibleConversionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.trigger_id ? { trigger_id: d.trigger_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function convertibleRetractionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    reason_text: d.reason_text as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function equityCompensationReleaseDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.settlement_date ? { settlement_date: damlTimeToDateString(d.settlement_date as string) } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function equityCompensationRepricingDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function equityCompensationRetractionDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    reason_text: d.reason_text as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Transfer converter for stock/warrant/equity compensation (quantity-based)
function quantityTransferDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Transfer converter for convertibles (amount-based)
function convertibleTransferDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    amount: damlMonetaryToNative(d.amount as { amount: string; currency: string }),
    resulting_security_ids: d.resulting_security_ids as string[],
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Cancellation converter for stock/warrant/equity compensation (quantity-based)
function quantityCancellationDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    reason_text: d.reason_text as string,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Cancellation converter for convertibles (no quantity field)
function convertibleCancellationDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    reason_text: d.reason_text as string,
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Repurchase converter
function stockRepurchaseDataToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    security_id: d.security_id as string,
    quantity: normalizeNumericString(d.quantity as string),
    ...(d.price && typeof d.price === 'object'
      ? { price: damlMonetaryToNative(d.price as { amount: string; currency: string }) }
      : {}),
    ...(d.balance_security_id ? { balance_security_id: d.balance_security_id } : {}),
    ...(d.consideration_text ? { consideration_text: d.consideration_text } : {}),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

// Stakeholder events converters
function stakeholderRelationshipChangeEventToNative(d: Record<string, unknown>): Record<string, unknown> {
  const newRelationships = d.new_relationships as string[];
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    stakeholder_id: d.stakeholder_id as string,
    new_relationships: newRelationships.map((rel) =>
      damlStakeholderRelationshipToNative(rel as DamlStakeholderRelationshipType)
    ),
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

function stakeholderStatusChangeEventToNative(d: Record<string, unknown>): Record<string, unknown> {
  return {
    id: d.id as string,
    date: damlTimeToDateString(d.date as string),
    stakeholder_id: d.stakeholder_id as string,
    new_status: d.new_status as string,
    ...(Array.isArray(d.comments) && d.comments.length > 0 ? { comments: d.comments } : {}),
  };
}

/**
 * Supported entity types for the convertToOcf dispatcher.
 *
 * Note: Some entity types (issuer, stockClass, stockIssuance, etc.) have complex converters
 * that are inlined in their get*AsOcf functions. These will be migrated over time.
 * For now, this dispatcher handles the simpler entity types with existing converters.
 */
export type SupportedOcfReadType =
  | 'convertibleAcceptance'
  | 'convertibleCancellation'
  | 'convertibleConversion'
  | 'convertibleRetraction'
  | 'convertibleTransfer'
  | 'equityCompensationAcceptance'
  | 'equityCompensationCancellation'
  | 'equityCompensationRelease'
  | 'equityCompensationRepricing'
  | 'equityCompensationRetraction'
  | 'equityCompensationTransfer'
  | 'stakeholderRelationshipChangeEvent'
  | 'stakeholderStatusChangeEvent'
  | 'stockAcceptance'
  | 'stockCancellation'
  | 'stockClassConversionRatioAdjustment'
  | 'stockClassSplit'
  | 'stockConsolidation'
  | 'stockConversion'
  | 'stockPlanReturnToPool'
  | 'stockReissuance'
  | 'stockRepurchase'
  | 'stockRetraction'
  | 'stockTransfer'
  | 'valuation'
  | 'vestingAcceleration'
  | 'vestingEvent'
  | 'vestingStart'
  | 'warrantAcceptance'
  | 'warrantCancellation'
  | 'warrantExercise'
  | 'warrantRetraction'
  | 'warrantTransfer';

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
    // Acceptance types (with existing converters)
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

    // Stock class adjustments (with existing converters)
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

    // Valuation and vesting (with existing converters)
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

    // Reissuance (with existing converter)
    case 'stockReissuance':
      return damlStockReissuanceToNative(
        data as Parameters<typeof damlStockReissuanceToNative>[0]
      ) as OcfDataTypeFor<T>;

    // Types with inline converters
    case 'stockRetraction':
      return stockRetractionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'stockConversion':
      return stockConversionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'stockPlanReturnToPool':
      return stockPlanReturnToPoolDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'warrantExercise':
      return warrantExerciseDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'warrantRetraction':
      return warrantRetractionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'convertibleConversion':
      return convertibleConversionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'convertibleRetraction':
      return convertibleRetractionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'equityCompensationRelease':
      return equityCompensationReleaseDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'equityCompensationRepricing':
      return equityCompensationRepricingDataToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'equityCompensationRetraction':
      return equityCompensationRetractionDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Transfer types - quantity-based
    case 'stockTransfer':
    case 'equityCompensationTransfer':
    case 'warrantTransfer':
      return quantityTransferDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Transfer types - amount-based (convertibles)
    case 'convertibleTransfer':
      return convertibleTransferDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Cancellation types - quantity-based
    case 'stockCancellation':
    case 'equityCompensationCancellation':
    case 'warrantCancellation':
      return quantityCancellationDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Cancellation types - no quantity (convertibles)
    case 'convertibleCancellation':
      return convertibleCancellationDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Repurchase
    case 'stockRepurchase':
      return stockRepurchaseDataToNative(damlData) as unknown as OcfDataTypeFor<T>;

    // Stakeholder events
    case 'stakeholderRelationshipChangeEvent':
      return stakeholderRelationshipChangeEventToNative(damlData) as unknown as OcfDataTypeFor<T>;
    case 'stakeholderStatusChangeEvent':
      return stakeholderStatusChangeEventToNative(damlData) as unknown as OcfDataTypeFor<T>;

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
