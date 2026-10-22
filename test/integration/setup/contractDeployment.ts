/**
 * Contract deployment utilities for integration tests.
 *
 * This module handles deploying the OCP DAML packages and creating the FeaturedAppRight for LocalNet integration tests.
 */

import { type LedgerJsonApiClient, type ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import * as fs from 'fs';

import { resolveOpenCapTableDarForOcpSdkRepo } from '../../../scripts/lib/resolveOpenCapTableDarForOcpSdkRepo';

/** Result of deploying the OCP packages. */
export interface DeploymentResult {
  /** Package IDs present on the ledger after deployment */
  packageIds: string[];
}

/** Check if the OCP packages are already deployed on the ledger. */
async function arePackagesDeployed(client: LedgerJsonApiClient): Promise<boolean> {
  try {
    // Try to query for CapTable contracts - if this succeeds, packages are deployed
    // (Even if no contracts exist, the query will succeed if the template is known)
    await client.getActiveContracts({
      templateIds: [Fairmint.OpenCapTable.CapTable.CapTable.templateId],
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
  const darPath = resolveOpenCapTableDarForOcpSdkRepo();

  console.log(`Uploading DAR file: ${darPath}`);

  await client.uploadDar({ darFile: fs.readFileSync(darPath) });

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger after upload: ${packageIds.length}`);

  return packageIds;
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
  const response = await client.submitAndWaitForTransaction({
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
  });

  // Find the created FeaturedAppRight contract
  const { events } = response.transaction;

  let featuredAppRightContractId: string | null = null;
  let featuredAppRightTemplateId: string | null = null;

  for (const event of events) {
    if ('CreatedEvent' in event) {
      const created = event.CreatedEvent;
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

/**
 * Deploy the OCP packages to the ledger.
 *
 * This is idempotent - if the packages are already deployed it returns the packages present on the ledger.
 *
 * @param client - The ledger client
 */
export async function deployOcpPackages(client: LedgerJsonApiClient): Promise<DeploymentResult> {
  if (await arePackagesDeployed(client)) {
    console.log('OCP packages already deployed on ledger');
    const { packageIds } = await client.listPackages();
    return { packageIds };
  }

  console.log('OCP packages not found on ledger, deploying...');
  return { packageIds: await deployContracts(client) };
}
