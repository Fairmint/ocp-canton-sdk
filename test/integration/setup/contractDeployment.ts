/**
 * Contract deployment utilities for integration tests.
 *
 * This module handles deploying DAML contracts and creating the OcpFactory for LocalNet integration tests.
 */

import { type LedgerJsonApiClient, type ValidatorApiClient } from '@fairmint/canton-node-sdk';
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
  // __dirname is test/integration/setup/, so ../../../ gets to project root
  const possiblePaths = [
    // From npm package - DAR file included in package (v28 as of daml-js 0.2.101)
    path.resolve(
      __dirname,
      '../../../node_modules/@fairmint/open-captable-protocol-daml-js/OpenCapTable-v28/.daml/dist/OpenCapTable-v28-0.0.1.dar'
    ),
    // From sibling directory (local development in monorepo)
    path.resolve(
      __dirname,
      '../../../open-captable-protocol-daml/OpenCapTable-v28/.daml/dist/OpenCapTable-v28-0.0.1.dar'
    ),
  ];

  for (const darPath of possiblePaths) {
    if (fs.existsSync(darPath)) {
      return darPath;
    }
  }

  return null;
}

/** Check if the OCP packages are already deployed on the ledger. */
async function arePackagesDeployed(client: LedgerJsonApiClient): Promise<boolean> {
  try {
    // Try to query for OcpFactory contracts - if this succeeds, packages are deployed
    // (Even if no contracts exist, the query will succeed if the template is known)
    await client.getActiveContracts({
      templateIds: [Fairmint.OpenCapTable.OcpFactory.OcpFactory.templateId],
    });
    // If we got here without an error, the template is known, so packages are deployed
    return true;
  } catch {
    // If the template is unknown, we'll get an error, meaning packages aren't deployed
    return false;
  }
}

