/**
 * Extract full OCF data from Canton for verification and comparison.
 *
 * Provides utilities to fetch all OCF objects from Canton and transform them
 * into a manifest format for cap table processing.
 *
 * The returned manifest structure is compatible with external OCF processing tools
 * like buildCaptableInput/processCapTable from the fairmint/api repository.
 *
 * @module cantonOcfExtractor
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../errors/codes';
import { toSafeDiagnosticText } from '../errors/OcpError';
import { OcpValidationError } from '../errors/OcpValidationError';
import { getEntityAsOcf } from '../functions/OpenCapTable/capTable/damlToOcf';
import type { CapTableState } from '../functions/OpenCapTable/capTable/getCapTableState';
import { getIssuerAsOcf } from '../functions/OpenCapTable/issuer';
import type {
  OcfDocument,
  OcfIssuer,
  OcfStakeholder,
  OcfStockClass,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfValuation,
  OcfVestingTerms,
} from '../types/native';
import type { OcfTransaction } from '../types/output';
import {
  analyzeContractReadFailure,
  contractReadFailureCode,
  createDiagnosedContractReadError,
  type ContractReadOutcome,
} from './contractReadDiagnostics';
import { ledgerReadScope } from './readScope';
import { tryIsoDateToDateString } from './typeConversions';

// ===== Transaction Sorting =====
// These utilities define the SDK's canonical dependency-aware transaction order.
// The cap table engine processes transactions in array order, so sorting is critical.
// Exported for unit testing - sorting correctness is critical for cap table verification.

/**
 * Safe timestamp helper that can return null.
 * Used when we need to distinguish "missing" from "zero".
 */
