import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, StockClassOcfData } from '../../../types';
import { buildCapTableCommand } from '../capTable';
import { stockClassDataToDaml } from './stockClassDataToDaml';

/**
 * @deprecated Use AddStockClassParams and buildAddStockClassCommand instead. This interface uses the legacy
 *   issuerContractId parameter which has been replaced with capTableContractId.
 */
export interface CreateStockClassParams {
  /**
   * @deprecated This parameter is renamed to capTableContractId. Contract ID of the CapTable contract (previously
   *   Issuer contract).
   */
  issuerContractId: string;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  /** The party that will act as the issuer */
  issuerParty: string;
  /**
   * Stock class data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/StockClass.schema.json
   */
  stockClassData: StockClassOcfData;
}

/**
 * @deprecated Use buildAddStockClassCommand instead. This function now uses the CapTable contract pattern internally.
 *   The issuerContractId parameter is now treated as capTableContractId.
 */
export function buildCreateStockClassCommand(params: CreateStockClassParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockClass',
    choiceArgument: {
      stock_class_data: stockClassDataToDaml(params.stockClassData),
    },
  });
}
