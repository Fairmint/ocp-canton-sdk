import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockPlanPoolAdjustmentTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockPlanPoolAdjustmentDataToDaml(d: OcfStockPlanPoolAdjustmentTxData): Record<string, unknown> {
  return {
    id: d.id,
    stock_plan_id: d.stock_plan_id,
    date: dateStringToDAMLTime(d.date),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    shares_reserved: numberToString(d.shares_reserved),
    comments: cleanComments(d.comments),
  };
}

/** @deprecated Use AddStockPlanPoolAdjustmentParams and buildAddStockPlanPoolAdjustmentCommand instead. */
export interface CreateStockPlanPoolAdjustmentParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: OcfStockPlanPoolAdjustmentTxData;
}

/** @deprecated Use buildAddStockPlanPoolAdjustmentCommand instead. */
export function buildCreateStockPlanPoolAdjustmentCommand(
  params: CreateStockPlanPoolAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockPlanPoolAdjustment',
    choiceArgument: {
      adjustment_data: stockPlanPoolAdjustmentDataToDaml(params.adjustmentData),
    },
  });
}
