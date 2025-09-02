import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';
import type { ContractId } from '@daml/types';
import { ContractDetails } from '../../types/contractDetails';
import { OcfWarrantIssuanceDataNative } from '../../types/native';
import { warrantIssuanceToDaml } from '../../utils/typeConversions';

export interface IssueWarrantParams {
  issuerContractId: string;
  featuredAppRightContractDetails: ContractDetails;
  issuerParty: string;
  stakeholderParty: string;
  stockClassContractId: ContractId<Fairmint.OpenCapTable.StockClass.StockClass>;
  issuanceData: OcfWarrantIssuanceDataNative;
}

export interface IssueWarrantResult {
  contractId: string; // Warrant
  updateId: string;
}

/**
 * Issue a warrant by exercising the IssueWarrant choice on an Issuer contract
 *
 * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/transactions/issuance/WarrantIssuance.schema.json
 * - quantity, exercise_price, purchase_price, exercise_triggers[], optional expiration date, vesting_terms_id, comments
 */
export async function issueWarrant(
  client: LedgerJsonApiClient,
  params: IssueWarrantParams
): Promise<IssueWarrantResult> {
  const choiceArguments: Fairmint.OpenCapTable.Issuer.IssueWarrant = {
    stakeholder: params.stakeholderParty,
    stock_class: params.stockClassContractId,
    issuance_data: warrantIssuanceToDaml(params.issuanceData)
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.Issuer.Issuer.templateId,
          contractId: params.issuerContractId,
          choice: 'IssueWarrant',
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
    Fairmint.OpenCapTable.Issuer.Warrant.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
}
