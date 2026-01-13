import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteVestingTermsParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  vestingTermsId: string;
}

export function buildDeleteVestingTermsCommand(params: DeleteVestingTermsParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteVestingTerms',
    choiceArgument: {
      id: params.vestingTermsId,
    },
  });
}
