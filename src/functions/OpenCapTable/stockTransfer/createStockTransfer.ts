import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfStockTransferTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

export interface CreateStockTransferParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  transferData: OcfStockTransferTxData;
}

export function buildCreateStockTransferCommand(params: CreateStockTransferParams): CommandWithDisclosedContracts {
  const { transferData: d } = params;

  // Validate required array field
  if (d.resulting_security_ids.length === 0) {
    throw new Error('resulting_security_ids must contain at least one element');
  }

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockTransfer = {
    transfer_data: {
      id: d.id,
      security_id: d.security_id,
      date: dateStringToDAMLTime(d.date),
      quantity: numberToString(d.quantity),
      resulting_security_ids: d.resulting_security_ids,
      balance_security_id: optionalString(d.balance_security_id),
      consideration_text: optionalString(d.consideration_text),
      comments: cleanComments(d.comments),
    },
  };
  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockTransfer',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
