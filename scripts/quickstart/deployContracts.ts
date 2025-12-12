import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';

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

async function main(): Promise<void> {
  const rawPaths = getEnv('OCP_TEST_DAR_FILE_PATHS');
  if (!rawPaths) {
    console.log('OCP_TEST_DAR_FILE_PATHS not set; skipping contract deployment');
    return;
  }

  const filePaths = parseFilePaths(rawPaths);
  if (filePaths.length === 0) throw new Error('OCP_TEST_DAR_FILE_PATHS was set but empty');

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
