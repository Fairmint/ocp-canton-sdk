import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';

export interface UpdateCompanyValuationParams {
  companyValuationReportContractId: string;
  newCompanyValuation: string | number;
}

export interface UpdateCompanyValuationResult {
  contractId: string;
  updateId: string;
}

/**
 * Update the company valuation on a CompanyValuationReport by exercising SetCompanyValuation.
 */
export async function updateCompanyValuation(
  client: LedgerJsonApiClient,
  params: UpdateCompanyValuationParams
): Promise<UpdateCompanyValuationResult> {
  // Determine the acting party (system_operator) from the created event
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.companyValuationReportContractId
  });
  const systemOperator = eventsResponse.created.createdEvent.createArgument.system_operator;

  const choiceArguments: Fairmint.OpenCapTable.CompanyValuationReport.SetCompanyValuation = {
    new_company_valuation: typeof params.newCompanyValuation === 'number'
      ? params.newCompanyValuation.toString()
      : params.newCompanyValuation
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [systemOperator],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId,
          contractId: params.companyValuationReportContractId,
          choice: 'SetCompanyValuation',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  return {
    contractId: response.transactionTree.eventsById[1].CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
} 