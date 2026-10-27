/**
 * Deploy the OpenCapTable-v35 packages to LocalNet and set up one cap table (manual / debugging). Integration tests
 * deploy via the harness.
 *
 * Uploads the two DARs (OpenCapTableApi-v01, then OpenCapTable-v35), allocates distinct issuer, system operator and
 * transfer agent parties, creates a factory with a `factory_id` and runs the three-step setup. Allocating parties
 * needs the ParticipantAdmin right (LocalNet's shared-secret profile).
 */

import { generateTestId } from '@fairmint/canton-dev-tools/testing';

import {
  allocateTestParties,
  createCapTable,
  createTestFactory,
  deployOcpPackages,
} from '../../test/integration/setup/contractDeployment';
import { createTestIssuerData } from '../../test/integration/utils/setupTestData';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

async function main(): Promise<void> {
  await waitForLedgerJsonApiReady();

  const ledger = createLedgerJsonApiClient(buildQuickstartClientConfig());

  await deployOcpPackages(ledger);

  const parties = await allocateTestParties(ledger);

  const { ocp, factory, contractId } = await createTestFactory(
    ledger,
    parties,
    process.env.OCP_QUICKSTART_FACTORY_ID ?? generateTestId('quickstart')
  );
  console.log(`OcpFactory ${factory.factoryId}: ${contractId}`);

  const capTable = await createCapTable(ocp, {
    issuerParty: parties.issuerParty,
    transferAgentParty: parties.transferAgentParty,
    issuerData: createTestIssuerData(),
  });
  console.log(`Cap table ${capTable.capTableId}: anchor ${capTable.capTableContractId}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
