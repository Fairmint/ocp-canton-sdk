import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';
import { ContractDetails } from '../../types/contractDetails';
import { OcfConvertibleIssuanceDataNative } from '../../types/native';
import { convertibleIssuanceToDaml } from '../../utils/typeConversions';

export interface IssueConvertibleParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  stakeholderParty: string;
  issuanceData: OcfConvertibleIssuanceDataNative;
}

export interface IssueConvertibleResult {
  contractId: string; // Convertible
  updateId: string;
}

export async function issueConvertible(
  client: LedgerJsonApiClient,
  params: IssueConvertibleParams
): Promise<IssueConvertibleResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.IssueConvertible = {
    stakeholder: params.stakeholderParty,
    issuance_data: convertibleIssuanceToDaml(params.issuanceData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'IssueConvertible',
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
    Fairmint.OpenCapTable.Issuer.Convertible.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}
