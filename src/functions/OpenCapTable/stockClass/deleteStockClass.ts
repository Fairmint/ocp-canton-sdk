import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteStockClassParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  stockClassId: string;
}

export function buildDeleteStockClassCommand(params: DeleteStockClassParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'DeleteStockClass',
    choiceArgument: {
      id: params.stockClassId,
    },
  });
}