export function getTimestampOrNull(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Number.isNaN(new Date(input).getTime()) ? null : input;
  }
  if (typeof input === 'string') {
    const ms = new Date(input).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Canonical minimum accepted by the public transaction sorter. */
export interface SortableOcfTransaction {
  readonly id: OcfTransaction['id'];
  readonly date: OcfTransaction['date'];
  readonly object_type: OcfTransaction['object_type'];
  readonly security_id?: string;
  readonly resulting_security_id?: string;
  readonly resulting_security_ids?: readonly string[];
  readonly balance_security_id?: string;
  readonly createdAt?: string | number;
  readonly created_at?: string | number;
}

/** Loose runtime boundary retained for diagnostic helpers that validate malformed input. */
interface TransactionSortCandidate {
  readonly id?: unknown;
  readonly date?: unknown;
  readonly object_type?: unknown;
  readonly security_id?: unknown;
  readonly resulting_security_id?: unknown;
  readonly resulting_security_ids?: unknown;
  readonly balance_security_id?: unknown;
  readonly createdAt?: unknown;
  readonly created_at?: unknown;
}

const ISSUANCE_OBJECT_TYPES = [
  'TX_STOCK_ISSUANCE',
  'TX_CONVERTIBLE_ISSUANCE',
  'TX_WARRANT_ISSUANCE',
  'TX_EQUITY_COMPENSATION_ISSUANCE',
] as const satisfies ReadonlyArray<OcfTransaction['object_type']>;
const ISSUANCE_OBJECT_TYPE_SET: ReadonlySet<string> = new Set(ISSUANCE_OBJECT_TYPES);

type ResultParentTransaction = Extract<
  OcfTransaction,
  { readonly resulting_security_id: string } | { readonly resulting_security_ids: readonly string[] }
>;
type ResultSecurityIdFieldByObjectType = {
  [Transaction in ResultParentTransaction as Transaction['object_type']]: Transaction extends {
    readonly resulting_security_id: string;
  }
    ? 'resulting_security_id'
    : 'resulting_security_ids';
};
type ResultParentObjectType = keyof ResultSecurityIdFieldByObjectType;

type OcfTransactionWithField<
  Field extends PropertyKey,
  Transaction extends OcfTransaction = OcfTransaction,
> = Transaction extends unknown ? (Field extends keyof Transaction ? Transaction : never) : never;
type BalanceSecurityParentTransaction = OcfTransactionWithField<'balance_security_id'>;
type BalanceSecurityParentObjectType = BalanceSecurityParentTransaction['object_type'];

const RESULT_SECURITY_ID_FIELD_BY_OBJECT_TYPE = {
  TX_CONVERTIBLE_CONVERSION: 'resulting_security_ids',
  TX_WARRANT_EXERCISE: 'resulting_security_ids',
  TX_EQUITY_COMPENSATION_EXERCISE: 'resulting_security_ids',
  TX_EQUITY_COMPENSATION_RELEASE: 'resulting_security_ids',
  TX_STOCK_TRANSFER: 'resulting_security_ids',
  TX_STOCK_CONVERSION: 'resulting_security_ids',
  TX_CONVERTIBLE_TRANSFER: 'resulting_security_ids',
  TX_WARRANT_TRANSFER: 'resulting_security_ids',
  TX_EQUITY_COMPENSATION_TRANSFER: 'resulting_security_ids',
  TX_STOCK_REISSUANCE: 'resulting_security_ids',
  TX_STOCK_CONSOLIDATION: 'resulting_security_id',
} as const satisfies ResultSecurityIdFieldByObjectType;
const RESULT_PARENT_OBJECT_TYPE_SET: ReadonlySet<string> = new Set(
  Object.keys(RESULT_SECURITY_ID_FIELD_BY_OBJECT_TYPE)
);

const BALANCE_SECURITY_PARENT_OBJECT_TYPES = {
  TX_CONVERTIBLE_CANCELLATION: true,
  TX_CONVERTIBLE_CONVERSION: true,
  TX_CONVERTIBLE_TRANSFER: true,
  TX_EQUITY_COMPENSATION_CANCELLATION: true,
  TX_EQUITY_COMPENSATION_TRANSFER: true,
  TX_STOCK_CANCELLATION: true,
  TX_STOCK_CONVERSION: true,
  TX_STOCK_REPURCHASE: true,
  TX_STOCK_TRANSFER: true,
  TX_WARRANT_CANCELLATION: true,
  TX_WARRANT_TRANSFER: true,
} as const satisfies Record<BalanceSecurityParentObjectType, true>;
const BALANCE_SECURITY_PARENT_OBJECT_TYPE_SET: ReadonlySet<string> = new Set(
  Object.keys(BALANCE_SECURITY_PARENT_OBJECT_TYPES)
);

function isResultParentObjectType(objectType: unknown): objectType is ResultParentObjectType {
  return typeof objectType === 'string' && RESULT_PARENT_OBJECT_TYPE_SET.has(objectType);
}

function isBalanceSecurityParentObjectType(objectType: unknown): objectType is BalanceSecurityParentObjectType {
  return typeof objectType === 'string' && BALANCE_SECURITY_PARENT_OBJECT_TYPE_SET.has(objectType);
}

/**
 * Compute intra-day ordering weight for a transaction.
 *
 * Lower weights are processed first within the same day.
 * This ensures domain-correct ordering: issuances before exercises,
 * acceptances before splits, transfers before conversions, etc.
 *
 * Weights began as the legacy cap-table-engine order and remain the deterministic
 * baseline. `sortTransactions` overrides that baseline when entity dependencies
 * require parent -> child issuance -> same-security action ordering.
 */
export function txWeight(
  tx: Pick<TransactionSortCandidate, 'object_type' | 'security_id'>,
  producedSecurityIds?: ReadonlySet<string>
): number {
  if (
    producedSecurityIds !== undefined &&
    typeof tx.object_type === 'string' &&
    ISSUANCE_OBJECT_TYPE_SET.has(tx.object_type) &&
    typeof tx.security_id === 'string' &&
    producedSecurityIds.has(tx.security_id)
  ) {
    return 36;
  }

  switch (tx.object_type) {
    // Administrative adjustments early in the day
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
    case 'TX_STOCK_PLAN_RETURN_TO_POOL':
      return 5;

    // Reissuance must run before child issuances
    case 'TX_STOCK_REISSUANCE':
      return 9;

    // Creations first
    case 'TX_STOCK_ISSUANCE':
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
    case 'TX_WARRANT_ISSUANCE':
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 10;

    // Acceptances after issuances, before splits
    case 'TX_STOCK_ACCEPTANCE':
    case 'TX_WARRANT_ACCEPTANCE':
    case 'TX_EQUITY_COMPENSATION_ACCEPTANCE':
      return 11;

    // Vesting events
    case 'TX_VESTING_START':
      return 12;
    case 'TX_VESTING_EVENT':
      return 13;
    case 'TX_VESTING_ACCELERATION':
      return 14;

    // Splits after vesting, before transfers
    case 'TX_STOCK_CLASS_SPLIT':
      return 15;

    // Retractions after splits, before transfers
    case 'TX_STOCK_RETRACTION':
    case 'TX_WARRANT_RETRACTION':
    case 'TX_CONVERTIBLE_RETRACTION':
    case 'TX_EQUITY_COMPENSATION_RETRACTION':
      return 16;

    // Consolidation after retractions, before transfers
    case 'TX_STOCK_CONSOLIDATION':
      return 17;

    // Ratio adjustments after consolidation, before transfers
    case 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT':
      return 18;

    // Repricing after ratio adjustments, before transfers
    case 'TX_EQUITY_COMPENSATION_REPRICING':
      return 19;

    // Transfers - neutral moves
    case 'TX_STOCK_TRANSFER':
    case 'TX_WARRANT_TRANSFER':
    case 'TX_CONVERTIBLE_TRANSFER':
    case 'TX_EQUITY_COMPENSATION_TRANSFER':
      return 20;

    // Convertible acceptance requires preceding transfer
    case 'TX_CONVERTIBLE_ACCEPTANCE':
      return 22;

    // Releases before exercises
    case 'TX_EQUITY_COMPENSATION_RELEASE':
      return 25;

    // Exercises that may mint resulting stock
    case 'TX_EQUITY_COMPENSATION_EXERCISE':
    case 'TX_WARRANT_EXERCISE':
      return 30;

    // Conversions after exercises
    case 'TX_STOCK_CONVERSION':
    case 'TX_CONVERTIBLE_CONVERSION':
      return 35;

    // Reductions after issuances
    case 'TX_STOCK_REPURCHASE':
    case 'TX_STOCK_CANCELLATION':
    case 'TX_EQUITY_COMPENSATION_CANCELLATION':
    case 'TX_WARRANT_CANCELLATION':
    case 'TX_CONVERTIBLE_CANCELLATION':
      return 40;

    // Stakeholder events - process after transactions that might create/modify stakes
    case 'CE_STAKEHOLDER_RELATIONSHIP':
    case 'CE_STAKEHOLDER_STATUS':
      return 45;

    // Unknown types at the end
    default:
      return 50;
  }
}

const SORT_ERROR_VALUE_LIMIT = 96;

function boundedSortErrorValue(value: string): string {
  const rendered = JSON.stringify(value);
  return rendered.length <= SORT_ERROR_VALUE_LIMIT ? rendered : `${rendered.slice(0, SORT_ERROR_VALUE_LIMIT - 3)}...`;
}

/**
 * Build an opaque, collision-free baseline key for deterministic ordering.
 *
 * Each UTF-16 code unit is fixed-width hex encoded and components are joined
 * with `/`, which cannot occur in the encoded alphabet and sorts before hex.
 * This preserves JavaScript string ordering, including component prefixes,
 * without allowing `security_id` or `id` contents to collide with separators.
 * Relational result-security dependencies are applied by `sortTransactions`
 * after this baseline key is sorted.
 *
 * This ensures:
 * - Same-day transactions are ordered by domain weight
 * - Within same weight, grouped by security_id for locality
 * - Within same group, ordered by created timestamp
 * - Final tiebreaker by transaction id for determinism
 * - Exact canonical-key ties retain input order; duplicate identities are
 *   malformed but remain lossless and stable rather than being discarded
 *
 * @throws OcpValidationError if tx.date is missing or invalid - fail fast on malformed records
 */
export function buildTransactionSortKey(
  tx: TransactionSortCandidate,
  issuanceDates?: ReadonlyMap<string, string>,
  producedSecurityIds?: ReadonlySet<string>
): string {
  return buildTransactionSortMetadata(tx, issuanceDates, producedSecurityIds).key;
}

interface TransactionSortMetadata {
  readonly day: string;
  readonly key: string;
}

function encodeSortKeyComponent(value: string): string {
  const encodedCodeUnits = Array<string>(value.length);
  for (let index = 0; index < value.length; index += 1) {
    encodedCodeUnits[index] = value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return encodedCodeUnits.join('');
}

function buildTransactionSortMetadata(
  tx: TransactionSortCandidate,
  issuanceDates?: ReadonlyMap<string, string>,
  producedSecurityIds?: ReadonlySet<string>
): TransactionSortMetadata {
  let day = tryIsoDateToDateString(tx.date);
  if (day === null) {
    const txId = boundedSortErrorValue(typeof tx.id === 'string' ? tx.id : 'unknown');
    const txType = boundedSortErrorValue(typeof tx.object_type === 'string' ? tx.object_type : 'unknown');
    const isMissing = tx.date === null || tx.date === undefined;
    const isInvalidType = !isMissing && typeof tx.date !== 'string';
    const code = isMissing
      ? OcpErrorCodes.REQUIRED_FIELD_MISSING
      : isInvalidType
        ? OcpErrorCodes.INVALID_TYPE
        : OcpErrorCodes.INVALID_FORMAT;
    const reason = isMissing ? 'missing' : isInvalidType ? 'not a string' : 'invalid';
    const renderedDate = typeof tx.date === 'string' ? boundedSortErrorValue(tx.date) : `<${typeof tx.date}>`;
    throw new OcpValidationError(
      'tx.date',
      `Transaction has ${reason} date - id: ${txId}, object_type: ${txType}, date: ${renderedDate}`,
      {
        code,
        expectedType: 'YYYY-MM-DD or RFC 3339 date-time string with Z or numeric offset',
        receivedValue: tx.date,
      }
    );
  }

  if (issuanceDates !== undefined && tx.object_type === 'TX_VESTING_START' && typeof tx.security_id === 'string') {
    const issuanceDay = issuanceDates.get(tx.security_id);
    if (issuanceDay !== undefined && day < issuanceDay) {
      day = issuanceDay;
    }
  }

  const weight = txWeight(tx, producedSecurityIds).toString().padStart(3, '0');
  const group = typeof tx.security_id === 'string' ? tx.security_id : '_no_security_';

  const createdMs = getTimestampOrNull(tx.createdAt ?? tx.created_at);
  const created = createdMs !== null ? new Date(createdMs).toISOString() : '9999-12-31T23:59:59.999Z';

  // Safe string conversion for transaction ID
  const id = typeof tx.id === 'string' ? tx.id : '';

  const key = [day, weight, group, created, id].map(encodeSortKeyComponent).join('/');
  return { day, key };
}

function buildIssuanceDateMap(transactions: readonly TransactionSortCandidate[]): ReadonlyMap<string, string> {
  const issuanceDates = new Map<string, string>();

  for (const tx of transactions) {
    if (
      typeof tx.object_type !== 'string' ||
      !ISSUANCE_OBJECT_TYPE_SET.has(tx.object_type) ||
      typeof tx.security_id !== 'string'
    ) {
      continue;
    }
    const day = tryIsoDateToDateString(tx.date);
    const currentDay = issuanceDates.get(tx.security_id);
    // Duplicate security issuances are malformed OCF, but the public sorter is
    // total at this boundary. The latest day is deterministic across input
    // permutations and matches the final issuance dependency used below.
    if (day !== null && (currentDay === undefined || day > currentDay)) {
      issuanceDates.set(tx.security_id, day);
    }
  }

  return issuanceDates;
}

function buildProducedSecurityIds(transactions: readonly TransactionSortCandidate[]): ReadonlySet<string> {
  const producedSecurityIds = new Set<string>();

  for (const tx of transactions) {
    for (const securityId of getProducedSecurityIds(tx)) {
      producedSecurityIds.add(securityId);
    }
  }

  return producedSecurityIds;
}

function getProducedSecurityIds(tx: TransactionSortCandidate): string[] {
  const securityIds: string[] = [];
  if (isResultParentObjectType(tx.object_type)) {
    const resultField = RESULT_SECURITY_ID_FIELD_BY_OBJECT_TYPE[tx.object_type];
    const resultValue = tx[resultField];
    if (resultField === 'resulting_security_id') {
      if (typeof resultValue === 'string' && resultValue.length > 0) {
        securityIds.push(resultValue);
      }
    } else if (Array.isArray(resultValue)) {
      for (const securityId of resultValue) {
        if (typeof securityId === 'string' && securityId.length > 0) {
          securityIds.push(securityId);
        }
      }
    }
  }
  if (
    isBalanceSecurityParentObjectType(tx.object_type) &&
    typeof tx.balance_security_id === 'string' &&
    tx.balance_security_id.length > 0
  ) {
    securityIds.push(tx.balance_security_id);
  }

  return securityIds;
}

interface DecoratedTransaction<Transaction extends SortableOcfTransaction> {
  readonly tx: Transaction;
  readonly key: string;
  readonly day: string;
}

function pushBaselineIndex(heap: number[], index: number): void {
  heap.push(index);
  let childIndex = heap.length - 1;
  while (childIndex > 0) {
    const parentIndex = Math.floor((childIndex - 1) / 2);
    const parent = heap[parentIndex];
    const child = heap[childIndex];
    if (parent === undefined || child === undefined || parent <= child) break;
    heap[parentIndex] = child;
    heap[childIndex] = parent;
    childIndex = parentIndex;
  }
}

function popBaselineIndex(heap: number[]): number | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (first === undefined || last === undefined) return undefined;
  if (heap.length === 0) return first;

  heap[0] = last;
  let parentIndex = 0;
  while (parentIndex * 2 + 1 < heap.length) {
    const leftIndex = parentIndex * 2 + 1;
    const rightIndex = leftIndex + 1;
    const left = heap[leftIndex];
    const right = heap[rightIndex];
    if (left === undefined) break;

    const childIndex = right !== undefined && right < left ? rightIndex : leftIndex;
    const parent = heap[parentIndex];
    const child = heap[childIndex];
    if (parent === undefined || child === undefined || parent <= child) break;
    heap[parentIndex] = child;
    heap[childIndex] = parent;
    parentIndex = childIndex;
  }

  return first;
}

/**
 * Apply entity dependencies without disturbing cross-day ordering.
 *
 * The input contains one effective calendar day and is already sorted by the
 * public day/weight/security/created/id key. Its indexes therefore provide a
 * deterministic priority for otherwise unrelated nodes. Dependency edges never
 * cross days, so calendar precedence remains absolute. A result producer on this
 * day must precede its child issuance; even when the producer is on another day,
 * the known result issuance must precede every same-day action on that security.
 * A min-heap keeps Kahn's traversal at O((V + E) log V).
 * Cyclic malformed relationships are broken at the lowest baseline index so the
 * sorter remains total and deterministic instead of hanging or using input-order
 * Set/Map traversal as an implicit tiebreaker.
 */
function sortTransactionDayWithDependencies<Transaction extends SortableOcfTransaction>(
  dayTransactions: ReadonlyArray<DecoratedTransaction<Transaction>>,
  producedSecurityIds: ReadonlySet<string>
): Array<DecoratedTransaction<Transaction>> {
  if (dayTransactions.length < 2) return [...dayTransactions];

  const transactionIndexesBySecurityId = new Map<string, number[]>();
  for (const [index, { tx }] of dayTransactions.entries()) {
    if (typeof tx.security_id !== 'string') continue;
    const indexes = transactionIndexesBySecurityId.get(tx.security_id);
    if (indexes === undefined) {
      transactionIndexesBySecurityId.set(tx.security_id, [index]);
    } else {
      indexes.push(index);
    }
  }

  const producerIndexesByProducedSecurityId = new Map<string, Set<number>>();
  for (const [parentIndex, { tx: parent }] of dayTransactions.entries()) {
    for (const producedSecurityId of getProducedSecurityIds(parent)) {
      const producerIndexes = producerIndexesByProducedSecurityId.get(producedSecurityId);
      if (producerIndexes === undefined) {
        producerIndexesByProducedSecurityId.set(producedSecurityId, new Set([parentIndex]));
      } else {
        producerIndexes.add(parentIndex);
      }
    }
  }

  const dependencies = Array.from({ length: dayTransactions.length }, () => new Set<number>());
  const dependencyCounts = Array<number>(dayTransactions.length).fill(0);
  const addDependency = (beforeIndex: number, afterIndex: number): void => {
    if (beforeIndex === afterIndex) return;
    const dependents = dependencies[beforeIndex];
    if (dependents !== undefined && !dependents.has(afterIndex)) {
      dependents.add(afterIndex);
      dependencyCounts[afterIndex] = (dependencyCounts[afterIndex] ?? 0) + 1;
    }
  };

  const orderedProducedSecurityIds = [...transactionIndexesBySecurityId.keys()]
    .filter((securityId) => producedSecurityIds.has(securityId))
    .sort();
  for (const producedSecurityId of orderedProducedSecurityIds) {
    const relatedIndexes = transactionIndexesBySecurityId.get(producedSecurityId);
    if (relatedIndexes === undefined) continue;
    const producerIndexSet = producerIndexesByProducedSecurityId.get(producedSecurityId) ?? new Set<number>();

    const issuanceIndexes = relatedIndexes.filter((relatedIndex) => {
      const related = dayTransactions[relatedIndex];
      return (
        related !== undefined &&
        typeof related.tx.object_type === 'string' &&
        ISSUANCE_OBJECT_TYPE_SET.has(related.tx.object_type)
      );
    });
    const firstIssuanceIndex = issuanceIndexes[0];
    const lastIssuanceIndex = issuanceIndexes[issuanceIndexes.length - 1];
    if (firstIssuanceIndex === undefined || lastIssuanceIndex === undefined) continue;

    const producerIndexes = [...producerIndexSet].sort((left, right) => left - right);
    for (const producerIndex of producerIndexes) {
      addDependency(producerIndex, firstIssuanceIndex);
    }
    for (let index = 1; index < issuanceIndexes.length; index += 1) {
      const previousIssuanceIndex = issuanceIndexes[index - 1];
      const issuanceIndex = issuanceIndexes[index];
      if (previousIssuanceIndex !== undefined && issuanceIndex !== undefined) {
        addDependency(previousIssuanceIndex, issuanceIndex);
      }
    }
    const issuanceIndexSet = new Set(issuanceIndexes);
    for (const relatedIndex of relatedIndexes) {
      if (!producerIndexSet.has(relatedIndex) && !issuanceIndexSet.has(relatedIndex)) {
        addDependency(lastIssuanceIndex, relatedIndex);
      }
    }
  }

  const pendingIndexes = new Set(dayTransactions.map((_transaction, index) => index));
  const availableIndexes: number[] = [];
  for (const index of pendingIndexes) {
    if (dependencyCounts[index] === 0) pushBaselineIndex(availableIndexes, index);
  }
  const ordered: Array<DecoratedTransaction<Transaction>> = [];

  while (pendingIndexes.size > 0) {
    if (availableIndexes.length === 0) {
      const cycleBreak = pendingIndexes.values().next();
      if (cycleBreak.done) break;
      pushBaselineIndex(availableIndexes, cycleBreak.value);
    }

    const currentIndex = popBaselineIndex(availableIndexes);
    if (currentIndex === undefined || !pendingIndexes.delete(currentIndex)) continue;

    const current = dayTransactions[currentIndex];
    if (current !== undefined) ordered.push(current);

    for (const dependentIndex of dependencies[currentIndex] ?? []) {
      if (!pendingIndexes.has(dependentIndex)) continue;
      dependencyCounts[dependentIndex] = (dependencyCounts[dependentIndex] ?? 0) - 1;
      if (dependencyCounts[dependentIndex] === 0) {
        pushBaselineIndex(availableIndexes, dependentIndex);
      }
    }
  }

  return ordered;
}

/**
 * Sort transactions with domain-aware same-day ordering.
 *
 * This defines the SDK's corrected canonical order. Weight-only consumers,
 * including the current apiv2 cap-table-engine sorter, must port the dependency
 * phase for parity.
 * Retroactive vesting starts sort immediately after their referenced issuance
 * without changing the transaction's original date. Issuances produced by a
 * conversion, exercise, release, transfer, reissuance, consolidation, cancellation,
 * or repurchase sort after that parent transaction to prevent the result from being
 * treated as a new mint. Same-security actions then sort after the child issuance.
 * Records with an exact canonical sort-key tie retain their caller-provided
 * relative order. This keeps malformed duplicate identities lossless while all
 * distinguishable canonical records remain permutation-independent.
 *
 * Uses decorate-sort-undecorate pattern to avoid recomputing sort keys
 * during comparisons, which is more efficient for large transaction lists.
 */
export function sortTransactions<const Transaction extends SortableOcfTransaction>(
  transactions: readonly Transaction[]
): Transaction[] {
  const issuanceDates = buildIssuanceDateMap(transactions);
  const producedSecurityIds = buildProducedSecurityIds(transactions);

  // Decorate: precompute sort keys once per transaction
  const decorated = transactions.map((tx) => {
    const { day, key } = buildTransactionSortMetadata(tx, issuanceDates, producedSecurityIds);
    return { tx, key, day };
  });

  // Establish the deterministic baseline order before applying same-day dependencies.
  decorated.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const transactionsByDay = new Map<string, Array<DecoratedTransaction<Transaction>>>();
  for (const transaction of decorated) {
    const dayTransactions = transactionsByDay.get(transaction.day);
    if (dayTransactions === undefined) {
      transactionsByDay.set(transaction.day, [transaction]);
    } else {
      dayTransactions.push(transaction);
    }
  }

  const ordered: Transaction[] = [];
  for (const dayTransactions of transactionsByDay.values()) {
    for (const { tx } of sortTransactionDayWithDependencies(dayTransactions, producedSecurityIds)) {
      ordered.push(tx);
    }
  }

  return ordered;
}

/**
 * Validate a transaction's sort boundary before adding it to an extracted manifest.
 *
 * Extraction handles conversion failures per source contract. Validating here keeps
 * malformed dates inside that same failure boundary, so partial extraction can skip
 * only the invalid contract instead of failing later while sorting the whole manifest.
 */
function appendValidatedTransaction(transactions: OcfTransaction[], transaction: OcfTransaction): void {
  buildTransactionSortKey(transaction);
  transactions.push(transaction);
}

/**
 * OCF manifest structure compatible with processCapTable / buildCaptableInput.
 */
export interface OcfManifest {
  issuer: OcfIssuer | null;
  stockClasses: OcfStockClass[];
  stockPlans: OcfStockPlan[];
  stakeholders: OcfStakeholder[];
  transactions: OcfTransaction[];
  vestingTerms: OcfVestingTerms[];
  valuations: OcfValuation[];
  documents: OcfDocument[];
  stockLegendTemplates: OcfStockLegendTemplate[];
}

/**
 * Options for extracting OCF data from Canton.
 */
export interface ExtractCantonOcfOptions {
  /** Log progress to console. Default: false */
  verbose?: boolean;
  /** Callback for logging (defaults to console.log when verbose) */
  logger?: (message: string) => void;
  /** Optional Canton read scope for issuer-visible child contracts */
  readAs?: string[];
  /**
   * Compatibility mode for callers that intentionally accept partial manifests.
   *
   * Default: true. Non-benign child read or conversion failures still throw with
   * classified diagnostics. Archived or not-found contracts remain soft-skipped
   * regardless of this flag.
   *
   * Set to false to log and skip classified non-benign read or conversion failures
   * instead of throwing, returning a partial manifest.
   */
  failOnReadErrors?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MANIFEST_IDENTIFIER_LIMIT = 128;
const MANIFEST_ERROR_LIMIT = 256;
const MANIFEST_READ_AS_LIMIT = 12;

function manifestIdentifier(value: unknown): string {
  return toSafeDiagnosticText(value, MANIFEST_IDENTIFIER_LIMIT);
}

function manifestReadCause(error: unknown): Error {
  return new Error(toSafeDiagnosticText(error, MANIFEST_ERROR_LIMIT));
}

function diagnosticReadScope(readScope: { readonly readAs?: readonly string[] }): { readAs?: string[] } {
  if (readScope.readAs === undefined) return {};
  return {
    readAs: readScope.readAs
      .slice(0, MANIFEST_READ_AS_LIMIT)
      .map((party) => toSafeDiagnosticText(party, MANIFEST_IDENTIFIER_LIMIT)),
  };
}

/**
 * Extract all OCF objects from Canton and return them in manifest format.
 *
 * This function fetches all entities from a CapTable contract and transforms
 * them into an OCF manifest structure suitable for cap table processing.
 *
 * @param client - LedgerJsonApiClient instance
 * @param cantonState - CapTableState from getCapTableState
 * @param options - Extraction options
 * @returns OCF manifest with all objects grouped by category
 *
 * @example
 * ```typescript
 * import { extractCantonOcfManifest } from '@open-captable-protocol/canton';
 *
 * const cantonState = await ocp.OpenCapTable.capTable.getState(issuerPartyId);
 * if (cantonState) {
 *   const manifest = await extractCantonOcfManifest(ocp.ledger, cantonState);
 *   // manifest.stakeholders, manifest.stockClasses, manifest.transactions, etc.
 * }
 * ```
 */
export async function extractCantonOcfManifest(
  client: LedgerJsonApiClient,
  cantonState: CapTableState,
  options: ExtractCantonOcfOptions = {}
): Promise<OcfManifest> {
  const { verbose = false, failOnReadErrors = true } = options;
  // eslint-disable-next-line no-console
  const log = options.logger ?? (verbose ? (msg: string) => console.log(msg) : () => {});
  const readScopeOpts = ledgerReadScope(options);
  const diagnosticReadScopeOpts = diagnosticReadScope(readScopeOpts);

  const result: OcfManifest = {
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    stockLegendTemplates: [],
  };

  // Fetch issuer — only if getCapTableState confirmed the contract is alive
  // (i.e., issuer is present in contractIds). A stale issuerContractId (contract
  // archived/not visible) is excluded from contractIds by getCapTableState, so
  // we skip it here to avoid a redundant 404 that would abort extraction.
  const issuerContractEntry = cantonState.contractIds.get('issuer');
  if (issuerContractEntry && issuerContractEntry.size > 0) {
    const issuerIteratorResult = issuerContractEntry.entries().next();
    if (issuerIteratorResult.done) {
      throw new OcpValidationError('contractIds.issuer', 'Expected a non-empty issuer contract entry', {
        code: OcpErrorCodes.INVALID_FORMAT,
        receivedValue: issuerContractEntry,
      });
    }
    const [issuerId, issuerCid] = issuerIteratorResult.value;
    let issuerLastError: Error | null = null;
    let issuerLastOutcome: ContractReadOutcome | null = null;
    let issuerAttempts = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      issuerAttempts = attempt + 1;
      try {
        const issuerResult = await getIssuerAsOcf(client, {
          contractId: issuerCid,
          ...readScopeOpts,
        });
        result.issuer = issuerResult.data;
        issuerLastError = null;
        issuerLastOutcome = null;
        break;
      } catch (error) {
        const outcome = analyzeContractReadFailure(error);
        issuerLastError = manifestReadCause(error);
        issuerLastOutcome = outcome;
        if (attempt === 0 && outcome.retryable) {
          log(`  ⏳ Transient error fetching issuer/${manifestIdentifier(issuerId)}, retrying in 2s...`);
          await sleep(2000);
          continue;
        }
        break;
      }
    }
    if (issuerLastError !== null && issuerLastOutcome !== null) {
      const outcome = issuerLastOutcome;
      const safeIssuerId = manifestIdentifier(issuerId);
      const safeIssuerCid = manifestIdentifier(issuerCid);
      log(`  ⚠️ Failed to fetch issuer/${safeIssuerId} [${outcome.classification}]: ${issuerLastError.message}`);
      if (!outcome.benignMissing) {
        const diagnosedError = createDiagnosedContractReadError({
          message: `Failed to fetch issuer/${safeIssuerId} (${outcome.classification})`,
          contractId: safeIssuerCid,
          code: contractReadFailureCode(outcome.classification),
          cause: issuerLastError,
          diagnostics: {
            classification: outcome.classification,
            operation: 'extractCantonOcfManifest',
            entityType: 'issuer',
            objectId: safeIssuerId,
            contractId: safeIssuerCid,
            attempts: issuerAttempts,
            ...diagnosticReadScopeOpts,
          },
        });
        if (failOnReadErrors) {
          throw diagnosedError;
        }
        log('  -> Continuing with partial manifest because failOnReadErrors=false');
      }
    }
  } else if (cantonState.issuerContractId) {
    log(
      `  ⚠️ Skipping issuer fetch: contract ${manifestIdentifier(cantonState.issuerContractId)} ` +
        'not in contractIds (likely archived)'
    );
  }

  // Process each entity type from the cap table (issuer handled above)
  for (const [entityType, idToContractId] of cantonState.contractIds) {
    if (entityType === 'issuer') continue;
    for (const [objectId, contractId] of idToContractId) {
      let lastError: Error | null = null;
      let lastOutcome: ContractReadOutcome | null = null;
      let readAttempts = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        readAttempts = attempt + 1;
        try {
          const { data } = await getEntityAsOcf(client, entityType, contractId, readScopeOpts);
          // Transactions intentionally share the default branch below; the assignment
          // there keeps this exhaustive for any future non-transaction category.
          // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
          switch (data.object_type) {
            case 'STAKEHOLDER':
              result.stakeholders.push(data);
              break;
            case 'STOCK_CLASS':
              result.stockClasses.push(data);
              break;
            case 'STOCK_PLAN':
              result.stockPlans.push(data);
              break;
            case 'VESTING_TERMS':
              result.vestingTerms.push(data);
              break;
            case 'VALUATION':
              result.valuations.push(data);
              break;
            case 'DOCUMENT':
              result.documents.push(data);
              break;
            case 'STOCK_LEGEND_TEMPLATE':
              result.stockLegendTemplates.push(data);
              break;
            default: {
              // This assignment is deliberately exhaustive: adding a new non-transaction
              // entity to the SDK must also add an explicit manifest category above.
              // Read-only entity snapshots are safe inputs to the sorter and
              // manifest collector. The manifest's legacy mutable annotation
              // is retained until every reader family has migrated.
              const transaction = data as OcfTransaction;
              appendValidatedTransaction(result.transactions, transaction);
            }
          }
          lastError = null;
          lastOutcome = null;
          break;
        } catch (error) {
          const outcome = analyzeContractReadFailure(error);
          lastError = manifestReadCause(error);
          lastOutcome = outcome;
          if (attempt === 0 && outcome.retryable) {
            log(
              `  ⏳ Transient error fetching ${manifestIdentifier(entityType)}/${manifestIdentifier(objectId)}, ` +
                'retrying in 2s...'
            );
            await sleep(2000);
            continue;
          }
          break;
        }
      }
      if (lastError !== null && lastOutcome !== null) {
        const outcome = lastOutcome;
        const safeEntityType = manifestIdentifier(entityType);
        const safeObjectId = manifestIdentifier(objectId);
        const safeContractId = manifestIdentifier(contractId);
        log(`  ⚠️ Failed to fetch ${safeEntityType}/${safeObjectId} [${outcome.classification}]: ${lastError.message}`);
        if (!outcome.benignMissing) {
          const diagnosedError = createDiagnosedContractReadError({
            message: `Failed to fetch ${safeEntityType}/${safeObjectId} (${outcome.classification})`,
            contractId: safeContractId,
            code: contractReadFailureCode(outcome.classification),
            cause: lastError,
            diagnostics: {
              classification: outcome.classification,
              operation: 'extractCantonOcfManifest',
              entityType: safeEntityType,
              objectId: safeObjectId,
              contractId: safeContractId,
              attempts: readAttempts,
              ...diagnosticReadScopeOpts,
            },
          });
          if (failOnReadErrors) {
            throw diagnosedError;
          }
          log('  -> Continuing with partial manifest because failOnReadErrors=false');
        }
      }
    }
  }

  // Apply the SDK's canonical date, baseline-weight, and same-day dependency order.
  // Weight-only loaders must port the produced-security dependency phase for parity.
  result.transactions = sortTransactions(result.transactions);

  return result;
}

/**
 * Count the total number of OCF objects in a manifest.
 *
 * Accepts Partial<OcfManifest> to handle partial manifests (e.g. from buildCaptableInput
 * which may omit valuations, documents, or stockLegendTemplates).
 */
export function countManifestObjects(manifest: Partial<OcfManifest>): number {
  let count = manifest.issuer ? 1 : 0;
  count += (manifest.stakeholders ?? []).length;
  count += (manifest.stockClasses ?? []).length;
  count += (manifest.stockPlans ?? []).length;
  count += (manifest.vestingTerms ?? []).length;
  count += (manifest.transactions ?? []).length;
  count += (manifest.valuations ?? []).length;
  count += (manifest.documents ?? []).length;
  count += (manifest.stockLegendTemplates ?? []).length;
  return count;
}
