import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlanPoolAdjustment } from '../../../types/native';
import { readSingleContract } from '../shared/singleContractRead';
import { normalizeNumericString } from '../../../utils/typeConversions';

export interface GetStockPlanPoolAdjustmentAsOcfParams extends GetByContractIdParams {}
export interface GetStockPlanPoolAdjustmentAsOcfResult {
  event: OcfStockPlanPoolAdjustment & { object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT' };
  contractId: string;
}

/** Type alias for DAML StockPlanPoolAdjustment contract createArgument */
type StockPlanPoolAdjustmentCreateArgument = Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment;

/** Type alias for DAML StockPlanPoolAdjustment OCF data */
type StockPlanPoolAdjustmentOcfData = Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData;

/**
 * Converts DAML StockPlanPoolAdjustment data to native OCF format.
 * Used by the dispatcher pattern in damlToOcf.ts.
 */
export function damlStockPlanPoolAdjustmentDataToNative(
  data: StockPlanPoolAdjustmentOcfData
): OcfStockPlanPoolAdjustment {
  // Convert shares_reserved to string for normalization (DAML Numeric may come as number at runtime)
  const sharesReserved = data.shares_reserved as string | number;
  const sharesReservedStr = typeof sharesReserved === 'number' ? sharesReserved.toString() : sharesReserved;

  return {
    id: data.id,
    date: data.date.split('T')[0],
    stock_plan_id: data.stock_plan_id,
    shares_reserved: normalizeNumericString(sharesReservedStr),
    ...(data.board_approval_date ? { board_approval_date: data.board_approval_date.split('T')[0] } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: data.stockholder_approval_date.split('T')[0] }
      : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
}

export async function getStockPlanPoolAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentAsOcfParams
): Promise<GetStockPlanPoolAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockPlanPoolAdjustmentAsOcf',
    expectedTemplateId: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
  });
  const contract = createArgument as StockPlanPoolAdjustmentCreateArgument;

  const native = damlStockPlanPoolAdjustmentDataToNative(contract.adjustment_data);
  // Add object_type to create the full event type
  const event = {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT' as const,
    ...native,
  };
  return { event, contractId: params.contractId };
}
