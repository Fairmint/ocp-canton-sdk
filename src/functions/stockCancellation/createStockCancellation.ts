import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { dateStringToDAMLTime, cleanComments } from '../../utils/typeConversions';
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

interface IssuerCreateArgShape {
  context?: { system_operator?: string };
}

export function buildCreateStockCancellationCommand(
  params: CreateStockCancellationParams
): CommandWithDisclosedContracts {
  const d = params.cancellationData;
  cleanComments(d);
  const cancellation_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    balance_security_id: d.balance_security_id ?? null,
    reason_text: d.reason_text,
    comments: d.comments || [],
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockCancellation = {
    cancellation_data,
  } as any;
  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockCancellation',
      choiceArgument: choiceArguments as any,
    },
  };
  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId,
    },
  ];
  return { command, disclosedContracts };
}
