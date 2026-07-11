export const STOCK_CLASS_CONVERSION_STORAGE_DESCRIPTION = 'OCF stock-class conversion storage adapter';

export function stockClassConversionStorageTriggerId(stockClassId: string, index: number): string {
  return `ocp-sdk:stock-class:${stockClassId}:conversion-right:${index}:unspecified`;
}
