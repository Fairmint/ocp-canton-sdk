/**
 * Deploy DAML contracts to LocalNet.
 *
 * This script auto-discovers DAR files from standard locations:
 *
 * 1. @fairmint/open-captable-protocol-daml-js npm package
 * 2. Sibling open-captable-protocol-daml directory (monorepo)
 * 3. OCP_TEST_DAR_FILE_PATH environment variable (single file)
 * 4. OCP_TEST_DAR_FILE_PATHS environment variable (comma-separated list)
 *
 * Note: The integration test harness handles contract deployment automatically. This script is provided for manual
 * deployment or debugging purposes.
 */

import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import * as fs from 'fs';
import * as path from 'path';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function parseFilePaths(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Find DAR files to deploy.
 *
 * Priority:
 *
 * 1. OCP_TEST_DAR_FILE_PATHS env var (comma-separated list)
 * 2. OCP_TEST_DAR_FILE_PATH env var (single file)
 * 3. @fairmint/open-captable-protocol-daml-js npm package
 * 4. Sibling open-captable-protocol-daml directory (monorepo)
 */
function findDarFiles(): string[] {
  // Check for explicit env var (comma-separated list)
  const rawPaths = getEnv('OCP_TEST_DAR_FILE_PATHS');
  if (rawPaths) {
    const paths = parseFilePaths(rawPaths);
    if (paths.length > 0) {
      // Verify all paths exist
      for (const filePath of paths) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`DAR file not found: ${filePath} (from OCP_TEST_DAR_FILE_PATHS)`);
        }
      }
      return paths;
    }
  }

  // Check for single file env var
  const singlePath = getEnv('OCP_TEST_DAR_FILE_PATH');
  if (singlePath) {
    if (!fs.existsSync(singlePath)) {
      throw new Error(`DAR file not found: ${singlePath} (from OCP_TEST_DAR_FILE_PATH)`);
    }
    return [singlePath];
  }

  // Auto-discover from standard locations
  const possiblePaths = [
    // From npm package - DAR file included in package
    path.resolve(
      __dirname,
      '../../node_modules/@fairmint/open-captable-protocol-daml-js/OpenCapTable-v25/.daml/dist/OpenCapTable-v25-0.0.1.dar'
    ),
    // From sibling directory (local development in monorepo)
    path.resolve(__dirname, '../../open-captable-protocol-daml/OpenCapTable-v25/.daml/dist/OpenCapTable-v25-0.0.1.dar'),
  ];

  for (const darPath of possiblePaths) {
    if (fs.existsSync(darPath)) {
      return [darPath];
    }
  }

  throw new Error(
    `Could not find OCP DAML DAR file.\n` +
      `Ensure @fairmint/open-captable-protocol-daml-js is installed, or set OCP_TEST_DAR_FILE_PATH.\n` +
      `Searched locations:\n${possiblePaths.map((p) => `  - ${p}`).join('\n')}`
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