/** Deploy OCP DAML contracts to the ledger. */
async function deployContracts(client: LedgerJsonApiClient): Promise<string[]> {
  const darPath = findDarFilePath();
  if (!darPath) {
    throw new Error(
      'Could not find OCP DAML DAR file. ' +
        'Ensure @fairmint/open-captable-protocol-daml-js is installed or run `daml build` in open-captable-protocol-daml.'
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
  // We need to filter by parties to satisfy the Canton API requirements
  const response = await client.getActiveContracts({
    parties: [systemOperatorParty],
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
  systemOperatorParty: string
): Promise<{ contractId: string; templateId: string }> {
  const { templateId } = Fairmint.OpenCapTable.OcpFactory.OcpFactory;

  console.log(`Creating OcpFactory contract...`);
  console.log(`  System operator: ${systemOperatorParty}`);

  // v28 OcpFactory only requires system_operator
  const createArguments: Fairmint.OpenCapTable.OcpFactory.OcpFactory = {
    system_operator: systemOperatorParty,
  };

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
  const encodedPartyId = encodeURIComponent(providerPartyId);

  // Use a promise wrapper around http.request because:
  // - Node.js fetch() doesn't properly support overriding the Host header
  // - We need to use 127.0.0.1 with Host: scan.localhost for nginx routing
  // - Node.js doesn't resolve *.localhost subdomains like the browser does
  return new Promise((resolve) => {
    const http = require('http') as typeof import('http');

    const options = {
      hostname: '127.0.0.1',
      port: 4000,
      path: `/api/scan/v0/featured-apps/${encodedPartyId}`,
      method: 'GET',
      headers: {
        Host: 'scan.localhost',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.log(`   Scan API returned ${res.statusCode} for FeaturedAppRight lookup`);
          resolve(null);
          return;
        }

        try {
          const parsed = JSON.parse(data) as {
            featured_app_right: {
              contract_id: string;
              template_id: string;
              created_event_blob: string;
            } | null;
          };

          if (!parsed.featured_app_right) {
            resolve(null);
            return;
          }

          resolve({
            contractId: parsed.featured_app_right.contract_id,
            templateId: parsed.featured_app_right.template_id,
            createdEventBlob: parsed.featured_app_right.created_event_blob,
            synchronizerId,
          });
        } catch {
          console.log('   Failed to parse Scan API response');
          resolve(null);
        }
      });
    });

    req.on('error', (err: Error) => {
      console.log(`   FeaturedAppRight lookup failed: ${err.message}`);
      resolve(null);
    });

    req.end();
  });
}

/**
 * Create a FeaturedAppRight for a party by exercising AmuletRules_DevNet_FeatureApp.
 *
 * This is only available on DevNet (like LocalNet). It allows self-granting a FeaturedAppRight without DSO approval.
 *
 * @param client - The ledger client
 * @param providerParty - The party to grant the FeaturedAppRight to
 * @param validatorClient - The validator API client (pre-configured with correct auth)
 */
export async function createFeaturedAppRight(
  client: LedgerJsonApiClient,
  providerParty: string,
  validatorClient: ValidatorApiClient
): Promise<FeaturedAppRightResult> {
  // Get AmuletRules contract via Validator API
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesContractId = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesTemplateId = amuletRulesResponse.amulet_rules.contract.template_id;
  const amuletRulesCreatedEventBlob = amuletRulesResponse.amulet_rules.contract.created_event_blob;
  const synchronizerId = amuletRulesResponse.amulet_rules.domain_id;

  console.log(`Creating FeaturedAppRight for party: ${providerParty}`);
  console.log(`  AmuletRules contract: ${amuletRulesContractId}`);

  // Exercise AmuletRules_DevNet_FeatureApp choice
  // We use disclosed contracts to provide visibility into the AmuletRules contract.
  // NOTE: Do NOT include DSO in readAs - the OAuth2 client doesn't have CanReadAs rights for DSO.
  // The disclosed contracts mechanism provides the necessary visibility.
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
    // Don't include readAs: [dsoParty] - OAuth2 client doesn't have CanReadAs for DSO
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
  let foundTemplateId: string | null = null;
  let createdEventBlob: string | null = null;

  for (const event of Object.values(eventsById)) {
    if ('CreatedTreeEvent' in event) {
      const created = event.CreatedTreeEvent.value;
      // Match by template name since the full template ID includes package hash
      if (created.templateId.includes('IssuerAuthorization')) {
        authContractId = created.contractId;
        foundTemplateId = created.templateId;
        // Get createdEventBlob directly from the transaction event (may be empty string)
        createdEventBlob = created.createdEventBlob || null;
        break;
      }
    }
  }

  if (!authContractId || !foundTemplateId) {
    // Log available events for debugging
    const eventTypes = Object.values(eventsById).map((e) => {
      if ('CreatedTreeEvent' in e) return `Created: ${e.CreatedTreeEvent.value.templateId}`;
      if ('ExercisedTreeEvent' in e) return `Exercised: ${e.ExercisedTreeEvent.value.choice}`;
      return 'Unknown';
    });
    throw new Error(
      `IssuerAuthorization contract not found in AuthorizeIssuer response. ` + `Events: ${eventTypes.join(', ')}`
    );
  }

  // If createdEventBlob wasn't in the transaction, try to fetch it
  // Note: In LocalNet with OAuth2, getEventsByContractId may fail with 403
  // In that case, we use an empty string - this works when the party is a signatory
  if (!createdEventBlob) {
    try {
      const contractEvents = await client.getEventsByContractId({ contractId: authContractId });
      createdEventBlob = contractEvents.created?.createdEvent.createdEventBlob ?? null;
    } catch {
      // If we can't fetch it, use empty string - works for signatories
      console.log('   Note: Could not fetch createdEventBlob, using empty string (works for signatories)');
      createdEventBlob = '';
    }
  }

  return {
    contractId: authContractId,
    templateId: foundTemplateId,
    createdEventBlob: createdEventBlob ?? '',
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
 */
export async function deployAndCreateFactory(
  client: LedgerJsonApiClient,
  systemOperatorParty: string
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
  const factory = await createOcpFactory(client, systemOperatorParty);

  return {
    ocpFactoryContractId: factory.contractId,
    ocpFactoryTemplateId: factory.templateId,
    packageIds,
  };
}
