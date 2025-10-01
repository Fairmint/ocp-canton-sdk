import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { CommandWithDisclosedContracts } from '../../types';
import { dateStringToDAMLTime } from '../../utils/typeConversions';

export interface CreateStockClassAuthorizedSharesAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: {
    id: string;
    date: string;
    stock_class_id: string;
    new_shares_authorized: string | number;
    board_approval_date?: string;
    stockholder_approval_date?: string;
    comments?: string[];
  };
}

interface IssuerCreateArgShape { context?: { system_operator?: string } }

export function buildCreateStockClassAuthorizedSharesAdjustmentCommand(params: CreateStockClassAuthorizedSharesAdjustmentParams): CommandWithDisclosedContracts {
  const d = params.adjustmentData;
  const adjustment_data: any = {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    stock_class_id: d.stock_class_id,
    new_shares_authorized: typeof d.new_shares_authorized === 'number' ? d.new_shares_authorized.toString() : d.new_shares_authorized,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: d.comments || []
  } as any;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClassAuthorizedSharesAdjustment = { adjustment_data } as any;
  const command: Command = { ExerciseCommand: { templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId, contractId: params.issuerContractId, choice: 'CreateStockClassAuthorizedSharesAdjustment', choiceArgument: choiceArguments as any } };
  const disclosedContracts: DisclosedContract[] = [ { templateId: params.featuredAppRightContractDetails.templateId, contractId: params.featuredAppRightContractDetails.contractId, createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob, synchronizerId: params.featuredAppRightContractDetails.synchronizerId } ];
  return { command, disclosedContracts };
}


