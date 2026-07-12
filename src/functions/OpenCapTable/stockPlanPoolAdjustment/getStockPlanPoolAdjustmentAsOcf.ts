import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockPlanPoolAdjustmentOutput } from '../../../types/output';
import { canonicalizeAdministrativeAdjustmentReadNumeric } from '../capTable/administrativeAdjustmentValidation';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import {
  decodeDamlEntityData,
  extractAndDecodeDamlEntityData,
  type ReadonlyDamlDataTypeFor,
} from '../capTable/damlEntityData';
import { generatedDamlTimeToDateString, optionalGeneratedDamlTimeToDateString } from '../shared/generatedDamlValues';
import { readSingleContract } from '../shared/singleContractRead';

export type GetStockPlanPoolAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockPlanPoolAdjustmentAsOcfResult {
  readonly event: OcfStockPlanPoolAdjustmentOutput;
  readonly contractId: string;
}

export type DamlStockPlanPoolAdjustmentData = ReadonlyDamlDataTypeFor<'stockPlanPoolAdjustment'>;

/** Convert exact generated StockPlanPoolAdjustment data to native OCF. */
export function damlStockPlanPoolAdjustmentDataToNative(
  input: DamlStockPlanPoolAdjustmentData
): OcfStockPlanPoolAdjustmentOutput {
  const data = decodeDamlEntityData('stockPlanPoolAdjustment', input);
  const boardApprovalDate = optionalGeneratedDamlTimeToDateString(
    data.board_approval_date,
    'stockPlanPoolAdjustment.board_approval_date'
  );
  const stockholderApprovalDate = optionalGeneratedDamlTimeToDateString(
    data.stockholder_approval_date,
    'stockPlanPoolAdjustment.stockholder_approval_date'
  );

  return Object.freeze({
    object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
    id: data.id,
    date: generatedDamlTimeToDateString(data.date, 'stockPlanPoolAdjustment.date'),
    stock_plan_id: data.stock_plan_id,
    shares_reserved: canonicalizeAdministrativeAdjustmentReadNumeric(
      data.shares_reserved,
      'stockPlanPoolAdjustment.shares_reserved'
    ),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(data.comments.length > 0 ? { comments: Object.freeze([...data.comments]) } : {}),
  });
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
  return Object.freeze({ event, contractId });
}
