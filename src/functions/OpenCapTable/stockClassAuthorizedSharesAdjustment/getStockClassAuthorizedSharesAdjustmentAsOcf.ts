import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { GetByContractIdParams } from '../../../types/common';
import type { OcfStockClassAuthorizedSharesAdjustment } from '../../../types/native';
import { damlTimeToDateString, optionalDamlTimeToDateString } from '../../../utils/typeConversions';
import { canonicalizeAdministrativeAdjustmentNumeric } from '../capTable/administrativeAdjustmentValidation';
import { ENTITY_TEMPLATE_ID_MAP, type DamlDataTypeFor } from '../capTable/batchTypes';
import { decodeDamlEntityData, extractAndDecodeDamlEntityData } from '../capTable/damlEntityData';
import { readSingleContract } from '../shared/singleContractRead';

export type OcfStockClassAuthorizedSharesAdjustmentEvent = OcfStockClassAuthorizedSharesAdjustment;
export type GetStockClassAuthorizedSharesAdjustmentAsOcfParams = GetByContractIdParams;
export interface GetStockClassAuthorizedSharesAdjustmentAsOcfResult {
  event: OcfStockClassAuthorizedSharesAdjustmentEvent;
  contractId: string;
}

export type DamlStockClassAuthorizedSharesAdjustmentData = DamlDataTypeFor<'stockClassAuthorizedSharesAdjustment'>;

/** Convert exact generated StockClassAuthorizedSharesAdjustment data to native OCF. */
export function damlStockClassAuthorizedSharesAdjustmentDataToNative(
  input: DamlStockClassAuthorizedSharesAdjustmentData
): OcfStockClassAuthorizedSharesAdjustment {
  const data = decodeDamlEntityData('stockClassAuthorizedSharesAdjustment', input);
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
    new_shares_authorized: canonicalizeAdministrativeAdjustmentNumeric(
      data.new_shares_authorized,
      'stockClassAuthorizedSharesAdjustment.new_shares_authorized'
    ),
    ...(boardApprovalDate !== undefined ? { board_approval_date: boardApprovalDate } : {}),
    ...(stockholderApprovalDate !== undefined ? { stockholder_approval_date: stockholderApprovalDate } : {}),
    ...(data.comments.length > 0 ? { comments: data.comments } : {}),
  };
}

export async function getStockClassAuthorizedSharesAdjustmentAsOcf(
  client: LedgerJsonApiClient,
  params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
): Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult> {
  const { contractId, createArgument } = await readSingleContract(client, params, {
    operation: 'getStockClassAuthorizedSharesAdjustmentAsOcf',
    expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stockClassAuthorizedSharesAdjustment,
  });
  const data = extractAndDecodeDamlEntityData('stockClassAuthorizedSharesAdjustment', createArgument);
  const event = damlStockClassAuthorizedSharesAdjustmentDataToNative(data);
  return { event, contractId };
}
