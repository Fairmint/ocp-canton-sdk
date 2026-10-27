/**
 * Derived OCF IDs, the hashes that claimed IDs are kept unique by, and the `OcfIdShard` partition they are claimed
 * in (a port of `Fairmint.OpenCapTable.Ids` and the claim and shard rules of `Fairmint.OpenCapTable.Book`).
 *
 * The shared test vectors (`test-vectors/v35.json` in open-captable-protocol-daml) pin both encodings.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Ids.daml
 */

import { createHash } from 'node:crypto';

import { OcpErrorCodes } from '../errors/codes';
import { OcpValidationError } from '../errors/OcpValidationError';
import type { ClaimedShards, DeriveIdInput, DerivedRole, IdNamespace, ShardStep } from '../types/register';
import { MAX_HASHES_PER_SHARD } from './caps';

/** The fixed vocabulary of derived-ID roles, by tag, in the ledger's constructor order. */
export const DERIVED_ROLES: readonly DerivedRole[] = [
  'event',
  'hold',
  'hold_cancellation',
  'resulting_issuance',
  'resulting_security',
  'balance_issuance',
  'balance_security',
];

/** The length of a shard's prefix at creation: the cap table starts with one shard per 8-bit prefix. */
const INITIAL_PREFIX_BITS = 8;
/** The bits of a SHA-256 hash, the deepest a shard prefix can go. */
const HASH_BITS = 256;
const CLAIM_HASH_PATTERN = /^[0-9a-f]{64}$/;
const HEX_DIGIT_PATTERN = /^[0-9a-f]*$/;
const LONE_SURROGATE_PATTERN = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** The 256 8-bit shard prefixes `"00000000"` … `"11111111"`, in order: the shards a new cap table starts with. */
export const INITIAL_SHARD_PREFIXES: readonly string[] = Array.from({ length: 256 }, (_, n) =>
  n.toString(2).padStart(INITIAL_PREFIX_BITS, '0')
);

/** Security roles derive security IDs; every other role derives an object ID. */
export function roleNamespace(role: DerivedRole): IdNamespace {
  return role === 'resulting_security' || role === 'balance_security' ? 'security' : 'object';
}

