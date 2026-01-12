import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteStockPlanPoolAdjustmentParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  stockPlanPoolAdjustmentId: string;
}

export function buildDeleteStockPlanPoolAdjustmentCommand(
  params: DeleteStockPlanPoolAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteStockPlanPoolAdjustment',
    choiceArgument: {
      id: params.stockPlanPoolAdjustmentId,
    },
  });
}
