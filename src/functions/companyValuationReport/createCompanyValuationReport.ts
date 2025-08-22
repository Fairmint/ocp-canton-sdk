import { Fairmint } from '@fairmint/open-captable-protocol-daml-js/lib';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import * as damlTypes from '@daml/types';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/reports-factory-contract-id.json';
import { findCreatedEventByTemplateId } from '../../utils/findCreatedEvent';

export interface CreateCompanyValuationReportParams {
  companyId: string;
  companyValuation: string | number;
  observers?: string[];
}

export interface CreateCompanyValuationReportResult {
  contractId: string;
  updateId: string;
  transactionTree: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Create a CompanyValuationReport by exercising the CreateCompanyValuationReport choice
 * on the OCP Factory contract.
 *
 * This function requires the FeaturedAppRight contract details to be provided for disclosed contracts,
 * which is necessary for cross-domain contract interactions in Canton.
 *
 * @example
 * ```typescript
 * const featuredAppRightContractDetails = {
 *   contractId: "1234567890abcdef",
 *   createdEventBlob: "serialized_contract_blob_here",
 *   synchronizerId: "sync_id_here",
 *   templateId: "FeaturedAppRight:template:id:here"
 * };
 *
 * const result = await createCompanyValuationReport(client, {
 *   companyId: "company123",
 *   companyValuation: "1000000",
 *   observers: ["observer1", "observer2"],
 *   featuredAppRightContractDetails
 * });
 * ```
 */
export async function createCompanyValuationReport(
  client: LedgerJsonApiClient,
  params: CreateCompanyValuationReportParams
): Promise<CreateCompanyValuationReportResult> {
  const network = client.getNetwork();
  const networkData = factoryContractIdData[network as keyof typeof factoryContractIdData];
  if (!networkData) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const choiceArguments: Fairmint.OpenCapTableReports.ReportsFactory.CreateCompanyValuationReport = {
    company_id: params.companyId,
    company_valuation: typeof params.companyValuation === 'number'
      ? params.companyValuation.toString()
      : params.companyValuation,
    observers: params.observers ?? []
  };

  const response = await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: networkData.templateId,
          contractId: networkData.reportsFactoryContractId,
          choice: 'CreateCompanyValuationReport',
          choiceArgument: choiceArguments
        }
      }
    ],
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  return {
    contractId: created.CreatedTreeEvent.value.contractId,
    updateId: response.transactionTree.updateId,
    transactionTree: response
  };
}
