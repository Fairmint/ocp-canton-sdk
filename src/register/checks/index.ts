/**
 * The register's off-ledger checks (design, "What moves off the ledger"): ceilings, orphaned references, the lifecycle
 * of warrants, convertibles and equity compensation, the ledger date (`checkWrite`, which `RegisterWriter` runs on
 * every Apply and Restate under its locks), and the split procedure with its class check (`recordSplit`).
 */

export { recordSplit, splitOffenders } from './splits';
export { checkWrite, writeViolations } from './write';
