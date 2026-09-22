export const STOCK_CLASS_CONVERSION_STORAGE_DESCRIPTION = 'OCF stock-class conversion storage adapter';

/**
 * Description written into the storage-only sentinel by <= 0.8.14 writers
 * (stockClassDataToDaml buildStockClassTrigger).
 */
export const LEGACY_STOCK_CLASS_CONVERSION_STORAGE_DESCRIPTION = 'Stock class conversion';

/** Canonical storage-only trigger id written by >= 0.8.15 writers. */
export function stockClassConversionStorageTriggerId(stockClassId: string, index: number): string {
  return `ocp-sdk:stock-class:${stockClassId}:conversion-right:${index}:unspecified`;
}

/**
 * Legacy storage-only trigger id written by <= 0.8.14 writers when the OCF input
 * carried no conversion_trigger.
 */
export function legacyStockClassConversionStorageTriggerIdWithoutOcfTrigger(
  stockClassId: string,
  index: number
): string {
  return `default-${stockClassId}-${index}`;
}

/**
 * Legacy storage-only trigger id written by <= 0.8.14 writers when the OCF input
 * carried a conversion_trigger.
 */
export function legacyStockClassConversionStorageTriggerIdWithOcfTrigger(stockClassId: string, index: number): string {
  return `${stockClassId}-trigger-${index}`;
}
