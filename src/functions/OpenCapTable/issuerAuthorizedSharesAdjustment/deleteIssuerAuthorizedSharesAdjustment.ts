import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteIssuerAuthorizedSharesAdjustmentParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  issuerAuthorizedSharesAdjustmentId: string;
}

export function buildDeleteIssuerAuthorizedSharesAdjustmentCommand(
  params: DeleteIssuerAuthorizedSharesAdjustmentParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteIssuerAuthorizedSharesAdjustment',
    choiceArgument: {
      id: params.issuerAuthorizedSharesAdjustmentId,
    },
  });
}
