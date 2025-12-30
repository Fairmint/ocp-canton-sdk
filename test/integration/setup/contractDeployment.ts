/**
 * Contract deployment utilities for integration tests.
 *
 * This module handles deploying DAML contracts and creating the OcpFactory for LocalNet integration tests.
 */

import { type LedgerJsonApiClient, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { SubmitAndWaitForTransactionTreeResponse } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/operations';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import * as fs from 'fs';
import * as path from 'path';

/** Result of deploying contracts and creating the factory. */
export interface DeploymentResult {
  /** The OcpFactory contract ID */
  ocpFactoryContractId: string;
  /** The OcpFactory template ID */
  ocpFactoryTemplateId: string;
  /** Package IDs that were uploaded */
  packageIds: string[];
}

/**
 * Find the OCP DAML DAR file path.
 *
 * Looks in common locations relative to the project root.
 */
function findDarFilePath(): string | null {
  const possiblePaths = [
    // From npm package
    path.resolve(__dirname, '../../../../node_modules/@fairmint/open-captable-protocol-daml-js/OpenCapTable.dar'),
    // From sibling directory (monorepo)
    path.resolve(__dirname, '../../../../open-captable-protocol-daml/OpenCapTable.dar'),
    // Environment variable override
    process.env.OCP_TEST_DAR_FILE_PATH,
  ].filter(Boolean) as string[];

  for (const darPath of possiblePaths) {
    if (fs.existsSync(darPath)) {
      return darPath;
    }
  }

  return null;
}

/** Check if the OCP packages are already deployed on the ledger. */
async function arePackagesDeployed(client: LedgerJsonApiClient): Promise<boolean> {
  const { packageIds } = await client.listPackages();

  // Check if the OcpFactory template exists by looking for its package
  // The package ID is in the template ID format: packageId:modulePath:templateName
  const ocpFactoryTemplateId = Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId;
  const expectedPackageId = ocpFactoryTemplateId.split(':')[0];

  return packageIds.includes(expectedPackageId);
}

/** Deploy OCP DAML contracts to the ledger. */
async function deployContracts(client: LedgerJsonApiClient): Promise<string[]> {
  const darPath = findDarFilePath();
  if (!darPath) {
    throw new Error(
      'Could not find OCP DAML DAR file. ' +
        'Ensure @fairmint/open-captable-protocol-daml-js is installed or set OCP_TEST_DAR_FILE_PATH.'
    );
  }

  console.log(`Uploading DAR file: ${darPath}`);

  await client.uploadDarFile({ filePath: darPath });

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger after upload: ${packageIds.length}`);

  return packageIds;
}

/** Find an existing OcpFactory contract on the ledger. */
async function findExistingFactory(client: LedgerJsonApiClient, systemOperatorParty: string): Promise<string | null> {
  const { templateId } = Fairmint.OpenCapTable.OcpFactory.OcpFactory;

  // Get active contracts - response is an array of items with contractEntry
  const response = await client.getActiveContracts({
    templateIds: [templateId],
  });

  // Look for a contract owned by the system operator
  for (const item of response) {
    const entry = item.contractEntry;
    if (!('JsActiveContract' in entry)) continue;

    const contract = entry.JsActiveContract;
    const payload = contract.createdEvent.createArgument as Record<string, unknown>;
    if (payload.system_operator === systemOperatorParty) {
      return contract.createdEvent.contractId;
    }
  }

  return null;
}

/** Create the OcpFactory contract. */
async function createOcpFactory(
  client: LedgerJsonApiClient,
  systemOperatorParty: string,
  featuredAppRightContractId: string
): Promise<{ contractId: string; templateId: string }> {
  const { templateId } = Fairmint.OpenCapTable.OcpFactory.OcpFactory;

  console.log(`Creating OcpFactory contract...`);
  console.log(`  System operator: ${systemOperatorParty}`);
  console.log(`  FeaturedAppRight: ${featuredAppRightContractId}`);

  // Use type assertion for the ContractId - it's a string at runtime
  const createArguments = {
    system_operator: systemOperatorParty,
    featured_app_right: featuredAppRightContractId,
  } as Fairmint.OpenCapTable.OcpFactory.OcpFactory;

  const response = (await client.submitAndWaitForTransactionTree({
    commands: [
      {
        CreateCommand: {
          templateId,
          createArguments,
        },
      },
    ],
    actAs: [systemOperatorParty],
  })) as SubmitAndWaitForTransactionTreeResponse;

  // Extract contract ID from response
  const { eventsById } = response.transactionTree;
  if (Object.keys(eventsById).length === 0) {
    throw new Error('No events found in OcpFactory creation response');
  }

  const eventKeys = Object.keys(eventsById);
  const firstEvent = eventsById[eventKeys[0]];

  if (!('CreatedTreeEvent' in firstEvent)) {
    throw new Error('First event is not a CreatedTreeEvent');
  }

  const { contractId } = firstEvent.CreatedTreeEvent.value;

  console.log(`OcpFactory created: ${contractId}`);

  return { contractId, templateId };
}

/** Get the disclosed contract for the OcpFactory. */
export async function getOcpFactoryDisclosedContract(
  client: LedgerJsonApiClient,
  contractId: string
): Promise<DisclosedContract> {
  const events = await client.getEventsByContractId({ contractId });

  if (!events.created?.createdEvent.createdEventBlob) {
    throw new Error('Missing createdEventBlob for OcpFactory contract');
  }

  // Get synchronizer ID from a recent transaction
  const { templateId } = Fairmint.OpenCapTable.OcpFactory.OcpFactory;

  return {
    contractId,
    templateId,
    createdEventBlob: events.created.createdEvent.createdEventBlob,
    // Use empty string as default - will be overridden when used in actual transactions
    synchronizerId: '',
  };
}

/** Result of creating a FeaturedAppRight. */
export interface FeaturedAppRightResult {
  /** The FeaturedAppRight contract ID */
  contractId: string;
  /** The FeaturedAppRight template ID */
  templateId: string;
  /** The createdEventBlob for disclosed contracts */
  createdEventBlob: string;
  /** The synchronizer ID */
  synchronizerId: string;
}

/**
 * Lookup an existing FeaturedAppRight via the Scan API.
 *
 * @param providerPartyId - The party ID to look up
 * @param synchronizerId - The synchronizer ID (domain ID)
 * @returns The FeaturedAppRight result if found, null otherwise
 */
export async function lookupFeaturedAppRightViaScanApi(
  providerPartyId: string,
  synchronizerId: string
): Promise<FeaturedAppRightResult | null> {
  // LocalNet scan API URL
  const scanApiUrl = 'http://scan.localhost:4000/api/scan';
  const encodedPartyId = encodeURIComponent(providerPartyId);

  try {
    const response = await fetch(`${scanApiUrl}/v0/featured-apps/${encodedPartyId}`);
    if (!response.ok) {
      console.log(`   Scan API returned ${response.status} for FeaturedAppRight lookup`);
      return null;
    }

    const data = (await response.json()) as {
      featured_app_right: {
        contract_id: string;
        template_id: string;
        created_event_blob: string;
      } | null;
    };

    if (!data.featured_app_right) {
      return null;
    }

    return {
      contractId: data.featured_app_right.contract_id,
      templateId: data.featured_app_right.template_id,
      createdEventBlob: data.featured_app_right.created_event_blob,
      synchronizerId,
    };
  } catch (err) {
    console.log(`   FeaturedAppRight lookup failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Create a FeaturedAppRight for a party by exercising AmuletRules_DevNet_FeatureApp.
 *
 * This is only available on DevNet (like LocalNet). It allows self-granting a FeaturedAppRight without DSO approval.
 *
 * @param client - The ledger client
 * @param providerParty - The party to grant the FeaturedAppRight to
 * @param dsoParty - The DSO party (required for the AmuletRules lookup)
 */
export async function createFeaturedAppRight(
  client: LedgerJsonApiClient,
  providerParty: string,
  dsoParty: string
): Promise<FeaturedAppRightResult> {
  // Get AmuletRules contract via Validator API
  const validatorClient = new ValidatorApiClient({ network: 'localnet' });
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesContractId = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesTemplateId = amuletRulesResponse.amulet_rules.contract.template_id;
  const amuletRulesCreatedEventBlob = amuletRulesResponse.amulet_rules.contract.created_event_blob;
  const synchronizerId = amuletRulesResponse.amulet_rules.domain_id;

  console.log(`Creating FeaturedAppRight for party: ${providerParty}`);
  console.log(`  AmuletRules contract: ${amuletRulesContractId}`);

  // Exercise AmuletRules_DevNet_FeatureApp choice
  // We need to include the AmuletRules contract as a disclosed contract since it's owned by DSO
  const response = (await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: amuletRulesTemplateId,
          contractId: amuletRulesContractId,
          choice: 'AmuletRules_DevNet_FeatureApp',
          choiceArgument: {
            provider: providerParty,
          },
        },
      },
    ],
    actAs: [providerParty],
    readAs: [dsoParty],
    disclosedContracts: [
      {
        templateId: amuletRulesTemplateId,
        contractId: amuletRulesContractId,
        createdEventBlob: amuletRulesCreatedEventBlob,
        synchronizerId,
      },
    ],
  })) as SubmitAndWaitForTransactionTreeResponse;

  // Find the created FeaturedAppRight contract
  const { eventsById } = response.transactionTree;

  let featuredAppRightContractId: string | null = null;
  let featuredAppRightTemplateId: string | null = null;

  for (const event of Object.values(eventsById)) {
    if ('CreatedTreeEvent' in event) {
      const created = event.CreatedTreeEvent.value;
      // FeaturedAppRight template ID contains "FeaturedAppRight"
      if (created.templateId.includes('FeaturedAppRight')) {
        featuredAppRightContractId = created.contractId;
        featuredAppRightTemplateId = created.templateId;
        break;
      }
    }
  }

  if (!featuredAppRightContractId || !featuredAppRightTemplateId) {
    throw new Error('FeaturedAppRight contract not found in AmuletRules_DevNet_FeatureApp response');
  }

  // Get the createdEventBlob for disclosed contracts
  const contractEvents = await client.getEventsByContractId({ contractId: featuredAppRightContractId });
  if (!contractEvents.created?.createdEvent.createdEventBlob) {
    throw new Error('Missing createdEventBlob for FeaturedAppRight contract');
  }

  console.log(`FeaturedAppRight created: ${featuredAppRightContractId}`);

  return {
    contractId: featuredAppRightContractId,
    templateId: featuredAppRightTemplateId,
    createdEventBlob: contractEvents.created.createdEvent.createdEventBlob,
    synchronizerId,
  };
}

