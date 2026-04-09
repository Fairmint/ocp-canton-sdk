/**
 * Deploy DAML contracts to LocalNet (manual / debugging). Integration tests deploy via the harness.
 *
 * DAR: `@fairmint/open-captable-protocol-daml-js/openCapTableDarPath` — packaged file, or sibling daml repo
 * when `siblingSearchFrom` is this repo root.
 */

import * as path from 'path';

import { resolveOpenCapTableDarPath } from '@fairmint/open-captable-protocol-daml-js/openCapTableDarPath';
import { createLedgerJsonApiClient } from '../../test/utils/cantonNodeSdkCompat';

import { buildQuickstartClientConfig, waitForLedgerJsonApiReady } from './waitForReady';

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '../..');
  const darPath = resolveOpenCapTableDarPath({ siblingSearchFrom: repoRoot });
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
