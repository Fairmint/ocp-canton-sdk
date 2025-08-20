import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import factoryContractIdData from '@fairmint/open-captable-protocol-daml-js/ocp-factory-contract-id.json';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import * as damlTypes from '@daml/types';

/**
 * Details about the FeaturedAppRight contract that need to be disclosed
 * when exercising the CreateCompanyValuationReport choice. This is required for cross-domain
 * contract interactions in Canton.
 */
export interface FeaturedAppRightContractDetails {
  /** The contract ID of the FeaturedAppRight contract */
  contractId: string;
  /** The serialized created event blob of the contract */
  createdEventBlob: string;
  /** The synchronizer ID associated with the contract */
  synchronizerId: string;
  /** The template ID of the contract */
  templateId: string;
}

export interface CreateCompanyValuationReportParams {
  companyId: string;
  companyValuation: string | number;
  observers?: string[];
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: FeaturedAppRightContractDetails;
}

export interface CreateCompanyValuationReportResult {
  contractId: string;
  updateId: string;
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

  const choiceArguments: Fairmint.OpenCapTable.OcpFactory.CreateCompanyValuationReport = {
    company_id: params.companyId,
    company_valuation: typeof params.companyValuation === 'number'
      ? params.companyValuation.toString()
      : params.companyValuation,
    observers: params.observers ?? [],
    featured_app_right: params.featuredAppRightContractDetails.contractId as damlTypes.ContractId<any>
  };

  const response = await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: networkData.templateId,
          contractId: networkData.ocpFactoryContractId,
          choice: 'CreateCompanyValuationReport',
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

  const event = response.transactionTree.eventsById[1];
  if ('CreatedTreeEvent' in event) {
    return {
      contractId: event.CreatedTreeEvent.value.contractId,
      updateId: response.transactionTree.updateId
    };
  } else {
    throw new Error('Expected CreatedTreeEvent not found');
  }
} 