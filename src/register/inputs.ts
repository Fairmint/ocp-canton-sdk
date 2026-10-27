/**
 * Book inputs resolution for OpenCapTable-v35 writes: the existing contracts one write must pass, computed from a key
 * index by running the write's bookkeeping as the ledger runs it (`Apply.daml`, `Restate.daml`, `Holds.daml`,
 * `Events.daml`, `Book.daml`).
 *
 * Operations name everything by OCF ID, so the ledger reads only what the write's `BookInputs` give it:
 *
 * - states: every state an event consumes or reads (a source, a consolidation's inputs, the lot of a stock vesting
 *   record, acceptance, retraction or snapshot, a hold's, settlement's or cancellation's lot). A security an earlier
 *   operation of the write creates needs none.
 * - epochs: the class of every stock state the write creates or changes (a primary issuance, each output issuance's
 *   class, a source's class, a restated state's old and new class) and the class of a split. A class the write creates
 *   needs none.
 * - shards: for each ID the write claims or releases, the shard that covers its claim hash, in the partition as the
 *   write's earlier claims leave it (a claim into a shard an earlier claim created needs none). An ID an event writes
 *   is claimed unless it is the ID derived for its role from the state's `seq` at that point of the write.
 * - records: what each record's references point at (an object, the issuance carrying a security, a plan, a class,
 *   the vesting terms behind a security, the warrant or convertible issuance with a trigger, a split), unless the write
 *   creates it, and the records a restatement edits or deletes.
 *
 * Holds and draws fetch the lot's origin issuance, and a settlement an existing buyer's stakeholder, by contract ID
 * outside the inputs; resolution supplies those too.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Book.daml
 */

import type { OcfDataTypeFor, OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import { convertToDaml } from '../functions/OpenCapTable/capTable/ocfToDaml';
import type { BookWrite, RegisterRequirement, ResolvedInputs } from '../types/register';
import { IndexView, simulateWrite } from './bookSimulation';
import { requirementsOfRecord } from './references';
import type { RegisterIndex } from './registerIndex';
import { exceededLimits, type SizingOptions } from './sizing';

/**
 * Resolve the inputs of one write from its book's key index, current at the write's submission.
 *
 * The index must hold record payloads (read without `retainPayloads: false`) where the write's rules read a record:
 * a restatement's edit and delete targets, the issuance and vesting terms behind a vesting record, the origin of a
 * hold or draw.
 *
 * @returns the inputs, the IDs the write claims and releases, the origin issuances and buyer a settlement or hold
 * fetches, and the write's usage of each per-transaction cap, with the limits it exceeds
 * @throws OcpValidationError for an operation the SDK cannot encode, and with the ledger's message where the index
 * already shows the ledger would refuse the write: an ID it claims is already used or has this book's derived form, a
 * reference points at no record (or one of another type), a state, epoch or shard it needs is not on the book, or a
 * restatement targets a record the register wrote
 */
export function resolveInputs(index: RegisterIndex, write: BookWrite, options: SizingOptions = {}): ResolvedInputs {
  const simulation = simulateWrite(new IndexView(index), write);
  const usage = simulation.usage();
  return {
    inputs: simulation.inputs(),
    claimed: simulation.claimed.map((claim) => ({ ...claim })),
    released: simulation.released.map((release) => ({ ...release })),
    originIssuances: new Map(simulation.originIssuances),
    buyer: simulation.buyer,
    usage,
    exceeded: exceededLimits(write.kind, usage, options),
  };
}

/**
 * Every reference a record makes, as the ledger checks it when the record is written (`References.requirementsOf`).
 * Stock events on a state make none for their source and outputs; the hold pair makes none.
 *
 * @throws OcpValidationError or OcpParseError when the data does not convert to its generated record
 */
export function requirementsOf<EntityType extends OcfEntityType>(
  entityType: EntityType,
  data: OcfDataTypeFor<EntityType>
): RegisterRequirement[] {
  if (entityType === 'stockHold' || entityType === 'stockHoldCancellation') return [];
  // The entity kind and its data are correlated by the signature; the union cannot be re-correlated by type.
  return requirementsOfRecord(convertToDaml(entityType, data as never));
}
