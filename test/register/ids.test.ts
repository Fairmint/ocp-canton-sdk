import fc from 'fast-check';

import { OcpValidationError } from '../../src/errors';
import {
  claimHash,
  coveringShardPrefix,
  DERIVED_ROLES,
  deriveId,
  encodeFields,
  hashBits,
  INITIAL_SHARD_PREFIXES,
  isDerivedForm,
  MAX_HASHES_PER_SHARD,
  roleNamespace,
  simulateClaim,
  simulatePreSplit,
  simulateRelease,
  utf8Length,
} from '../../src/register';
import type { ClaimedShards, DerivedRole, IdNamespace, ShardStep } from '../../src/types/register';
import vectors from '../fixtures/register/v35-test-vectors.json';

function asRole(role: string): DerivedRole {
  const found = DERIVED_ROLES.find((candidate) => candidate === role);
  if (found === undefined) throw new Error(`unknown role in the shared vectors: ${role}`);
  return found;
}

function asNamespace(namespace: string): IdNamespace {
  if (namespace !== 'object' && namespace !== 'security') throw new Error(`unknown namespace: ${namespace}`);
  return namespace;
}

/** The 256 initial shards, empty. */
function initialShards(): Map<string, ReadonlySet<string>> {
  return new Map(INITIAL_SHARD_PREFIXES.map((prefix) => [prefix, new Set<string>()]));
}

/** A synthetic claim hash: the given leading hex digits, padded with a counter to 64 digits. */
function syntheticHash(leading: string, n: number): string {
  return `${leading}${n.toString(16).padStart(64 - leading.length, '0')}`;
}

/** The invariants of `validateOcfIdShard` and of a partition: every hash in exactly one shard, under its prefix. */
function expectPartition(shards: ClaimedShards, claimed: Iterable<string>): void {
  const prefixes = [...shards.keys()];
  for (const prefix of prefixes) {
    expect(prefix).toMatch(/^[01]{8,256}$/);
    expect(prefixes.filter((other) => other !== prefix && other.startsWith(prefix))).toEqual([]);
    const hashes = shards.get(prefix) ?? new Set<string>();
    expect(hashes.size).toBeLessThanOrEqual(MAX_HASHES_PER_SHARD);
    for (const hash of hashes) expect(hashBits(hash).startsWith(prefix)).toBe(true);
  }
  for (const hash of claimed) {
    const bits = hashBits(hash);
    const covering = prefixes.filter((prefix) => bits.startsWith(prefix));
    expect(covering).toHaveLength(1);
    expect(shards.get(covering[0] ?? '')?.has(hash)).toBe(true);
  }
}

describe('derived IDs (shared vectors)', () => {
  test.each(vectors.derived_ids)('$role of $security_id at seq $seq, index $index', (vector) => {
    const role = asRole(vector.role);
    expect(
      encodeFields([
        roleNamespace(role),
        vector.cap_table_id,
        vector.security_id,
        String(vector.seq),
        role,
        String(vector.index),
      ])
    ).toBe(vector.encoding);
    expect(
      deriveId({
        capTableId: vector.cap_table_id,
        securityId: vector.security_id,
        seq: vector.seq,
        role,
        index: vector.index,
      })
    ).toBe(vector.id);
  });

  test('isDerivedForm recognizes the book’s own derived form only', () => {
    const [first] = vectors.derived_ids;
    if (first === undefined) throw new Error('no derived-ID vectors');
    expect(isDerivedForm(first.cap_table_id, first.id)).toBe(true);
    expect(isDerivedForm(first.cap_table_id, `${first.cap_table_id}0:abc`)).toBe(false);
    expect(isDerivedForm('test-1', 'test-10:abc')).toBe(false);
    // Another cap table's derived form is an ordinary ID here.
    expect(isDerivedForm('test-2', first.id)).toBe(false);
  });

  test('the two security roles derive security IDs, the others object IDs', () => {
    expect(DERIVED_ROLES.filter((role) => roleNamespace(role) === 'security')).toEqual([
      'resulting_security',
      'balance_security',
    ]);
  });

  test('rejects a seq or index that is not a non-negative safe integer, and an unknown role', () => {
    const input = { capTableId: 'test-1', securityId: 'S-A1', seq: 0, role: 'event' as const, index: 0 };
    expect(() => deriveId({ ...input, seq: -1 })).toThrow(OcpValidationError);
    expect(() => deriveId({ ...input, seq: 1.5 })).toThrow(OcpValidationError);
    expect(() => deriveId({ ...input, index: Number.MAX_SAFE_INTEGER + 1 })).toThrow(OcpValidationError);
    expect(() => deriveId({ ...input, role: asRole('event').toUpperCase() as DerivedRole })).toThrow(
      'Unknown derived-ID role'
    );
  });

  test('a derived ID differs in every field it encodes', () => {
    const base = { capTableId: 'test-1', securityId: 'S-A1', seq: 0, role: 'event' as const, index: 0 };
    const ids = new Set([
      deriveId(base),
      deriveId({ ...base, capTableId: 'test-2' }),
      deriveId({ ...base, securityId: 'S-A2' }),
      deriveId({ ...base, seq: 1 }),
      deriveId({ ...base, role: 'hold' }),
      deriveId({ ...base, index: 1 }),
    ]);
    expect(ids.size).toBe(6);
  });
});

