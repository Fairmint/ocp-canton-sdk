import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { OcfDocumentData } from '../../types/native';
import { documentDataToDaml } from '../../utils/typeConversions';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export interface CreateDocumentParams {
  issuerContractId: string;
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  documentData: OcfDocumentData;
}

export interface CreateDocumentResult {
  contractId: string;
  updateId: string;
  transactionTree: SubmitAndWaitForTransactionTreeResponse['transactionTree'];
}

export async function createDocument(
  client: LedgerJsonApiClient,
  params: CreateDocumentParams
): Promise<CreateDocumentResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateDocument = {
    document_data: documentDataToDaml(params.documentData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'CreateDocument',
          choiceArgument: choiceArguments
        }
      }
    ],
    disclosedContracts: [
      {
        templateId: params.featuredAppRightContractDetails.templateId,
        contractId: params.featuredAppRightContractDetails.contractId,
        createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
        synchronizerId: params.featuredAppRightContractDetails.synchronizerId
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.Document.Document.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId,
    transactionTree: response.transactionTree
  };
}

export function buildCreateDocumentCommand(params: CreateDocumentParams): {
  command: Command;
  disclosedContracts: DisclosedContract[];
} {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.CreateDocument = {
    document_data: documentDataToDaml(params.documentData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
      contractId: params.issuerContractId,
      choice: 'CreateDocument',
      choiceArgument: choiceArguments
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


