import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts, OcfIssuerAuthorizedSharesAdjustmentTxData } from '../../../types';
import { cleanComments, dateStringToDAMLTime, numberToString } from '../../../utils/typeConversions';
import { buildCapTableCommand } from '../capTable';

export function issuerAuthorizedSharesAdjustmentDataToDaml(
  d: OcfIssuerAuthorizedSharesAdjustmentTxData
): Record<string, unknown> {
  return {
    id: d.id,
    issuer_id: d.issuer_id,
    date: dateStringToDAMLTime(d.date),
    new_shares_authorized: numberToString(d.new_shares_authorized),
    board_approval_date: d.board_approval_date ? dateStringToDAMLTime(d.board_approval_date) : null,
    stockholder_approval_date: d.stockholder_approval_date ? dateStringToDAMLTime(d.stockholder_approval_date) : null,
    comments: cleanComments(d.comments),
  };
}

/**
 * @deprecated Use AddIssuerAuthorizedSharesAdjustmentParams and buildAddIssuerAuthorizedSharesAdjustmentCommand
 *   instead.
 */
export interface CreateIssuerAuthorizedSharesAdjustmentParams {
  /** @deprecated This parameter is renamed to capTableContractId */
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  adjustmentData: OcfIssuerAuthorizedSharesAdjustmentTxData;
}

/** @deprecated Use buildAddIssuerAuthorizedSharesAdjustmentCommand instead. */
export function buildCreateIssuerAuthorizedSharesAdjustmentCommand(
  params: CreateIssuerAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.issuerContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    choice: 'CreateIssuerAuthorizedSharesAdjustment',
    choiceArgument: {
      adjustment_data: issuerAuthorizedSharesAdjustmentDataToDaml(params.adjustmentData),
    },
  });
}
