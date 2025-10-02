import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { cleanComments, dateStringToDAMLTime } from '../../utils/typeConversions';
import type { CommandWithDisclosedContracts, OcfStockPlanData, StockPlanCancellationBehavior } from '../../types';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

function cancellationBehaviorToDaml(
  b: StockPlanCancellationBehavior | undefined
): Fairmint.OpenCapTable.StockPlan.OcfStockPlanData['default_cancellation_behavior'] {
  if (!b) return null;
  switch (b) {
    case 'RETIRE':
      return 'OcfPlanCancelRetire';
    case 'RETURN_TO_POOL':
      return 'OcfPlanCancelReturnToPool';
    case 'HOLD_AS_CAPITAL_STOCK':
      return 'OcfPlanCancelHoldAsCapitalStock';
    case 'DEFINED_PER_PLAN_SECURITY':
      return 'OcfPlanCancelDefinedPerPlanSecurity';
    default:
      throw new Error('Unknown cancellation behavior');
  }
}

function stockPlanDataToDaml(d: OcfStockPlanData): Fairmint.OpenCapTable.StockPlan.OcfStockPlanData {
  if (!d.id) throw new Error('stockPlan.id is required');
  return {
    id: d.id,
    plan_name: d.plan_name,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    initial_shares_reserved:
      typeof d.initial_shares_reserved === 'number' ? d.initial_shares_reserved.toString() : d.initial_shares_reserved,
    default_cancellation_behavior: cancellationBehaviorToDaml(d.default_cancellation_behavior),
    stock_class_ids: d.stock_class_ids,
    comments: cleanComments(d.comments),
  };
}

export interface CreateStockPlanParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  planData: OcfStockPlanData;
}

export function buildCreateStockPlanCommand(params: CreateStockPlanParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockPlan = {
    plan_data: stockPlanDataToDaml(params.planData),
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockPlan',
      choiceArgument: choiceArguments,
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
