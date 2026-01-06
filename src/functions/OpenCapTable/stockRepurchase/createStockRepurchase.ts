import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfStockRepurchaseTxData } from '../../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function stockRepurchaseDataToDaml(d: OcfStockRepurchaseTxData): Record<string, unknown> {
  // Validate required fields
  if (!d.id) {
    throw new Error('repurchaseData.id is required');
  }
  if (!d.date) {
    throw new Error('repurchaseData.date is required');
  }
  if (!d.security_id) {
    throw new Error('repurchaseData.security_id is required');
  }

  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: numberToString(d.quantity),
    price: monetaryToDaml(d.price),
    balance_security_id: optionalString(d.balance_security_id),
    consideration_text: optionalString(d.consideration_text),
    comments: cleanComments(d.comments),
  };
}

/** @deprecated Use AddStockRepurchaseParams and buildAddStockRepurchaseCommand instead. */
export interface CreateStockRepurchaseParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  repurchaseData: OcfStockRepurchaseTxData;
}

/** @deprecated Use buildAddStockRepurchaseCommand instead. */
export function buildCreateStockRepurchaseCommand(params: CreateStockRepurchaseParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateStockRepurchase',
    choiceArgument: {
      repurchase_data: stockRepurchaseDataToDaml(params.repurchaseData),
    },
  });
}
