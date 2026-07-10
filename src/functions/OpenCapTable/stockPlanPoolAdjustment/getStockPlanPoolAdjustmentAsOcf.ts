import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlanPoolAdjustment } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type GetStockPlanPoolAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockPlanPoolAdjustmentAsOcfResult {
  event: OcfStockPlanPoolAdjustment;
  contractId: string;
}

/** Exact generated DAML payload shape without exposing generated package declarations. */
export interface DamlStockPlanPoolAdjustmentData {
  id: string;
  date: string;
  shares_reserved: string;
  stock_plan_id: string;
  comments: string[];
  board_approval_date: string | null;
  stockholder_approval_date: string | null;
}

/**
 * Converts DAML StockPlanPoolAdjustment data to native OCF format.
 * Used by the dispatcher pattern in damlToOcf.ts.
 */
export function damlStockPlanPoolAdjustmentDataToNative(
  data: DamlStockPlanPoolAdjustmentData
): OcfStockPlanPoolAdjustment {
  return {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockPlanPoolAdjustment.date'),
    stock_plan_id: data.stock_plan_id,
    shares_reserved: normalizeNumericString(data.shares_reserved, 'stockPlanPoolAdjustment.shares_reserved'),
    ...(data.board_approval_date !== null
      ? {
          board_approval_date: damlTimeToDateString(
            data.board_approval_date,
            'stockPlanPoolAdjustment.board_approval_date'
          ),
        }
      : {}),
    ...(data.stockholder_approval_date !== null
      ? {
          stockholder_approval_date: damlTimeToDateString(
            data.stockholder_approval_date,
            'stockPlanPoolAdjustment.stockholder_approval_date'
          ),
        }
      : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}

export async function getStockPlanPoolAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentAsOcfParams
): Promise<GetStockPlanPoolAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockPlanPoolAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockPlanPoolAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockPlanPoolAdjustment', createArgument);
  const native = damlStockPlanPoolAdjustmentDataToNative(data);
  return { event: native, contractId: params.contractId };
}
