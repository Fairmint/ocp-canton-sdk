import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockClass } from '../../../types';
import { buildCapTableCommand } from '../capTable';
import { stockClassDataToDaml } from './stockClassDataToDaml';

export interface CreateStockClassParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  stockClassData: OcfStockClass;
}

export function buildCreateStockClassCommand(params: CreateStockClassParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'CreateStockClass',
    choiceArgument: {
      stock_class_data: stockClassDataToDaml(params.stockClassData),
    },
  });
}
