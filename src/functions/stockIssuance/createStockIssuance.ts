import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfStockIssuanceData, CommandWithDisclosedContracts, SecurityExemption, ShareNumberRange, StockIssuanceType } from '../../types';
import { dateStringToDAMLTime, monetaryToDaml } from '../../utils/typeConversions';

function securityExemptionToDaml(e: SecurityExemption): Fairmint.OpenCapTable.Types.OcfSecurityExemption {
  return {
    description: e.description,
    jurisdiction: e.jurisdiction
  };
}

function shareNumberRangeToDaml(r: ShareNumberRange): Fairmint.OpenCapTable.Types.OcfShareNumberRange {
  return {
    starting_share_number: typeof r.starting_share_number === 'number' ? r.starting_share_number.toString() : r.starting_share_number,
    ending_share_number: typeof r.ending_share_number === 'number' ? r.ending_share_number.toString() : r.ending_share_number
  };
}

function stockIssuanceTypeToDaml(t: StockIssuanceType | undefined): any {
  if (!t) return null;
  switch (t) {
    case 'RSA': return 'OcfStockIssuanceRSA';
    case 'FOUNDERS_STOCK': return 'OcfStockIssuanceFounders';
    default: throw new Error(`Unknown stock issuance type: ${t}`);
  }
}

function stockIssuanceDataToDaml(d: OcfStockIssuanceData): Fairmint.OpenCapTable.StockIssuance.OcfStockIssuanceData {
  if (!d.id) throw new Error('stockIssuance.id is required');
  if (!d.security_id) throw new Error('stockIssuance.security_id is required');
  if (!d.custom_id) throw new Error('stockIssuance.custom_id is required');
  if (!d.stakeholder_id) throw new Error('stockIssuance.stakeholder_id is required');
  if (!d.stock_class_id) throw new Error('stockIssuance.stock_class_id is required');
  return {
    id: d.id,
    date: dateStringToDAMLTime(d.date),
    security_id: d.security_id,
    custom_id: d.custom_id,
    stakeholder_id: d.stakeholder_id,
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    consideration_text: (d.consideration_text && d.consideration_text != '') ? d.consideration_text : null,
    security_law_exemptions: (d.security_law_exemptions || []).map(securityExemptionToDaml),
    stock_class_id: d.stock_class_id,
    stock_plan_id: d.stock_plan_id ?? null,
    share_numbers_issued: (d.share_numbers_issued || [])
      .filter(range => !(range.starting_share_number === '0' && range.ending_share_number === '0'))
      .map(shareNumberRangeToDaml),
    share_price: monetaryToDaml(d.share_price),
    quantity: typeof d.quantity === 'number' ? d.quantity.toString() : d.quantity,
    vesting_terms_id: d.vesting_terms_id ?? null,
    vestings: (d.vestings || []).map(v => ({ date: dateStringToDAMLTime(v.date), amount: typeof v.amount === 'number' ? v.amount.toString() : v.amount })),
    cost_basis: d.cost_basis ? monetaryToDaml(d.cost_basis) : null,
    stock_legend_ids: d.stock_legend_ids,
    issuance_type: stockIssuanceTypeToDaml(d.issuance_type),
    comments: d.comments || []
  };
}

export interface CreateStockIssuanceParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  issuanceData: OcfStockIssuanceData;
}

export function buildCreateStockIssuanceCommand(params: CreateStockIssuanceParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateStockIssuance = {
    issuance_data: stockIssuanceDataToDaml(params.issuanceData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateStockIssuance',
      choiceArgument: choiceArguments as any
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}