describe('field encoding', () => {
  test('counts UTF-8 bytes, not UTF-16 code units', () => {
    expect(utf8Length('S-A1')).toBe(4);
    expect(utf8Length('Ünïcødé-é')).toBe(14);
    expect(utf8Length('名前')).toBe(6);
    expect(utf8Length('😀')).toBe(4);
    expect(encodeFields(['', 'a:b'])).toBe('0:3:a:b');
  });

  test('is injective where plain concatenation is not', () => {
    expect(encodeFields(['ab', 'c'])).not.toBe(encodeFields(['a', 'bc']));
  });

  test('rejects text no Daml Text can hold', () => {
    expect(() => utf8Length('\uD800')).toThrow(OcpValidationError);
    expect(() => encodeFields(['ok', 'x\uDC00'])).toThrow('fields[1]');
  });
});

describe('claim hashes (shared vectors)', () => {
  test.each(vectors.claim_hashes)('$namespace $id', (vector) => {
    const namespace = asNamespace(vector.namespace);
    expect(encodeFields([namespace, vector.id])).toBe(vector.encoding);
    expect(claimHash(namespace, vector.id)).toBe(vector.hash);
    expect(hashBits(vector.hash).slice(0, 8)).toBe(vector.shard_prefix_8);
    expect(coveringShardPrefix(vector.hash, new Set(INITIAL_SHARD_PREFIXES))).toBe(vector.shard_prefix_8);
  });

  test('equal text in the two namespaces never collides', () => {
    expect(claimHash('object', 'S-A1')).not.toBe(claimHash('security', 'S-A1'));
  });

  test('a hash has 256 bits, most significant first', () => {
    expect(hashBits(claimHash('object', 'x'))).toHaveLength(256);
    expect(hashBits('0a5f')).toBe('0000101001011111');
    expect(() => hashBits('0A')).toThrow(OcpValidationError);
    expect(() => hashBits('0g')).toThrow(OcpValidationError);
  });
});

