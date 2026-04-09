/**
 * Deploy DAML contracts to LocalNet (manual / debugging). Integration tests deploy via the harness.
 */

import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';
import { resolveOpenCapTableDarForOcpSdkRepo } from '../lib/resolveOpenCapTableDarForOcpSdkRepo';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

async function main(): Promise<void> {
  const darPath = resolveOpenCapTableDarForOcpSdkRepo();
  console.log(`DAR to deploy: ${darPath}`);

  await waitForLedgerJsonApiReady();

  const client = createLedgerJsonApiClient(buildQuickstartClientConfig());

  console.log(`Uploading DAR: ${darPath}`);
  await client.uploadDarFile({ filePath: darPath });

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger: ${packageIds.length}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
