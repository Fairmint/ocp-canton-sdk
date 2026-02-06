import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes } from '../../../errors';
import type { PkgStockClassAuthorizedSharesAdjustmentOcfData } from '../../../types/daml';
import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types/native';
import { damlTimeToDateString, normalizeNumericString } from '../../../utils/typeConversions';

export interface OcfStockClassAuthorizedSharesAdjustmentEvent {
  object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT';
  id: string;
  date: string;
  stock_class_id: string;
  new_shares_authorized: string;
  board_approval_date?: string;
  stockholder_approval_date?: string;
  comments?: string[];
}

export interface GetStockClassAuthorizedSharesAdjustmentAsOcfParams {
  contractId: string;
}
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

  return {
    id: data.id,
    date: damlTimeToDateString(data.date),
    stock_class_id: data.stock_class_id,
    new_shares_authorized: normalizeNumericString(newSharesAuthorizedStr),
    ...(data.board_approval_date ? { board_approval_date: damlTimeToDateString(data.board_approval_date) } : {}),
    ...(data.stockholder_approval_date
      ? { stockholder_approval_date: damlTimeToDateString(data.stockholder_approval_date) }
      : {}),
    ...(Array.isArray(data.comments) && data.comments.length ? { comments: data.comments } : {}),
  };
}

export async function getStockClassAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult> {
  const res = await client.getEventsByContractId({ contractId: params.contractId });
  if (!res.created?.createdEvent.createArgument) {
    throw new OcpContractError('Missing createArgument', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }
  const contract = res.created.createdEvent.createArgument as StockClassAuthorizedSharesAdjustmentCreateArgument;
  const native = damlStockClassAuthorizedSharesAdjustmentDataToNative(contract.adjustment_data);

  const event: OcfStockClassAuthorizedSharesAdjustmentEvent = {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    ...native,
  };
  return { event, contractId: params.contractId };
}
