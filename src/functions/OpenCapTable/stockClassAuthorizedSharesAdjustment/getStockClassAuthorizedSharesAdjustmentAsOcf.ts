import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';
import { ENTITY_TEMPLATE_ID_MAP } from '../capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type OcfStockClassAuthorizedSharesAdjustmentEvent = OcfStockClassAuthorizedSharesAdjustment;

export type GetStockClassAuthorizedSharesAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockClassAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfStockClassAuthorizedSharesAdjustmentEvent;
  contractId: string;
}

/** Exact generated DAML payload shape without exposing generated package declarations. */
export interface DamlStockClassAuthorizedSharesAdjustmentData {
  id: string;
  date: string;
  new_shares_authorized: string;
  stock_class_id: string;
  comments: string[];
  board_approval_date: string | null;
  stockholder_approval_date: string | null;
}

/**
 * Converts DAML StockClassAuthorizedSharesAdjustment data to native OCF format.
 * Used by both getStockClassAuthorizedSharesAdjustmentAsOcf and the damlToOcf dispatcher.
 */
export function damlStockClassAuthorizedSharesAdjustmentDataToNative(
  data: DamlStockClassAuthorizedSharesAdjustmentData
): OcfStockClassAuthorizedSharesAdjustment {
  return {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockClassAuthorizedSharesAdjustment.date'),
    stock_class_id: data.stock_class_id,
    new_shares_authorized: normalizeNumericString(
      data.new_shares_authorized,
      'stockClassAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    ...(data.board_approval_date !== null
      ? {
          board_approval_date: damlTimeToDateString(
            data.board_approval_date,
            'stockClassAuthorizedSharesAdjustment.board_approval_date'
          ),
        }
      : {}),
    ...(data.stockholder_approval_date !== null
      ? {
          stockholder_approval_date: damlTimeToDateString(
            data.stockholder_approval_date,
            'stockClassAuthorizedSharesAdjustment.stockholder_approval_date'
          ),
        }
      : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}

export async function getStockClassAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassAuthorizedSharesAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassAuthorizedSharesAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockClassAuthorizedSharesAdjustment', createArgument);
  const native = damlStockClassAuthorizedSharesAdjustmentDataToNative(data);

  return { event: native, contractId: params.contractId };
}
