/**
 * Deploy DAML contracts to LocalNet.
 *
 * This script auto-discovers DAR files from standard locations:
 *
 * 1. @fairmint/open-captable-protocol-daml-js npm package
 * 2. Sibling open-captable-protocol-daml directory (monorepo)
 *
 * Note: The integration test harness handles contract deployment automatically. This script is provided for manual
 * deployment or debugging purposes.
 */

import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import * as fs from 'fs';
import * as path from 'path';

import { CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE } from '../../src/functions/OpenCapTable/capTable';
import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

/**
 * Find DAR files to deploy by auto-discovering from standard locations.
 *
 * Searched locations:
 *
 * 1. @fairmint/open-captable-protocol-daml-js npm package
 * 2. Sibling open-captable-protocol-daml directory (monorepo)
 */
function findDarFiles(): string[] {
  const possibleDistDirectories = [
    // From npm package - DAR file included in package
    path.resolve(
      __dirname,
      `../../node_modules/@fairmint/open-captable-protocol-daml-js/${CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE}/.daml/dist`
    ),
    // From sibling directory (local development in monorepo)
    path.resolve(__dirname, `../../open-captable-protocol-daml/${CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE}/.daml/dist`),
  ];

  for (const distDirectory of possibleDistDirectories) {
    if (!fs.existsSync(distDirectory)) {
      continue;
    }

    const darFile = fs
      .readdirSync(distDirectory)
      .find((entry) => entry.endsWith('.dar') && entry.startsWith(`${CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE}-`));

    if (darFile) {
      return [path.join(distDirectory, darFile)];
    }
  }

  throw new Error(
    `Could not find OCP DAML DAR file.\n` +
      `Ensure @fairmint/open-captable-protocol-daml-js is installed.\n` +
      `Searched locations:\n${possibleDistDirectories.map((p) => `  - ${p}`).join('\n')}`
  );
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
