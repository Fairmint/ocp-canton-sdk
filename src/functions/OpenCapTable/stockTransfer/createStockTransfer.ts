import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockTransferTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockTransferDataToDaml(d: OcfStockTransferTxData): Record<string, unknown> {
  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new Error('resulting_security_ids must contain at least one element');
  }
  return {
    id: d.id,
    security_id: d.security_id,
    date: dateStringToDAMLTime(d.date),
    quantity: numberToString(d.quantity),
    resulting_security_ids: d.resulting_security_ids,
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

/** @deprecated Use AddStockTransferParams and buildAddStockTransferCommand instead. */
export interface CreateStockTransferParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  transferData: OcfStockTransferTxData;
}

/** @deprecated Use buildAddStockTransferCommand instead. */
export function buildCreateStockTransferCommand(params: CreateStockTransferParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockTransfer',
    choiceArgument: {
      transfer_data: stockTransferDataToDaml(params.transferData),
    },
  });
}
