import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlanPoolAdjustment } from '../../../types/native';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { canonicalizeAdministrativeAdjustmentNumeric } from '../capTable/administrativeAdjustmentValidation';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type GetStockPlanPoolAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockPlanPoolAdjustmentAsOcfResult {
  event: OcfStockPlanPoolAdjustment;
  contractId: string;
}

export type DamlStockPlanPoolAdjustmentData = DamlDataTypeFor<'stockPlanPoolAdjustment'>;

/** Convert exact generated StockPlanPoolAdjustment data to native OCF. */
export function damlStockPlanPoolAdjustmentDataToNative(
  input: DamlStockPlanPoolAdjustmentData
): OcfStockPlanPoolAdjustment {
  const data = decodeDamlEntityData('stockPlanPoolAdjustment', input);
  const boardApprovalDate = optionalDamlTimeToDateString(
    data.board_approval_date,
    'stockPlanPoolAdjustment.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    data.stockholder_approval_date,
    'stockPlanPoolAdjustment.stockholder_approval_date'
  );

  return {
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockPlanPoolAdjustment.date'),
    stock_plan_id: data.stock_plan_id,
    shares_reserved: canonicalizeAdministrativeAdjustmentNumeric(
      data.shares_reserved,
      'stockPlanPoolAdjustment.shares_reserved'
    ),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}

export async function getStockPlanPoolAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockPlanPoolAdjustmentAsOcfParams
): Promise<GetStockPlanPoolAdjustmentAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockPlanPoolAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockPlanPoolAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockPlanPoolAdjustment', createArgument);
  const event = damlStockPlanPoolAdjustmentDataToNative(data);
  return { event, contractId };
}
