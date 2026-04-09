/**
 * Deploy DAML contracts to LocalNet.
 *
 * DAR: `@fairmint/open-captable-protocol-daml-js/opencaptable.dar`.
 *
 * Note: The integration test harness handles contract deployment automatically. This script is for manual deployment
 * or debugging.
 */

import { createRequire } from 'node:module';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';
import { requireOpenCapTableDarPath } from '../lib/resolveOpenCapTableDar';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

const resolveFrom = createRequire(__filename);

function findDarFiles(): string[] {
  return [requireOpenCapTableDarPath(resolveFrom)];
}

async function main(): Promise<void> {
  const filePaths = findDarFiles();

  console.log(`Found ${filePaths.length} DAR file(s) to deploy:`);
  for (const filePath of filePaths) {
    console.log(`  - ${filePath}`);
  }

  await waitForLedgerJsonApiReady();

  const client = createLedgerJsonApiClient(buildQuickstartClientConfig());

  for (const filePath of filePaths) {
    console.log(`Uploading DAR: ${filePath}`);
    await client.uploadDarFile({ filePath });
  }

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger: ${packageIds.length}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
