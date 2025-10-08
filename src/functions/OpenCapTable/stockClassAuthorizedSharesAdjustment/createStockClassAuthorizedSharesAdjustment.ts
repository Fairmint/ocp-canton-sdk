import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfStockClassAuthorizedSharesAdjustmentTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';

export interface CreateStockClassAuthorizedSharesAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: OcfStockClassAuthorizedSharesAdjustmentTxData;
}

export function buildCreateStockClassAuthorizedSharesAdjustmentCommand(
  params: CreateStockClassAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  const { adjustmentData: d } = params;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockClassAuthorizedSharesAdjustment = {
    adjustment_data: {
      id: d.id,
      stock_class_id: d.stock_class_id,
      date: dateStringToDAMLTime(d.date),
      new_shares_authorized: numberToString(d.new_shares_authorized),
      board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
      stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
      comments: cleanComments(d.comments),
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockClassAuthorizedSharesAdjustment',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
