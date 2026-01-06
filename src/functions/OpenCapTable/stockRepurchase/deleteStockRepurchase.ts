import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteStockRepurchaseParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  stockRepurchaseId: string;
}

export function buildDeleteStockRepurchaseCommand(params: DeleteStockRepurchaseParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'DeleteStockRepurchase',
    choiceArgument: {
      id: params.stockRepurchaseId,
    },
  });
}
