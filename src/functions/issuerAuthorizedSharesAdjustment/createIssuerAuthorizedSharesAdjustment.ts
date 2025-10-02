import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { dateStringToDAMLTime, cleanComments } from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateIssuerAuthorizedSharesAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: {
    id: string;
    date: string;
    issuer_id: string;
    new_shares_authorized: string | number;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    comments?: string[];
  };
}

interface IssuerCreateArgShape {
  context?: { system_operator?: string };
}

export function buildCreateIssuerAuthorizedSharesAdjustmentCommand(
  params: CreateIssuerAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  const d = params.adjustmentData;
  cleanComments(d);
  const adjustment_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    issuer_id: d.issuer_id,
    new_shares_authorized:
      typeof d.new_shares_authorized === 'number'
        ? d.new_shares_authorized.toString()
        : d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date
      ? dateStringToDAMLTime(d.stockholder_approval_date)
      : null,
    comments: d.comments || [],
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateIssuerAuthorizedSharesAdjustment = {
    adjustment_data,
  } as any;
  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateIssuerAuthorizedSharesAdjustment',
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
