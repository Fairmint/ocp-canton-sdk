import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteStockClassAuthorizedSharesAdjustmentParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  stockClassAuthorizedSharesAdjustmentId: string;
}

export function buildDeleteStockClassAuthorizedSharesAdjustmentCommand(
  params: DeleteStockClassAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteStockClassAuthorizedSharesAdjustment',
    choiceArgument: {
      id: params.stockClassAuthorizedSharesAdjustmentId,
    },
  });
}
