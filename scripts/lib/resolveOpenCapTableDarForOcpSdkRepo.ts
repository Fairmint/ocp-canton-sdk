/**
 * OCP SDK repo root → OpenCapTable DAR via daml-js (packaged DAR or sibling `open-captable-protocol-daml`).
 * Keeps `siblingSearchFrom` in one place for quickstart + integration tests.
 */
import * as path from 'path';

import { resolveOpenCapTableDarPath } from '@fairmint/open-captable-protocol-daml-js/openCapTableDarPath';

export function resolveOpenCapTableDarForOcpSdkRepo(): string {
  const repoRoot = path.resolve(__dirname, '..', '..');
  return resolveOpenCapTableDarPath({ siblingSearchFrom: repoRoot });
}
