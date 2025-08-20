import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';

export interface AddObserversToCompanyValuationReportParams {
  companyValuationReportContractId: string;
  added: string[];
}

export interface AddObserversToCompanyValuationReportResult {
  contractId: string;
  updateId: string;
}

/**
 * Add observers to a CompanyValuationReport by exercising AddObservers.
 */
export async function addObserversToCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: AddObserversToCompanyValuationReportParams
): Promise<AddObserversToCompanyValuationReportResult> {
  // Determine the acting party (system_operator) from the created event
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.companyValuationReportContractId
  });
  const systemOperator = eventsResponse.created.createdEvent.createArgument.system_operator;

  const choiceArguments: Fairmint.OpenCapTable.CompanyValuationReport.AddObservers = {
    added: params.added
  };

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [systemOperator],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId,
          contractId: params.companyValuationReportContractId,
          choice: 'AddObservers',
          choiceArgument: choiceArguments
        }
      }
    ]
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId
  };
} 