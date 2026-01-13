import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteEquityCompensationIssuanceParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  equityCompensationIssuanceId: string;
}

export function buildDeleteEquityCompensationIssuanceCommand(
  params: DeleteEquityCompensationIssuanceParams
): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteEquityCompensationIssuance',
    choiceArgument: {
      id: params.equityCompensationIssuanceId,
    },
  });
}
