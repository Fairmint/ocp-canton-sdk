import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { GetByContractIdParams } from '../../../types/common';
import type { PkgStockClassAuthorizedSharesAdjustmentOcfData } from '../../../types/daml';
import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types/native';
import {
  damlTimeToDateString,
  normalizeNumericString,
  optionalDamlTimeToDateString,
} from '../../../utils/typeConversions';
import { readSingleContract } from '../shared/singleContractRead';

export type OcfStockClassAuthorizedSharesAdjustmentEvent = OcfStockClassAuthorizedSharesAdjustment;

export interface GetStockClassAuthorizedSharesAdjustmentAsOcfParams extends GetByContractIdParams {}
export interface GetStockClassAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfStockClassAuthorizedSharesAdjustmentEvent;
  contractId: string;
}

/** Type alias for DAML StockClassAuthorizedSharesAdjustment contract createArgument */
type StockClassAuthorizedSharesAdjustmentCreateArgument =
  Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment;

/**
 * Converts DAML StockClassAuthorizedSharesAdjustment data to native OCF format.
 * Used by both getStockClassAuthorizedSharesAdjustmentAsOcf and the damlToOcf dispatcher.
 */
export function damlStockClassAuthorizedSharesAdjustmentDataToNative(
  data: PkgStockClassAuthorizedSharesAdjustmentOcfData
): OcfStockClassAuthorizedSharesAdjustment {
  // Convert new_shares_authorized to string for normalization (DAML Numeric may come as number at runtime)
  const newSharesAuthorized = data.new_shares_authorized as string | number;
  const newSharesAuthorizedStr =
    typeof newSharesAuthorized === 'number' ? newSharesAuthorized.toString() : newSharesAuthorized;

  const boardApprovalDate = optionalDamlTimeToDateString(
    data.board_approval_date,
    'stockClassAuthorizedSharesAdjustment.board_approval_date'
  );
  const stockholderApprovalDate = optionalDamlTimeToDateString(
    data.stockholder_approval_date,
    'stockClassAuthorizedSharesAdjustment.stockholder_approval_date'
  );

  return {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    id: data.id,
    date: damlTimeToDateString(data.date, 'stockClassAuthorizedSharesAdjustment.date'),
    stock_class_id: data.stock_class_id,
    new_shares_authorized: normalizeNumericString(newSharesAuthorizedStr),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
}

export async function getStockClassAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult> {
  const { createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassAuthorizedSharesAdjustmentAsOcf',
    expectedTemplateId:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
  });
  const contract = createArgument as StockClassAuthorizedSharesAdjustmentCreateArgument;
  const native = damlStockClassAuthorizedSharesAdjustmentDataToNative(contract.adjustment_data);

  return { event: native, contractId: params.contractId };
}
