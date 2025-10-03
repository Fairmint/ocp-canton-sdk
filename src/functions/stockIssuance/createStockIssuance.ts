import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { CommandWithDisclosedContracts, OcfStockIssuanceData, StockIssuanceType } from '../../types';
import {
  cleanComments,
  dateStringToDAMLTime,
  monetaryToDaml,
  numberToString,
  optionalString,
} from '../../utils/typeConversions';

export interface CreateStockIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  issuanceData: OcfStockIssuanceData;
}

export function buildCreateStockIssuanceCommand(params: CreateStockIssuanceParams): CommandWithDisclosedContracts {
  const { issuanceData: d } = params;

  if (!d.id) throw new Error('stockIssuance.id is required');
  if (!d.security_id) throw new Error('stockIssuance.security_id is required');
  if (!d.custom_id) throw new Error('stockIssuance.custom_id is required');
  if (!d.stakeholder_id) throw new Error('stockIssuance.stakeholder_id is required');
  if (!d.stock_class_id) throw new Error('stockIssuance.stock_class_id is required');

  const getIssuanceType = (t: StockIssuanceType | undefined) => {
    if (!t) return null;
    switch (t) {
      case 'RSA':
        return 'OcfStockIssuanceRSA';
      case 'FOUNDERS_STOCK':
        return 'OcfStockIssuanceFounders';
      default:
        throw new Error(`Unknown stock issuance type: ${String(t)}`);
    }
  };

  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockIssuance = {
    issuance_data: {
      id: d.id,
      security_id: d.security_id,
      custom_id: d.custom_id,
      stakeholder_id: d.stakeholder_id,
      stock_class_id: d.stock_class_id,
      date: dateStringToDAMLTime(d.date),
      board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
      stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
      consideration_text: optionalString(d.consideration_text),
      security_law_exemptions: (d.security_law_exemptions ?? []).map((e) => ({
        description: e.description,
        jurisdiction: e.jurisdiction,
      })),
      stock_plan_id: d.stock_plan_id ?? null,
      share_numbers_issued: (d.share_numbers_issued ?? [])
        .filter((range) => !(range.starting_share_number === '0' && range.ending_share_number === '0'))
        .map((r) => ({
          starting_share_number: numberToString(r.starting_share_number),
          ending_share_number: numberToString(r.ending_share_number),
        })),
      share_price: monetaryToDaml(d.share_price),
      quantity: numberToString(d.quantity),
      vesting_terms_id: d.vesting_terms_id ?? null,
      vestings: (d.vestings ?? [])
        .filter((v) => Number(v.amount) > 0)
        .map((v) => ({
          date: dateStringToDAMLTime(v.date),
          amount: numberToString(v.amount),
        })),
      cost_basis: d.cost_basis ? monetaryToDaml(d.cost_basis) : null,
      stock_legend_ids: d.stock_legend_ids ?? [],
      issuance_type: getIssuanceType(d.issuance_type),
      comments: cleanComments(d.comments),
    },
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockIssuance',
      choiceArgument: choiceArguments,
    },
  };

  const disclosedContracts: DisclosedContract[] = [params.featuredAppRightContractDetails];

  return { command, disclosedContracts };
}
