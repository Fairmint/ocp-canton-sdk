#!/usr/bin/env node
/**
 * CI guard: keep @fairmint/open-captable-protocol-daml-js at the minimum that ships the DAR resolver API
 * on the `openCapTableDarPath` subpath (resolveOpenCapTableDarPath, OPEN_CAP_TABLE_DAR_PATH_ENV). Root entry is
 * browser-safe (no fs). Bump MIN when the API changes.
 *
 * @see Fairmint/open-captable-protocol-daml GitHub Wiki for usage docs (not in-repo markdown).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_EXACT_DEV = '0.2.160';
const MIN_PEER_PREFIX = '>=0.2.160';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const dev = pkg.devDependencies?.['@fairmint/open-captable-protocol-daml-js'];
if (dev !== MIN_EXACT_DEV) {
  console.error(
    `assert-min-open-captable-daml-js: expected devDependencies @fairmint/open-captable-protocol-daml-js === "${MIN_EXACT_DEV}", got ${JSON.stringify(dev)}`
  );
  process.exit(1);
}

const peer = pkg.peerDependencies?.['@fairmint/open-captable-protocol-daml-js'];
if (typeof peer !== 'string' || !peer.startsWith(MIN_PEER_PREFIX)) {
  console.error(
    `assert-min-open-captable-daml-js: expected peerDependencies range to start with "${MIN_PEER_PREFIX}", got ${JSON.stringify(peer)}`
  );
  process.exit(1);
}

console.log(`OK: open-captable-protocol-daml-js dev ${MIN_EXACT_DEV}, peer ${peer}`);
