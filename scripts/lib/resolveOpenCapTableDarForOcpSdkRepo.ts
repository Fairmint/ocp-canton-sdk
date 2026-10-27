/**
 * OCP SDK repo root → the two OpenCapTable DARs via daml-js (packaged DARs or sibling `open-captable-protocol-daml`).
 * Keeps `siblingSearchFrom` in one place for quickstart + integration tests.
 *
 * OpenCapTable-v35 data-depends on the reader interfaces (OpenCapTableApi-v01), so a ledger needs both, interfaces first.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  getOpenCapTableApiDarPath,
  resolveOpenCapTableDarPath,
} from '@fairmint/open-captable-protocol-daml-js/openCapTableDarPath';

/** The OpenCapTableApi-v01 DAR: the packaged one, else a sibling checkout's staged DAR. */
function resolveOpenCapTableApiDar(repoRoot: string): string {
  try {
    return getOpenCapTableApiDarPath();
  } catch (packagedCause) {
    const sibling = path.join(repoRoot, '..', 'open-captable-protocol-daml', 'published-dars', 'OpenCapTableApi.dar');
    if (fs.existsSync(sibling)) {
      return sibling;
    }
    throw packagedCause;
  }
}

/**
 * The OpenCapTable DARs to upload, in upload order: OpenCapTableApi-v01, then OpenCapTable-v35 (the same order as
 * `getOpenCapTableDarPaths()`; `OPEN_CAP_TABLE_DAR_PATH` still overrides the OpenCapTable-v35 DAR).
 */
export function resolveOpenCapTableDarsForOcpSdkRepo(): string[] {
  const repoRoot = path.resolve(__dirname, '..', '..');
  return [resolveOpenCapTableApiDar(repoRoot), resolveOpenCapTableDarPath({ siblingSearchFrom: repoRoot })];
}
