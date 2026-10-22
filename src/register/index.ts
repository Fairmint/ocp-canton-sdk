/**
 * The OpenCapTable-v35 register's rules, computed off the ledger exactly as the ledger computes them: its caps,
 * derived IDs, claim hashes and shards, the shared floor function, split stepping and vesting.
 *
 * The root exports this module as the `register` namespace; the native ledger-state types it operates on are root
 * exports (`StockSecurityState`, `RecordedSplit`, ...).
 */

export * from './caps';
export * from './ids';
export * from './numeric';
export * from './splits';
export * from './vesting';