function requireWellFormed(text: string, fieldPath: string): void {
  if (LONE_SURROGATE_PATTERN.test(text)) {
    throw new OcpValidationError(fieldPath, 'Is not well-formed Unicode text', {
      receivedValue: text,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }
}

/** The number of bytes of the text's UTF-8 encoding. */
export function utf8Length(text: string): number {
  requireWellFormed(text, 'text');
  return Buffer.byteLength(text, 'utf8');
}

/**
 * An injective encoding of a list of fields: each field is its UTF-8 byte length in decimal, a colon and the field
 * itself.
 *
 * @throws OcpValidationError when a field is not well-formed Unicode, which no Daml `Text` can hold
 */
export function encodeFields(fields: readonly string[]): string {
  return fields
    .map((field, index) => {
      requireWellFormed(field, `fields[${index}]`);
      return `${Buffer.byteLength(field, 'utf8')}:${field}`;
    })
    .join('');
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function requireCount(value: number, fieldPath: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new OcpValidationError(fieldPath, 'Expected a non-negative safe integer', {
      expectedType: 'non-negative safe integer',
      receivedValue: value,
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
}

/**
 * The ID an event on a stock state derives: the cap table ID, a colon and the lowercase hex SHA-256 of the encoding
 * of (namespace tag, cap table ID, security ID, seq, role, index), where `seq` is the state's `seq` before the event.
 * Each (security ID, seq) is consumed once, so derived IDs are unique with no state, a retry derives the same IDs,
 * and the TA can compute them before it submits.
 *
 * @throws OcpValidationError when `seq` or `index` is not a non-negative safe integer or the role is unknown
 */
export function deriveId(input: DeriveIdInput): string {
  const { capTableId, securityId, seq, role, index } = input;
  requireCount(seq, 'deriveId.seq');
  requireCount(index, 'deriveId.index');
  if (!DERIVED_ROLES.includes(role)) {
    throw new OcpValidationError('deriveId.role', 'Unknown derived-ID role', {
      expectedType: DERIVED_ROLES.join(' | '),
      receivedValue: role,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  const encoding = encodeFields([roleNamespace(role), capTableId, securityId, String(seq), role, String(index)]);
  return `${capTableId}:${sha256Hex(encoding)}`;
}

/**
 * Whether an ID has this book's derived form (its cap table ID and a colon). No claim accepts one, so claimed and
 * derived IDs never meet, and `CapTable_Restate` refuses to edit or delete a record under one.
 */
export function isDerivedForm(capTableId: string, id: string): boolean {
  return id.startsWith(`${capTableId}:`);
}

/**
 * The hash a claimed ID is recorded under in its `OcfIdShard`: the lowercase hex SHA-256 of the encoding of
 * (namespace tag, ID), so equal text in the two namespaces never collides.
 */
export function claimHash(namespace: IdNamespace, id: string): string {
  return sha256Hex(encodeFields([namespace, id]));
}

/**
 * The bit string of a lowercase hex hash, 4 bits per hex digit, most significant first, as `0` and `1` characters.
 * Shard prefixes are prefixes of it.
 *
 * @throws OcpValidationError on any character that is not a lowercase hex digit, as the ledger refuses one
 */
export function hashBits(hash: string): string {
  if (!HEX_DIGIT_PATTERN.test(hash)) {
    throw new OcpValidationError('hash', 'Expected lowercase hex digits', {
      expectedType: 'lowercase hex string',
      receivedValue: hash,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }
  let bits = '';
  for (const digit of hash) bits += parseInt(digit, 16).toString(2).padStart(4, '0');
  return bits;
}

function requireClaimHash(hash: string): string {
  if (!CLAIM_HASH_PATTERN.test(hash)) {
    throw new OcpValidationError('hash', 'Expected a claim hash: 64 lowercase hex digits', {
      expectedType: 'SHA-256 as 64 lowercase hex digits',
      receivedValue: hash,
      code: OcpErrorCodes.INVALID_FORMAT,
    });
  }
  return hashBits(hash);
}

/**
 * The prefix of the shard that covers a hash: the shortest prefix of its bit string, of at least 8 bits, that the
 * given shards have. Active shards partition the hash space, so it is the only one. `null` when none covers it, as a
 * write whose inputs miss the covering shard fails.
 */
export function coveringShardPrefix(hash: string, prefixes: { has(prefix: string): boolean }): string | null {
  const bits = hashBits(hash);
  for (let length = INITIAL_PREFIX_BITS; length <= bits.length; length++) {
    const prefix = bits.slice(0, length);
    if (prefixes.has(prefix)) return prefix;
  }
  return null;
}

function bitOf(hash: string, index: number): string {
  const bit = hashBits(hash.charAt(Math.floor(index / 4))).charAt(index % 4);
  if (bit === '') throw new OcpValidationError('hash', 'partitionByBit: bit index out of range');
  return bit;
}

// Splits a shard's hashes by the bit after its prefix.
function partitionByBit(index: number, claimed: ReadonlySet<string>): [Set<string>, Set<string>] {
  const zeros = new Set<string>();
  const ones = new Set<string>();
  for (const hash of claimed) (bitOf(hash, index) === '0' ? zeros : ones).add(hash);
  return [zeros, ones];
}

// The shards a full shard splits into: by the next bit, again in each child that still holds more than 64.
function splitShard(prefix: string, claimed: ReadonlySet<string>): Array<[string, ReadonlySet<string>]> {
  const [zeros, ones] = partitionByBit(prefix.length, claimed);
  return [...splitChild(`${prefix}0`, zeros), ...splitChild(`${prefix}1`, ones)];
}

function splitChild(prefix: string, claimed: ReadonlySet<string>): Array<[string, ReadonlySet<string>]> {
  return claimed.size <= MAX_HASHES_PER_SHARD ? [[prefix, claimed]] : splitShard(prefix, claimed);
}

function coveringShard(shards: ClaimedShards, hash: string, bits: string): [string, ReadonlySet<string>] {
  for (let length = INITIAL_PREFIX_BITS; length <= bits.length; length++) {
    const prefix = bits.slice(0, length);
    const claimed = shards.get(prefix);
    if (claimed !== undefined) return [prefix, claimed];
  }
  throw new OcpValidationError('hash', `no shard in this write covers the hash ${hash}`, {
    code: OcpErrorCodes.CONTRACT_NOT_FOUND,
  });
}

function replaceShard(shards: ClaimedShards, consumed: string, parts: Array<[string, ReadonlySet<string>]>): ShardStep {
  const next = new Map(shards);
  next.delete(consumed);
  for (const [prefix, claimed] of parts) next.set(prefix, claimed);
  return { shards: next, consumed, created: parts.map(([prefix]) => prefix) };
}

/**
 * Claims a hash in the shard of the working set that covers it, as `CapTable_Apply` and `CapTable_Restate` do. The
 * shard is archived and recreated with the hash; one that would hold a 65th hash splits by the next bit instead,
 * again in a child that still holds more than 64, so each extra level creates one empty sibling. The given shards
 * are not changed.
 *
 * @throws OcpValidationError when the hash is not 64 lowercase hex digits, no shard covers it, or it is already claimed
 */
export function simulateClaim(shards: ClaimedShards, hash: string): ShardStep {
  const [prefix, claimed] = coveringShard(shards, hash, requireClaimHash(hash));
  if (claimed.has(hash)) {
    throw new OcpValidationError('hash', `already used: ${hash} is claimed in shard ${prefix}`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  const next = new Set(claimed).add(hash);
  return replaceShard(shards, prefix, next.size <= MAX_HASHES_PER_SHARD ? [[prefix, next]] : splitShard(prefix, next));
}

/**
 * Releases a claimed hash, as a restatement does for the ID of a record it deletes: its shard is archived and
 * recreated without it. Shards never merge. The given shards are not changed.
 *
 * @throws OcpValidationError when the hash is not 64 lowercase hex digits, no shard covers it, or it is not claimed
 */
export function simulateRelease(shards: ClaimedShards, hash: string): ShardStep {
  const [prefix, claimed] = coveringShard(shards, hash, requireClaimHash(hash));
  if (!claimed.has(hash)) {
    throw new OcpValidationError('hash', `${hash} is not claimed`, { code: OcpErrorCodes.OUT_OF_RANGE });
  }
  const next = new Set(claimed);
  next.delete(hash);
  return replaceShard(shards, prefix, [[prefix, next]]);
}

/**
 * Splits a shard by its next bit regardless of fill, as a large book's replication pre-splits the 256 initial
 * shards. The given shards are not changed.
 *
 * @throws OcpValidationError when the working set has no shard with the prefix, or it is already 256 bits long
 */
export function simulatePreSplit(shards: ClaimedShards, prefix: string): ShardStep {
  const claimed = shards.get(prefix);
  if (claimed === undefined) {
    throw new OcpValidationError('prefix', `no shard with prefix ${prefix} in this write`, {
      code: OcpErrorCodes.CONTRACT_NOT_FOUND,
    });
  }
  if (prefix.length >= HASH_BITS) {
    throw new OcpValidationError('prefix', `shard ${prefix} cannot split further`, {
      code: OcpErrorCodes.OUT_OF_RANGE,
    });
  }
  const [zeros, ones] = partitionByBit(prefix.length, claimed);
  return replaceShard(shards, prefix, [
    [`${prefix}0`, zeros],
    [`${prefix}1`, ones],
  ]);
}