/** Result of authorizing an issuer. */
export interface AuthorizeIssuerResult {
  /** The IssuerAuthorization contract ID */
  contractId: string;
  /** The IssuerAuthorization template ID */
  templateId: string;
  /** The createdEventBlob for disclosed contracts */
  createdEventBlob: string;
  /** The synchronizer ID */
  synchronizerId: string;
}

/**
 * Authorize an issuer using a specific OcpFactory contract.
 *
 * This is used for LocalNet testing where we create the factory dynamically.
 *
 * @param client - The ledger client
 * @param ocpFactoryContractId - The OcpFactory contract ID
 * @param systemOperatorParty - The system operator party (owner of the factory)
 * @param issuerParty - The party to authorize as an issuer
 */
export async function authorizeIssuerWithFactory(
  client: LedgerJsonApiClient,
  ocpFactoryContractId: string,
  systemOperatorParty: string,
  issuerParty: string
): Promise<AuthorizeIssuerResult> {
  const factoryTemplateId = Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId;
  const authTemplateId = Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId;

  const choiceArguments: Fairmint.OpenCapTable.OcpFactory.AuthorizeIssuer = {
    issuer: issuerParty,
  };

  const response = (await client.submitAndWaitForTransactionTree({
    commands: [
      {
        ExerciseCommand: {
          templateId: factoryTemplateId,
          contractId: ocpFactoryContractId,
          choice: 'AuthorizeIssuer',
          choiceArgument: choiceArguments,
        },
      },
    ],
    actAs: [systemOperatorParty],
  })) as SubmitAndWaitForTransactionTreeResponse;

  // Find the created IssuerAuthorization contract
  const { eventsById } = response.transactionTree;

  let authContractId: string | null = null;
  for (const event of Object.values(eventsById)) {
    if ('CreatedTreeEvent' in event) {
      const created = event.CreatedTreeEvent.value;
      if (created.templateId === authTemplateId) {
        authContractId = created.contractId;
        break;
      }
    }
  }

  if (!authContractId) {
    throw new Error('IssuerAuthorization contract not found in AuthorizeIssuer response');
  }

  // Get the createdEventBlob for disclosed contracts
  const contractEvents = await client.getEventsByContractId({ contractId: authContractId });
  if (!contractEvents.created?.createdEvent.createdEventBlob) {
    throw new Error('Missing createdEventBlob for IssuerAuthorization contract');
  }

  return {
    contractId: authContractId,
    templateId: authTemplateId,
    createdEventBlob: contractEvents.created.createdEvent.createdEventBlob,
    synchronizerId: response.transactionTree.synchronizerId,
  };
}

