/**
 * Deploy DAML contracts to LocalNet.
 *
 * DAR: `@fairmint/open-captable-protocol-daml-js/opencaptable.dar`.
 *
 * Note: The integration test harness handles contract deployment automatically. This script is for manual deployment
 * or debugging.
 */

import * as fs from 'fs';
import { createRequire } from 'node:module';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

const resolveFrom = createRequire(__filename);

const OCP_DAR = '@fairmint/open-captable-protocol-daml-js/opencaptable.dar';

function findDarFiles(): string[] {
  let darPath: string;
  try {
    darPath = resolveFrom.resolve(OCP_DAR);
  } catch {
    throw new Error(`Could not resolve ${OCP_DAR}.\n` + 'Install @fairmint/open-captable-protocol-daml-js >= 0.2.152.');
  }

  if (!fs.existsSync(darPath)) {
    throw new Error(`OpenCapTable DAR missing on disk: ${darPath}`);
  }

  return [darPath];
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
