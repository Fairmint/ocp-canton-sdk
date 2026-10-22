/**
 * The OpenCapTable-v35 register's rules, computed off the ledger exactly as the ledger computes them: its caps,
 * derived IDs, claim hashes and shards, the shared floor function, split stepping and vesting; and its reader, which
 * admits only genuine register contracts and keeps each book's keys in a {@link RegisterIndex}.
 *
 * The root exports this module as the `register` namespace; the native ledger-state types it operates on are root
 * exports (`StockSecurityState`, `RecordedSplit`, `RegisterRecord`, ...).
 */

export { admitContract, type AdmissionResult, type AdmitContractOptions } from './admission';
export * from './caps';
export * from './ids';
export * from './numeric';
export * from './reader';
export * from './registerIndex';
export * from './splits';
export * from './vesting';
