import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, StockClassOcfData } from '../../../types';
import { buildCapTableCommand } from '../capTable';
import { stockClassDataToDaml } from './stockClassDataToDaml';

export interface EditStockClassParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  stockClassId: string;
  stockClassData: StockClassOcfData;
}

export function buildEditStockClassCommand(params: EditStockClassParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'EditStockClass',
    choiceArgument: {
      id: params.stockClassId,
      new_stock_class_data: stockClassDataToDaml(params.stockClassData),
    },
  });
}
