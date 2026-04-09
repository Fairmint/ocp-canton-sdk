/**
 * Resolve the OpenCapTable DAR shipped inside `@fairmint/open-captable-protocol-daml-js` via npm `exports`
 * (`./opencaptable.dar` → `published-dars/OpenCapTable.dar`).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Subpath resolved through package `exports` (single source of truth for consumers in this repo). */
export const OPEN_CAP_TABLE_DAR_SPEC = '@fairmint/open-captable-protocol-daml-js/opencaptable.dar' as const;

const MIN_DAML_JS = '0.2.152';

export interface RequireResolve {
  resolve: (request: string) => string;
}

function darMissingMessage(cause: 'resolve' | 'disk', detail?: string): string {
  const base =
    `OpenCapTable DAR (${OPEN_CAP_TABLE_DAR_SPEC}).\n` +
    `Install @fairmint/open-captable-protocol-daml-js >= ${MIN_DAML_JS}.`;
  if (cause === 'resolve') {
    return `Could not resolve ${OPEN_CAP_TABLE_DAR_SPEC}.\n${base}${detail ? `\n${detail}` : ''}`;
  }
  return `OpenCapTable DAR missing on disk: ${detail ?? '(unknown path)'}\n${base}`;
}

/**
 * Resolve DAR from the installed npm package; throw if the export is missing or the file is absent.
 */
export function requireOpenCapTableDarPath(resolveFrom: RequireResolve): string {
  let darPath: string;
  try {
    darPath = resolveFrom.resolve(OPEN_CAP_TABLE_DAR_SPEC);
  } catch (e) {
    throw new Error(darMissingMessage('resolve', e instanceof Error ? e.message : undefined));
  }
  if (!fs.existsSync(darPath)) {
    throw new Error(darMissingMessage('disk', darPath));
  }
  return darPath;
}

/**
 * Try npm export, then sibling `open-captable-protocol-daml/published-dars/OpenCapTable.dar` (monorepo dev).
 *
 * @param projectRoot - Absolute path to the repo root (e.g. `path.resolve(__dirname, '../../..')` from `test/integration/setup`).
 */
export function tryOpenCapTableDarPath(resolveFrom: RequireResolve, projectRoot: string): string | null {
  try {
    const darPath = resolveFrom.resolve(OPEN_CAP_TABLE_DAR_SPEC);
    if (fs.existsSync(darPath)) {
      return darPath;
    }
  } catch {
    // e.g. linked / pre-export package
  }

  const sibling = path.join(projectRoot, '../open-captable-protocol-daml/published-dars/OpenCapTable.dar');
  return fs.existsSync(sibling) ? sibling : null;
}

export function openCapTableDarNotFoundHelp(): string {
  return (
    `Could not find OpenCapTable DAR. Install @fairmint/open-captable-protocol-daml-js >= ${MIN_DAML_JS}, ` +
    'or run `npm run codegen` in a sibling open-captable-protocol-daml clone (published-dars/OpenCapTable.dar).'
  );
}
