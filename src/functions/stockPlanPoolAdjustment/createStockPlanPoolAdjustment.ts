import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts, OcfStockPlanPoolAdjustmentTxData } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateStockPlanPoolAdjustmentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: OcfStockPlanPoolAdjustmentTxData;
}

export function buildCreateStockPlanPoolAdjustmentCommand(
  params: CreateStockPlanPoolAdjustmentParams
): CommandWithDisclosedContracts {
  const { adjustmentData: d } = params;

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlanPoolAdjustment = {
    adjustment_data: {
      id: d.id,
      stock_plan_id: d.stock_plan_id,
      date: dateStringToDAMLTime(d.date),
      board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
      stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
      shares_reserved: numberToString(d.shares_reserved),
      comments: cleanComments(d.comments),
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockPlanPoolAdjustment',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
