/**
 * Contract deployment utilities for integration tests.
 *
 * This module deploys the two OpenCapTable DARs, allocates the parties of a book, and runs the three-step cap table
 * setup (`system_operator` authorizes, the transfer agent accepts, the issuer creates). Shared with
 * `scripts/quickstart/deployContracts.ts`.
 */

import { generateTestId } from '@fairmint/canton-dev-tools/testing';
import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import * as fs from 'fs';

import { resolveOpenCapTableDarsForOcpSdkRepo } from '../../../scripts/lib/resolveOpenCapTableDarForOcpSdkRepo';
import { OcpClient } from '../../../src/OcpClient';
import type { OcfIssuer } from '../../../src/types/native';
import type { CreateCapTableResult, OcpFactoryIdentity } from '../../../src/types/setup';

/** Result of deploying the OCP packages. */
export interface DeploymentResult {
  /** Package IDs present on the ledger after deployment */
  packageIds: string[];
}

/**
 * Upload the OpenCapTable DARs, interfaces first (OpenCapTableApi-v01, then OpenCapTable-v35).
 *
 * Uploading a DAR the participant already holds is a no-op, so this is idempotent.
 *
 * @param client - The ledger client (needs the ParticipantAdmin right)
 */
export async function deployOcpPackages(client: LedgerJsonApiClient): Promise<DeploymentResult> {
  for (const darPath of resolveOpenCapTableDarsForOcpSdkRepo()) {
    console.log(`Uploading DAR file: ${darPath}`);
    await client.uploadDar({ darFile: fs.readFileSync(darPath) });
  }

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger after upload: ${packageIds.length}`);

  return { packageIds };
}

/** The three distinct parties of a book, and what the ledger client needs to act as them. */
export interface TestParties {
  /** Owns the cap table and creates it */
  issuerParty: string;
  /** Signs the factory and authorizes issuers */
  systemOperatorParty: string;
  /** The issuer's transfer agent: the only party that writes the book */
  transferAgentParty: string;
  /** The ledger user the client is authenticated as; it acts as all three parties */
  userId: string;
}

/**
 * Allocate an issuer, a system operator and a transfer agent, and give the authenticated ledger user act-as rights to
 * each. The three are distinct parties, as the ledger requires of a book.
 *
 * Allocating a party needs the ParticipantAdmin right: LocalNet's shared-secret profile (`npm run localnet`) has it.
 *
 * @param client - The ledger client (authenticated as a ParticipantAdmin user)
 * @param runId - Makes the party hints unique to this run
 */
export async function allocateTestParties(
  client: LedgerJsonApiClient,
  runId: string = generateTestId('run')
): Promise<TestParties> {
  const { user } = await client.getAuthenticatedUser({});

  const allocate = async (role: string): Promise<string> => {
    try {
      const response = await client.allocateParty({
        partyIdHint: `ocp-${role}-${runId}`,
        identityProviderId: '',
        // Empty: the participant's one connected synchronizer (LocalNet's global synchronizer)
        synchronizerId: '',
        // The user that gets act-as rights to the new party
        userId: user.id,
      });
      return response.partyDetails.party;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not allocate the ${role} party as user ${user.id}: ${reason}. Allocating parties needs a ` +
          'ParticipantAdmin user: run LocalNet with the shared-secret profile (npm run localnet:start).'
      );
    }
  };

  const issuerParty = await allocate('issuer');
  const systemOperatorParty = await allocate('sysop');
  const transferAgentParty = await allocate('ta');
  console.log(`Allocated parties: ${[issuerParty, systemOperatorParty, transferAgentParty].join(', ')}`);

  return { issuerParty, systemOperatorParty, transferAgentParty, userId: user.id };
}

/** A client bound to the factory of a run. */
export interface TestFactory {
  /** The client, configured with the factory's identity: its setup calls find the live factory themselves */
  ocp: OcpClient;
  factory: OcpFactoryIdentity;
  /** The factory contract as created (each authorization consumes it and creates the next) */
  contractId: string;
}

/**
 * Create the `OcpFactory` a run takes its cap table IDs from, signed by the system operator, and an `OcpClient` bound
 * to its identity. The factory ID is unique to the run, so cap table IDs (`<factory_id>-<n>`) are too.
 *
 * @param ledger - The ledger client; its party ID is set to the transfer agent, which every contract of a book is
 * visible to, for the reads that name no party
 * @param parties - The run's parties
 * @param factoryId - The `factory_id` (default: a fresh one)
 */
export async function createTestFactory(
  ledger: LedgerJsonApiClient,
  parties: TestParties,
  factoryId: string = generateTestId('it')
): Promise<TestFactory> {
  ledger.setPartyId(parties.transferAgentParty);

  // An identity, not a contract ID: each authorization consumes the factory and recreates it
  const factory: OcpFactoryIdentity = { factoryId, systemOperator: parties.systemOperatorParty };
  const ocp = new OcpClient({ ledger, factory });
  const created = await ocp.OpenCapTable.setup.createFactory();
  return { ocp, factory, contractId: created.contractId };
}

/** A cap table the three-step setup created. */
export interface CreatedCapTable extends CreateCapTableResult {
  /** The cap table's ID, `<factory_id>-<n>` */
  capTableId: string;
}

/**
 * Run the three-step cap table setup through the client's factory: `system_operator` authorizes the issuer and pins
 * the transfer agent, the transfer agent accepts, and the issuer creates the cap table with the authorization
 * disclosed.
 *
 * @param ocp - A client whose factory identity names a live factory
 * @param params - The issuer, its transfer agent and the issuer record the cap table starts with
 */
export async function createCapTable(
  ocp: OcpClient,
  params: { issuerParty: string; transferAgentParty: string; issuerData: OcfIssuer }
): Promise<CreatedCapTable> {
  const { setup } = ocp.OpenCapTable;

  const authorized = await setup.authorizeIssuer({
    issuer: params.issuerParty,
    transferAgent: params.transferAgentParty,
  });
  const { authorization } = await setup.acceptAuthorization({
    authorizationContractId: authorized.authorizationContractId,
    transferAgent: params.transferAgentParty,
    expected: { issuer: params.issuerParty, capTableId: authorized.capTableId },
  });
  const { command, disclosedContracts, actAs } = setup.buildCreateCapTable({
    authorization,
    transferAgent: params.transferAgentParty,
    issuerData: params.issuerData,
  });
  const response = await ocp.ledger.submitAndWaitForTransaction({
    commands: [command],
    disclosedContracts,
    actAs,
  });

  return { capTableId: authorized.capTableId, ...setup.readCreateCapTableResult(response) };
}
