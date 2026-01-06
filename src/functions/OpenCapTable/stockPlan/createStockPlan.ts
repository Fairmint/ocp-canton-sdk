import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, StockPlanCancellationBehavior, StockPlanOcfData } from '../../../types';
import { cleanComments, dateStringToDAMLTime } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

function cancellationBehaviorToDaml(
  b: StockPlanCancellationBehavior | undefined
): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData['default_cancellation_behavior'] {
  if (!b) return null;
  switch (b) {
    case 'RETIRE':
      return 'OcfPlanCancelRetire';
    case 'RETURN_TO_POOL':
      return 'OcfPlanCancelReturnToPool';
    case 'HOLD_AS_CAPITAL_STOCK':
      return 'OcfPlanCancelHoldAsCapitalStock';
    case 'DEFINED_PER_PLAN_SECURITY':
      return 'OcfPlanCancelDefinedPerPlanSecurity';
    default:
      throw new Error('Unknown cancellation behavior');
  }
}

export function stockPlanDataToDaml(d: StockPlanOcfData): Fairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData {
  if (!d.id) throw new Error('stockPlan.id is required');
  return {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved:
      typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: d.stock_class_ids,
    comments: cleanComments(d.comments),
  };
}

/** @deprecated Use AddStockPlanParams and buildAddStockPlanCommand instead. */
export interface CreateStockPlanParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  planData: StockPlanOcfData;
}

/** @deprecated Use buildAddStockPlanCommand instead. */
export function buildCreateStockPlanCommand(params: CreateStockPlanParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockPlan',
    choiceArgument: {
      plan_data: stockPlanDataToDaml(params.planData),
    },
  });
}
