import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteStockIssuanceParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  stockIssuanceId: string;
}

export function buildDeleteStockIssuanceCommand(params: DeleteStockIssuanceParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteStockIssuance',
    choiceArgument: {
      id: params.stockIssuanceId,
    },
  });
}
