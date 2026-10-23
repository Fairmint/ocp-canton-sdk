/**
 * The OpenCapTable-v35 register's rules, computed off the ledger exactly as the ledger computes them: its caps,
 * derived IDs, claim hashes and shards, the shared floor function, split stepping, vesting and the arithmetic of a
 * settlement's draw (`planDraw`); its reader, which admits only genuine register contracts and keeps each book's
 * keys in a {@link RegisterIndex}; and the inputs resolution and batch sizing a writer runs over that index
 * (`resolveInputs`, `planBatches`).
 *
 * The root exports this module as the `register` namespace; the native ledger-state types it operates on are root
 * exports (`StockSecurityState`, `RecordedSplit`, `RegisterRecord`, ...).
 */

export { admitContract, type AdmissionResult, type AdmitContractOptions } from './admission';
export * from './caps';
export * from './draw';
export * from './ids';
export * from './inputs';
export * from './numeric';
export * from './reader';
export * from './registerIndex';
export * from './sizing';
export * from './splits';
export * from './vesting';
