import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type { CommandWithDisclosedContracts } from '../../../types';
import { buildCapTableCommand } from '../capTable';

export interface DeleteDocumentParams {
  capTableContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  capTableContractDetails?: DisclosedContract;
  documentId: string;
}

export function buildDeleteDocumentCommand(params: DeleteDocumentParams): CommandWithDisclosedContracts {
  return buildCapTableCommand({
    capTableContractId: params.capTableContractId,
    featuredAppRightContractDetails: params.featuredAppRightContractDetails,
    capTableContractDetails: params.capTableContractDetails,
    choice: 'DeleteDocument',
    choiceArgument: {
      id: params.documentId,
    },
  });
}
