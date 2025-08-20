import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';

export interface ConfirmCurrentCompanyValuationReportParams {
  companyValuationReportContractId: string;
}

export interface ConfirmCurrentCompanyValuationReportResult {
  contractId: string;
  updateId: string;
}

/**
 * Confirm the current company valuation on a CompanyValuationReport by exercising ConfirmCurrent.
 */
export async function confirmCurrentCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: ConfirmCurrentCompanyValuationReportParams
): Promise<ConfirmCurrentCompanyValuationReportResult> {
  // Determine the acting party (system_operator) from the created event
  const eventsResponse = await client.getEventsByContractId({
    contractId: params.companyValuationReportContractId
  });
  const systemOperator = eventsResponse.created.createdEvent.createArgument.system_operator;

  const choiceArguments: Fairmint.OpenCapTable.CompanyValuationReport.ConfirmCurrent = {};

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [systemOperator],
    commands: [
      {
        ExerciseCommand: {
          templateId: Fairmint.OpenCapTable.CompanyValuationReport.CompanyValuationReport.templateId,
          contractId: params.companyValuationReportContractId,
          choice: 'ConfirmCurrent',
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