/**
 * Deploy contracts and create the OcpFactory.
 *
 * This is idempotent - if contracts are already deployed and factory exists, it will return the existing factory.
 *
 * @param client - The ledger client
 * @param systemOperatorParty - The party that will be the system operator
 * @param featuredAppRightContractId - The FeaturedAppRight contract ID from cn-quickstart
 */
export async function deployAndCreateFactory(
  client: LedgerJsonApiClient,
  systemOperatorParty: string,
  featuredAppRightContractId: string
): Promise<DeploymentResult> {
  // Check if packages are deployed
  const packagesDeployed = await arePackagesDeployed(client);

  let packageIds: string[];
  if (!packagesDeployed) {
    console.log('OCP packages not found on ledger, deploying...');
    packageIds = await deployContracts(client);
  } else {
    console.log('OCP packages already deployed on ledger');
    const { packageIds: existingIds } = await client.listPackages();
    packageIds = existingIds;
  }

  // Check if factory already exists
  const existingFactoryId = await findExistingFactory(client, systemOperatorParty);

  if (existingFactoryId) {
    console.log(`Using existing OcpFactory: ${existingFactoryId}`);
    return {
      ocpFactoryContractId: existingFactoryId,
      ocpFactoryTemplateId: Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId,
      packageIds,
    };
  }

  // Create new factory
  const factory = await createOcpFactory(client, systemOperatorParty, featuredAppRightContractId);

  return {
    ocpFactoryContractId: factory.contractId,
    ocpFactoryTemplateId: factory.templateId,
    packageIds,
  };
}
