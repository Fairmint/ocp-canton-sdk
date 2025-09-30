import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { findCreatedEventByTemplateId, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import { Command, DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcfIssuerData, CommandWithDisclosedContracts } from '../../types';
import { issuerDataToDaml } from '../../utils/typeConversions';

export interface CreateIssuerParams {
  /** Details of the IssuerAuthorization contract for disclosed contracts */
  issuerAuthorizationContractDetails: DisclosedContract;
  /** Details of the FeaturedAppRight contract for disclosed contracts */
  featuredAppRightContractDetails: DisclosedContract;
  issuerParty: string;
  /**
   * Issuer data to create
   *
   * Schema: https://schema.opencaptablecoalition.com/v/1.2.0/objects/Issuer.schema.json
   * - legal_name: Legal name of the issuer
   * - formation_date: Date of formation (YYYY-MM-DD)
   * - country_of_formation: Country of formation (ISO 3166-1 alpha-2)
   * - dba (optional): Doing Business As name
   * - country_subdivision_of_formation (optional): Subdivision code of formation (ISO 3166-2)
   * - country_subdivision_name_of_formation (optional): Text name of subdivision of formation
   * - tax_ids (optional): Issuer tax IDs
   * - email (optional): Work email
   * - phone (optional): Phone number in ITU E.123 format
   * - address (optional): Headquarters address
   * - initial_shares_authorized (optional): Initial authorized shares (enum or numeric)
   * - comments (optional): Additional comments
   */
  issuerData: OcfIssuerData;
}

export interface CreateIssuerResult {
  contractId: string; // Contract ID of the created Issuer
  updateId: string;
  response: SubmitAndWaitForTransactionTreeResponse;
}

/**
 * Create an issuer by exercising the CreateIssuer choice on an IssuerAuthorization contract
 *
 * This function requires the IssuerAuthorization and FeaturedAppRight contract details to be provided for disclosed contracts,
 * which is necessary for cross-domain contract interactions in Canton.
 *
 * @example
 * ```typescript
 * const issuerAuthorizationContractDetails = {
 *   contractId: "1234567890abcdef",
 *   createdEventBlob: "serialized_contract_blob_here",
 *   synchronizerId: "sync_id_here",
 *   templateId: "IssuerAuthorization:template:id:here"
 * };
 *
 * const featuredAppRightContractDetails = {
 *   contractId: "abcdef1234567890",
 *   createdEventBlob: "serialized_featured_app_right_blob_here",
 *   synchronizerId: "featured_sync_id_here",
 *   templateId: "FeaturedAppRight:template:id:here"
 * };
 *
 * const result = await createIssuer(client, {
 *   issuerAuthorizationContractDetails,
 *   featuredAppRightContractDetails,
 *   issuerParty: "issuer_party_id",
 *   issuerData: {
 *     legal_name: "My Company Inc.",
 *     country_of_formation: "US",
 *     email: {
 *       email_type: "BUSINESS",
 *       email_address: "contact@company.com"
 *     },
 *     // ... other issuer data
 *   }
 * });
 * ```
 *
 * @param client - The ledger JSON API client
 * @param params - Parameters for creating an issuer, including the contract details for disclosed contracts
 * @returns Promise resolving to the result of the issuer creation
 */
export async function createIssuer(
  client: LedgerJsonApiClient,
  params: CreateIssuerParams
): Promise<CreateIssuerResult> {
  const { command, disclosedContracts } = buildCreateIssuerCommand(params);

  const response = await client.submitAndWaitForTransactionTree({
    actAs: [params.issuerParty],
    commands: [command],
    disclosedContracts
  }) as SubmitAndWaitForTransactionTreeResponse;

  const created = findCreatedEventByTemplateId(
    response,
    Fairmint.OpenCapTable.Issuer.Issuer.templateId
  );
  if (!created) {
    throw new Error('Expected CreatedTreeEvent not found');
  }

  const issuerContractId = created.CreatedTreeEvent.value.contractId;

  return {
    contractId: issuerContractId,
    updateId: (response.transactionTree as any)?.updateId ?? (response.transactionTree as any)?.transaction?.updateId,
    response
  };
}

export function buildCreateIssuerCommand(params: CreateIssuerParams): CommandWithDisclosedContracts {
  const choiceArguments: Fairmint.OpenCapTable.IssuerAuthorization.CreateIssuer = {
    issuer_data: issuerDataToDaml(params.issuerData)
  };

  const command: Command = {
    ExerciseCommand: {
      templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      choice: 'CreateIssuer',
      choiceArgument: choiceArguments
    }
  };

  const disclosedContracts: DisclosedContract[] = [
    {
      templateId: params.issuerAuthorizationContractDetails.templateId,
      contractId: params.issuerAuthorizationContractDetails.contractId,
      createdEventBlob: params.issuerAuthorizationContractDetails.createdEventBlob,
      synchronizerId: params.issuerAuthorizationContractDetails.synchronizerId
    },
    {
      templateId: params.featuredAppRightContractDetails.templateId,
      contractId: params.featuredAppRightContractDetails.contractId,
      createdEventBlob: params.featuredAppRightContractDetails.createdEventBlob,
      synchronizerId: params.featuredAppRightContractDetails.synchronizerId
    }
  ];

  return { command, disclosedContracts };
}
