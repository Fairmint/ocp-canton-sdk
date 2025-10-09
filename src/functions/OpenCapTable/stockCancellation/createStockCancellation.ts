import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfStockCancellationTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString, optionalString } from '../../../utils/typeConversions';

export interface CreateStockCancellationParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  cancellationData: OcfStockCancellationTxData;
}

export function buildCreateStockCancellationCommand(
  params: CreateStockCancellationParams
): CommandWithDisclosedContracts {
  const { cancellationData: d } = params;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockCancellation = {
    cancellation_data: {
      id: d.id,
      security_id: d.security_id,
      reason_text: d.reason_text,
      date: dateStringToDAMLTime(d.date),
      quantity: numberToString(d.quantity),
      balance_security_id: optionalString(d.balance_security_id),
      comments: cleanComments(d.comments),
    },
  };
  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockCancellation',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
