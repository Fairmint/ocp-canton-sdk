/**
 * Deploy DAML contracts to LocalNet.
 *
 * DAR is read only from the installed @fairmint/open-captable-protocol-daml-js package (bundled under
 * OpenCapTable-v34/.daml/dist).
 *
 * Note: The integration test harness handles contract deployment automatically. This script is for manual deployment
 * or debugging.
 */

import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import * as path from 'path';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

const require = createRequire(__filename);

/** Must match the OpenCapTable line shipped inside @fairmint/open-captable-protocol-daml-js. */
const OPEN_CAP_TABLE_PACKAGE_LINE = 'OpenCapTable-v34';

function findDarFiles(): string[] {
  const packageRoot = path.resolve(path.dirname(require.resolve('@fairmint/open-captable-protocol-daml-js')), '..');
  const distDir = path.join(packageRoot, OPEN_CAP_TABLE_PACKAGE_LINE, '.daml', 'dist');

  if (!fs.existsSync(distDir)) {
    throw new Error(
      `Could not find OCP DAR directory.\n` +
        `Expected: ${distDir}\n` +
        `Install or upgrade @fairmint/open-captable-protocol-daml-js so it includes the bundled DAR.`
    );
  }

  const darFile = fs
    .readdirSync(distDir)
    .find((entry) => entry.endsWith('.dar') && entry.startsWith(`${OPEN_CAP_TABLE_PACKAGE_LINE}-`));

  if (!darFile) {
    throw new Error(
      `No ${OPEN_CAP_TABLE_PACKAGE_LINE}-*.dar under ${distDir}.\n` +
        `Install or upgrade @fairmint/open-captable-protocol-daml-js.`
    );
  }

  return [path.join(distDir, darFile)];
}

async function main(): Promise<void> {
  const filePaths = findDarFiles();

  console.log(`Found ${filePaths.length} DAR file(s) to deploy:`);
  for (const filePath of filePaths) {
    console.log(`  - ${filePath}`);
  }

  await waitForLedgerJsonApiReady();

  const client = new LedgerJsonApiClient(buildQuickstartClientConfig());

  for (const filePath of filePaths) {
    console.log(`Uploading DAR: ${filePath}`);
    await client.uploadDarFile({ filePath });
  }

  const { packageIds } = await client.listPackages();
  console.log(`Packages on ledger: ${packageIds.length}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
