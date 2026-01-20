/**
 * OCF (Open Cap Table Format) helper utilities.
 *
 * General-purpose utilities for working with OCF objects and DAML contracts:
 *
 * - OCF ID extraction from contract data
 * - Human-readable type labels
 *
 * @module ocfHelpers
 */

import { getAllOcfTypes, getOcfMetadata, isValidOcfType, OCF_METADATA, type OcfObjectType } from './ocfMetadata';

/**
 * Get the data field name used in DAML contracts for a given OCF type.
 *
 * This is the field name where OCF data is stored in the contract's create arguments. Useful for extracting OCF data
 * from transaction trees.
 *
 * @example
 *   `getOcfDataFieldName('STAKEHOLDER')`;
 *   returns`'stakeholder_data'`;
 *
 * @param type - The OCF object type
 * @returns The data field name (e.g., 'stakeholder_data', 'issuance_data')
 */
export function getOcfDataFieldName(type: OcfObjectType): string {
  const metadata = getOcfMetadata(type);
  // The first element of ocfIdPath is the data field name
  return metadata.ocfIdPath[0];
}

/**
 * Extract the OCF ID from contract create arguments.
 *
 * Uses the type's metadata to navigate to the ID field.
 *
 * @example
 *   `extractOcfIdFromCreateArgs('STAKEHOLDER',
 *   { stakeholder_data: { id: 'sh-123' } })` returns `'sh-123'`
 *
 * @param type - The OCF object type
 * @param createArgs - The contract's create arguments from a transaction tree
 * @returns The OCF ID string, or undefined if not found
 */
export function extractOcfIdFromCreateArgs(type: OcfObjectType, createArgs: unknown): string | undefined {
  if (!createArgs || typeof createArgs !== 'object') {
    return undefined;
  }

  const metadata = getOcfMetadata(type);
  let current: unknown = createArgs;

  for (const key of metadata.ocfIdPath) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Get human-readable display label for an OCF type.
 *
 * Useful for logging, notifications, and UI display.
 *
 * @example
 *   `getOcfTypeLabel('STAKEHOLDER',
 *   1)` returns `'1 Stakeholder'`, `getOcfTypeLabel('STAKEHOLDER', 5)` returns `'5 Stakeholders'`
 *
 * @param type - The OCF object type
 * @param count - Number of items (for pluralization)
 * @returns Human-readable label
 */
export function getOcfTypeLabel(type: OcfObjectType, count: number): string {
  // Convert type to title case and handle special cases
  const labelMap: Partial<Record<OcfObjectType, { singular: string; plural: string }>> = {
    STOCK_CLASS: { singular: 'Stock Class', plural: 'Stock Classes' },
    STAKEHOLDER: { singular: 'Stakeholder', plural: 'Stakeholders' },
    STOCK_PLAN: { singular: 'Stock Plan', plural: 'Stock Plans' },
    STOCK_LEGEND_TEMPLATE: { singular: 'Stock Legend Template', plural: 'Stock Legend Templates' },
    DOCUMENT: { singular: 'Document', plural: 'Documents' },
    VESTING_TERMS: { singular: 'Vesting Terms', plural: 'Vesting Terms' },
    TX_STOCK_ISSUANCE: { singular: 'Stock Issuance', plural: 'Stock Issuances' },
    TX_WARRANT_ISSUANCE: { singular: 'Warrant Issuance', plural: 'Warrant Issuances' },
    TX_CONVERTIBLE_ISSUANCE: { singular: 'Convertible Issuance', plural: 'Convertible Issuances' },
    TX_STOCK_PLAN_POOL_ADJUSTMENT: { singular: 'Stock Plan Pool Adjustment', plural: 'Stock Plan Pool Adjustments' },
    TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: {
      singular: 'Stock Class Authorized Shares Adjustment',
      plural: 'Stock Class Authorized Shares Adjustments',
    },
    TX_STOCK_CANCELLATION: { singular: 'Stock Cancellation', plural: 'Stock Cancellations' },
    TX_WARRANT_CANCELLATION: { singular: 'Warrant Cancellation', plural: 'Warrant Cancellations' },
    TX_CONVERTIBLE_CANCELLATION: { singular: 'Convertible Cancellation', plural: 'Convertible Cancellations' },
    TX_EQUITY_COMPENSATION_CANCELLATION: {
      singular: 'Equity Compensation Cancellation',
      plural: 'Equity Compensation Cancellations',
    },
    TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: {
      singular: 'Issuer Authorized Shares Adjustment',
      plural: 'Issuer Authorized Shares Adjustments',
    },
    TX_EQUITY_COMPENSATION_ISSUANCE: {
      singular: 'Equity Compensation Issuance',
      plural: 'Equity Compensation Issuances',
    },
    TX_EQUITY_COMPENSATION_EXERCISE: {
      singular: 'Equity Compensation Exercise',
      plural: 'Equity Compensation Exercises',
    },
  };

  const labels = labelMap[type];
  if (labels) {
    const label = count === 1 ? labels.singular : labels.plural;
    return `${count} ${label}`;
  }

  // Fallback: convert type to title case
  const fallback = type
    .replace(/^TX_/, '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return `${count} ${fallback}${count === 1 ? '' : 's'}`;
}

// Re-export types and functions from ocfMetadata for convenience
export { getAllOcfTypes, getOcfMetadata, isValidOcfType, OCF_METADATA, type OcfObjectType };
