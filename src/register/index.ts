/**
 * The OpenCapTable-v35 register's rules, computed off the ledger exactly as the ledger computes them: its caps,
 * derived IDs, claim hashes and shards, the shared floor function, split stepping, vesting and the arithmetic of a
 * settlement's draw (`planDraw`); its reader, which admits only genuine register contracts and keeps each book's
 * keys in a {@link RegisterIndex}; the inputs resolution and batch sizing a writer runs over that index
 * (`resolveInputs`, `planBatches`); the one writer per issuer (`RegisterWriter`) with its scoped locks
 * (`writeScopes`, `InProcessLockProvider`); the off-ledger checks it runs under those locks (`checkWrite`) and the split
 * procedure (`recordSplit`); and the offline replay of a book's OCF under the v35 rules (`replayOcf`).
 *
 * The root exports this module as the `register` namespace; the native ledger-state types it operates on are root
 * exports (`StockSecurityState`, `RecordedSplit`, `RegisterRecord`, ...).
 */

export { admitContract, type AdmissionResult, type AdmitContractOptions } from './admission';
export * from './caps';
export * from './checks';
export * from './draw';
export * from './ids';
export * from './inputs';
export * from './locks';
export * from './numeric';
export * from './reader';
export * from './registerIndex';
export * from './replay';
export * from './sizing';
export * from './splits';
export * from './vesting';
export * from './writer';
export * from './writerScopes';
