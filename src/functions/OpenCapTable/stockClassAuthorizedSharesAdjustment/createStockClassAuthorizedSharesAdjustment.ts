import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockClassAuthorizedSharesAdjustmentTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockClassAuthorizedSharesAdjustmentDataToDaml(
  d: OcfStockClassAuthorizedSharesAdjustmentTxData
): Record<string, unknown> {
  return {
    id: d.id,
    stock_class_id: d.stock_class_id,
    date: dateStringToDAMLTime(d.date),
    new_shares_authorized: numberToString(d.new_shares_authorized),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}

/**
 * @deprecated Use AddStockClassAuthorizedSharesAdjustmentParams and buildAddStockClassAuthorizedSharesAdjustmentCommand
 *   instead.
 */
export interface CreateStockClassAuthorizedSharesAdjustmentParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: OcfStockClassAuthorizedSharesAdjustmentTxData;
}

/** @deprecated Use buildAddStockClassAuthorizedSharesAdjustmentCommand instead. */
export function buildCreateStockClassAuthorizedSharesAdjustmentCommand(
  params: CreateStockClassAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockClassAuthorizedSharesAdjustment',
    choiceArgument: {
      adjustment_data: stockClassAuthorizedSharesAdjustmentDataToDaml(params.adjustmentData),
    },
  });
}
