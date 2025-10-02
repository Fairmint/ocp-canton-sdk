import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { dateStringToDAMLTime, cleanComments, numberToString } from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateStockCancellationParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  cancellationData: {
    id: string;
    date: string;
    security_id: string;
    quantity: string | number;
    balance_security_id?: string;
    reason_text: string;
    comments?: string[];
  };
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
      balance_security_id: d.balance_security_id ?? null,
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
