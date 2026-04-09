/**
 * Deploy DAML contracts to LocalNet.
 *
 * DAR path from `@fairmint/open-captable-protocol-daml-js/openCapTableDarPath` (single source of truth).
 *
 * Note: The integration test harness handles contract deployment automatically. This script is for manual deployment
 * or debugging.
 */

import { getOpenCapTableDarPath } from '@fairmint/open-captable-protocol-daml-js/openCapTableDarPath';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

function findDarFiles(): string[] {
  try {
    return [getOpenCapTableDarPath()];
  } catch {
    throw new Error(
      'Could not find OCP DAML DAR file. ' +
        'Ensure @fairmint/open-captable-protocol-daml-js >= 0.2.154 is installed or run `daml build` in open-captable-protocol-daml.'
    );
  }
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