describe('shards', () => {
  test('a cap table starts with the 256 8-bit prefixes, in order', () => {
    expect(INITIAL_SHARD_PREFIXES).toHaveLength(256);
    expect(INITIAL_SHARD_PREFIXES[0]).toBe('00000000');
    expect(INITIAL_SHARD_PREFIXES[255]).toBe('11111111');
    expect([...INITIAL_SHARD_PREFIXES].sort()).toEqual(INITIAL_SHARD_PREFIXES);
    expect(new Set(INITIAL_SHARD_PREFIXES).size).toBe(256);
  });

  test('the covering shard is the shortest prefix of at least 8 bits the working set has', () => {
    const hash = syntheticHash('a5', 1);
    expect(coveringShardPrefix(hash, new Set(['10100101']))).toBe('10100101');
    expect(coveringShardPrefix(hash, new Set(['101001010', '101001011']))).toBe('101001010');
    expect(coveringShardPrefix(hash, new Set(['1010010', '10100100']))).toBeNull();
  });

  test('a claim rewrites only its own shard', () => {
    const shards = initialShards();
    const hash = claimHash('object', 'SH-NEW');
    const step = simulateClaim(shards, hash);
    const prefix = hashBits(hash).slice(0, 8);
    expect(step.consumed).toBe(prefix);
    expect(step.created).toEqual([prefix]);
    expect([...(step.shards.get(prefix) ?? [])]).toEqual([hash]);
    expect(step.shards.size).toBe(256);
    // The working set given is not changed.
    expect(shards.get(prefix)?.size).toBe(0);
  });

  test('the 65th hash splits a shard by the next bit (the ledger scenario’s 65 stakeholder IDs)', () => {
    const splitIds = [
      0, 230, 247, 255, 311, 543, 1349, 1578, 1708, 1857, 2366, 3695, 4139, 4231, 5192, 5235, 5372, 7154, 7234, 7279,
      7285, 7732, 7802, 8033, 8058, 8166, 9353, 9695, 9964, 10398, 10467, 10552, 10632, 10884, 10964, 11005, 11048,
      11065, 11255, 11409, 11519, 11831, 12354, 12558, 12867, 12999, 13064, 13265, 13442, 13601, 14152, 14558, 14851,
      15005, 15814, 16085, 17103, 17233, 17504, 17892, 17900, 18016, 18280, 18476, 18529,
    ].map((n) => `SH-SPLIT-${n}`);
    const hashes = splitIds.map((id) => claimHash('object', id));
    expect(hashes.every((hash) => hashBits(hash).startsWith('11101011'))).toBe(true);

    let shards: ClaimedShards = initialShards();
    const created: string[][] = [];
    for (const hash of hashes) {
      const step = simulateClaim(shards, hash);
      created.push(step.created);
      ({ shards } = step);
    }
    // 64 claims rewrite the shard in place; the 65th splits it into two.
    expect(created.slice(0, 64).every((prefixes) => prefixes.length === 1 && prefixes[0] === '11101011')).toBe(true);
    expect(created[64]).toEqual(['111010110', '111010111']);
    expect(shards.size).toBe(257);
    expect((shards.get('111010110')?.size ?? 0) + (shards.get('111010111')?.size ?? 0)).toBe(65);
    expectPartition(shards, hashes);
    // Every claimed ID is still refused a second time, in whichever child now covers it.
    for (const hash of hashes) expect(() => simulateClaim(shards, hash)).toThrow('already used');
  });

  test('65 hashes that share the next bits recurse, creating one empty sibling per level', () => {
    // 64 hashes under 00000000 whose bits 8 to 10 are 0 (third hex digit 0 or 1), then a 65th like them.
    const hashes = Array.from({ length: 65 }, (_, n) => syntheticHash(n % 2 === 0 ? '000' : '001', n));
    let shards: ClaimedShards = initialShards();
    let last: ShardStep | undefined;
    for (const hash of hashes) {
      last = simulateClaim(shards, hash);
      ({ shards } = last);
    }
    expect(last?.consumed).toBe('00000000');
    expect(last?.created).toEqual(['000000000000', '000000000001', '00000000001', '0000000001', '000000001']);
    expect(shards.get('000000000000')?.size).toBe(33);
    expect(shards.get('000000000001')?.size).toBe(32);
    for (const empty of ['00000000001', '0000000001', '000000001']) expect(shards.get(empty)?.size).toBe(0);
    expectPartition(shards, hashes);
  });

  test('a claim never lands in two shards (fast-check)', () => {
    const hexDigit = fc.constantFrom(...'0123456789abcdef');
    const hash = fc
      .tuple(fc.constantFrom('00', '000', '0000', 'ff'), fc.string({ unit: hexDigit, minLength: 62, maxLength: 62 }))
      .map(([leading, rest]) => `${leading}${rest}`.slice(0, 64));
    fc.assert(
      fc.property(fc.uniqueArray(hash, { minLength: 1, maxLength: 300 }), (hashes) => {
        let shards: ClaimedShards = initialShards();
        let createdTotal = 0;
        for (const claimed of hashes) {
          const step = simulateClaim(shards, claimed);
          expect(shards.has(step.consumed)).toBe(true);
          expect(step.shards.has(step.consumed)).toBe(step.created.includes(step.consumed));
          createdTotal += step.created.length;
          ({ shards } = step);
        }
        expectPartition(shards, hashes);
        expect(createdTotal).toBeGreaterThanOrEqual(hashes.length);
      }),
      { numRuns: 25 }
    );
  });

  test('a release rewrites the covering shard without the hash; shards never merge', () => {
    // Under 00000000, with the next bit (the third hex digit's first) 0 for 33 of them and 1 for 32.
    const hashes = Array.from({ length: 65 }, (_, n) => syntheticHash(`00${(n % 16).toString(16)}`, n));
    let shards: ClaimedShards = initialShards();
    for (const hash of hashes) ({ shards } = simulateClaim(shards, hash));
    const before = [...shards.keys()].filter((prefix) => prefix.startsWith('00000000')).sort();
    expect(before).toHaveLength(2);

    const released = hashes[3] ?? '';
    const step = simulateRelease(shards, released);
    expect(step.created).toEqual([step.consumed]);
    expect(step.shards.get(step.consumed)?.has(released)).toBe(false);
    expect([...step.shards.keys()].filter((prefix) => prefix.startsWith('00000000')).sort()).toEqual(before);
    expect(() => simulateRelease(step.shards, released)).toThrow('is not claimed');
    // The released ID can be claimed again.
    expect(simulateClaim(step.shards, released).created).toEqual([step.consumed]);
  });

  test('a pre-split splits a shard by its next bit regardless of fill', () => {
    const { shards } = simulateClaim(initialShards(), syntheticHash('008', 1));
    const step = simulatePreSplit(shards, '00000000');
    expect(step.consumed).toBe('00000000');
    expect(step.created).toEqual(['000000000', '000000001']);
    expect(step.shards.get('000000000')?.size).toBe(0);
    expect(step.shards.get('000000001')?.size).toBe(1);
    expect(step.shards.size).toBe(257);
    expect(() => simulatePreSplit(step.shards, '00000000')).toThrow('no shard with prefix 00000000');
    expect(() => simulatePreSplit(new Map([['1'.repeat(256), new Set<string>()]]), '1'.repeat(256))).toThrow(
      'cannot split further'
    );
  });

  test('a write whose working set misses the covering shard fails', () => {
    const hash = claimHash('object', 'ISSUER-1');
    const shards = new Map([['00000000', new Set<string>()]]);
    expect(() => simulateClaim(shards, hash)).toThrow('no shard in this write covers');
    expect(() => simulateRelease(shards, hash)).toThrow('no shard in this write covers');
  });

  test('only a claim hash can be claimed', () => {
    expect(() => simulateClaim(initialShards(), 'abc')).toThrow('64 lowercase hex digits');
    expect(() => simulateClaim(initialShards(), syntheticHash('AB', 1))).toThrow(OcpValidationError);
  });
});
