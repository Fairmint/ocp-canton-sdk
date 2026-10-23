/**
 * Build the OCF manifest of an OpenCapTable-v35 book from its key index.
 *
 * {@link buildOcfManifest} turns the records a {@link RegisterIndex} holds into a manifest (no per-contract fetch);
 * {@link extractCantonOcfManifest} reads the book with `readRegister` first. A strict OCF export leaves out the
 * Fairmint hold pair (`TX_STOCK_HOLD`, `TX_STOCK_HOLD_CANCELLATION`); an extended export includes it.
 *
 * The returned manifest structure is compatible with external OCF processing tools
 * like buildCaptableInput/processCapTable from the fairmint/api repository.
 *
 * @module cantonOcfExtractor
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../errors/codes';
import { OcpContractError } from '../errors/OcpContractError';
import { OcpValidationError } from '../errors/OcpValidationError';
import type { OcfEntityType } from '../functions/OpenCapTable/capTable/entityTypes';
import { readRegister } from '../register/reader';
import type { RegisterIndex } from '../register/registerIndex';
import type { RegisterRecord } from '../types/register';
import { tryIsoDateToDateString } from './typeConversions';

// ===== Transaction Sorting =====
// These utilities ensure Canton transactions are sorted consistently with DB data.
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

/**
 * Compute intra-day ordering weight for a transaction.
 *
 * Lower weights are processed first within the same day.
 * This ensures domain-correct ordering: splits first (the units rule),
 * issuances before exercises, transfers before conversions, etc.
 *
 * Weights are ported from libs/api/service-ocp/utils/transactionSort.js
 * to ensure parity between DB and Canton data processing.
 *
 * Re-papered issuances (issuances whose security_id is produced by a
 * transfer/conversion/exercise/release/reissuance) must sort AFTER their parent
 * transaction. The cap-table engine treats an issuance as minting unless its
 * parent transfer/conversion already ran and set nonMintingIssuances; an
 * issuance processed before its parent therefore double-counts supply and
 * raises MISORDERED_REPAPERED_ISSUANCES. The DB loader implements this via
 * the weight-36 bump in libs/api transactionSort.js; this port keeps Canton
 * manifest ordering aligned with it. See Fairmint/api 6385c985 and
 * Fairmint/ocp-canton-sdk 66c936cc (unmerged).
 */
export const REPAPERED_ISSUANCE_WEIGHT = 36;

/** Parent transaction types whose resulting securities are re-papered by companion issuances. */
const REPAPER_PARENT_TYPES: ReadonlySet<string> = new Set([
  'TX_CONVERTIBLE_CONVERSION',
  'TX_WARRANT_EXERCISE',
  'TX_EQUITY_COMPENSATION_EXERCISE',
  'TX_EQUITY_COMPENSATION_RELEASE',
  'TX_PLAN_SECURITY_RELEASE',
  'TX_STOCK_TRANSFER',
  'TX_STOCK_CONVERSION',
  'TX_CONVERTIBLE_TRANSFER',
  'TX_WARRANT_TRANSFER',
  'TX_EQUITY_COMPENSATION_TRANSFER',
  'TX_PLAN_SECURITY_TRANSFER',
  'TX_STOCK_REISSUANCE',
]);

const ISSUANCE_OBJECT_TYPES: ReadonlySet<string> = new Set([
  'TX_STOCK_ISSUANCE',
  'TX_EQUITY_COMPENSATION_ISSUANCE',
  'TX_PLAN_SECURITY_ISSUANCE',
  'TX_WARRANT_ISSUANCE',
  'TX_CONVERTIBLE_ISSUANCE',
]);

/**
 * Build the set of security IDs that are produced by conversions, exercises,
 * transfers, releases, and reissuances (via resulting_security_ids and
 * balance_security_id).
 *
 * Issuances for these security IDs are "re-papered" and must sort AFTER their
 * parent transaction to avoid being treated as minting (double-counting).
 *
 * Deliberately locked 1:1 to the DB loader's parent list in
 * libs/api/service-ocp/utils/transactionSort.js (buildConversionResultSecurityIds).
 * This sort must mirror DB ordering exactly, or portals that process cleanly on
 * the DB side would newly diverge on the Canton side. Expanding the parent set
 * (e.g. TX_STOCK_CONSOLIDATION, which reads the singular resulting_security_id,
 * or TX_PLAN_SECURITY_EXERCISE) must happen in libs/api first, in lockstep.
 */
export function buildConversionResultSecurityIds(transactions: ReadonlyArray<Record<string, unknown>>): Set<string> {
  const ids = new Set<string>();
  for (const tx of transactions) {
    const objectType = typeof tx['object_type'] === 'string' ? tx['object_type'] : undefined;
    if (objectType === undefined || !REPAPER_PARENT_TYPES.has(objectType)) continue;
    const resulting = tx['resulting_security_ids'];
    if (Array.isArray(resulting)) {
      for (const id of resulting) {
        if (typeof id === 'string' && id.length > 0) ids.add(id);
      }
    }
    if (typeof tx['balance_security_id'] === 'string' && tx['balance_security_id'].length > 0) {
      ids.add(tx['balance_security_id']);
    }
  }
  return ids;
}

/**
 * Effective intra-day weight for a transaction given the set of re-papered security IDs.
 *
 * An issuance whose security_id was produced by a parent transaction sorts after
 * that parent (weight 36) instead of with plain creations (weight 10).
 */
export function effectiveTxWeight(
  tx: Record<string, unknown>,
  conversionResultSecurityIds?: ReadonlySet<string>
): number {
  const baseWeight = txWeight(tx);
  if (
    conversionResultSecurityIds !== undefined &&
    conversionResultSecurityIds.size > 0 &&
    baseWeight === 10 &&
    ISSUANCE_OBJECT_TYPES.has(typeof tx['object_type'] === 'string' ? tx['object_type'] : '') &&
    typeof tx['security_id'] === 'string' &&
    conversionResultSecurityIds.has(tx['security_id'])
  ) {
    return REPAPERED_ISSUANCE_WEIGHT;
  }
  return baseWeight;
}

/**
 * The weight of a stock class split: below every other weight, so a split sorts first on its day.
 *
 * The units rule of OpenCapTable-v35: a split dated D applies to records dated before D, and records dated D or later
 * are in post-split units (so a split's own `TX_STOCK_REISSUANCE` can be dated D). apiv2's
 * `packages/captable-engine/src/utils/transactionSort.ts` sorts with the same weights and changes in lockstep.
 */
export const SPLIT_WEIGHT = 1;

/**
 * Compute intra-day ordering weight for a transaction.
 *
 * Lower weights are processed first within the same day.
 * This ensures domain-correct ordering: splits first (the units rule, {@link SPLIT_WEIGHT}),
 * issuances before exercises, transfers before conversions, etc.
 *
 * Weights are ported from libs/api/service-ocp/utils/transactionSort.js
 * to ensure parity between DB and Canton data processing.
 */
export function txWeight(tx: Record<string, unknown>): number {
  switch (tx.object_type) {
    // Splits first on their day: records dated on a split's day are in post-split units
    case 'TX_STOCK_CLASS_SPLIT':
      return SPLIT_WEIGHT;

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
    case 'TX_PLAN_SECURITY_ISSUANCE': // schema-supported OCF alias
    case 'TX_WARRANT_ISSUANCE':
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 10;

    // Acceptances after issuances
    case 'TX_STOCK_ACCEPTANCE':
    case 'TX_WARRANT_ACCEPTANCE':
    case 'TX_EQUITY_COMPENSATION_ACCEPTANCE':
    case 'TX_PLAN_SECURITY_ACCEPTANCE': // schema-supported OCF alias
      return 11;

    // Vesting events
    case 'TX_VESTING_START':
      return 12;
    case 'TX_VESTING_EVENT':
      return 13;
    case 'TX_VESTING_ACCELERATION':
      return 14;

    // Retractions after vesting, before transfers
    case 'TX_STOCK_RETRACTION':
    case 'TX_WARRANT_RETRACTION':
    case 'TX_CONVERTIBLE_RETRACTION':
    case 'TX_EQUITY_COMPENSATION_RETRACTION':
    case 'TX_PLAN_SECURITY_RETRACTION': // schema-supported OCF alias
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
    case 'TX_PLAN_SECURITY_TRANSFER': // schema-supported OCF alias
      return 20;

    // Convertible acceptance requires preceding transfer
    case 'TX_CONVERTIBLE_ACCEPTANCE':
      return 22;

    // Releases before exercises
    case 'TX_EQUITY_COMPENSATION_RELEASE':
    case 'TX_PLAN_SECURITY_RELEASE': // schema-supported OCF alias
      return 25;

    // Exercises that may mint resulting stock
    case 'TX_EQUITY_COMPENSATION_EXERCISE':
    case 'TX_PLAN_SECURITY_EXERCISE': // schema-supported OCF alias
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
    case 'TX_PLAN_SECURITY_CANCELLATION': // schema-supported OCF alias
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
 * Build a composite sort key for deterministic same-day ordering.
 *
 * Key structure: day|weight|group|created|id
 * This ensures:
 * - Same-day transactions are ordered by domain weight
 * - Within same weight, grouped by security_id for locality
 * - Within same group, ordered by created timestamp
 * - Final tiebreaker by transaction id for determinism
 *
 * @throws OcpValidationError if tx.date is missing or invalid - fail fast on malformed records
 */
export function buildTransactionSortKey(
  tx: Record<string, unknown>,
  conversionResultSecurityIds?: ReadonlySet<string>
): string {
  const day = tryIsoDateToDateString(tx.date);
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
  const weight = effectiveTxWeight(tx, conversionResultSecurityIds).toString().padStart(3, '0');
  const group = typeof tx.security_id === 'string' ? tx.security_id : '_no_security_';

  const createdMs = getTimestampOrNull(tx.createdAt ?? tx.created_at);
  const created = createdMs !== null ? new Date(createdMs).toISOString() : '9999-12-31T23:59:59.999Z';

  // Safe string conversion for transaction ID
  const id = typeof tx.id === 'string' ? tx.id : '';

  return `${day}|${weight}|${group}|${created}|${id}`;
}

/**
 * Sort transactions with domain-aware same-day ordering.
 *
 * This ensures Canton transactions are sorted consistently with DB data.
 * The cap table engine processes transactions in array order, so this
 * sorting is critical for producing identical outputs.
 *
 * Uses decorate-sort-undecorate pattern to avoid recomputing sort keys
 * during comparisons, which is more efficient for large transaction lists.
 */
export function sortTransactions(transactions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  // Re-papered issuances (whose security_id is produced by a transfer/conversion/exercise/release)
  // must sort AFTER their parent transaction so the engine marks them non-minting.
  const conversionResultSecurityIds = buildConversionResultSecurityIds(transactions);

  // Decorate: precompute sort keys once per transaction
  const decorated = transactions.map((tx) => ({
    tx,
    key: buildTransactionSortKey(tx, conversionResultSecurityIds),
  }));

  // Sort by precomputed key
  decorated.sort((a, b) => a.key.localeCompare(b.key));

  // Undecorate: return transactions in sorted order
  return decorated.map((item) => item.tx);
}

/**
 * Validate a transaction's sort boundary before adding it to an extracted manifest.
 *
 * Extraction handles conversion failures per source contract. Validating here keeps
 * malformed dates inside that same failure boundary, so partial extraction can skip
 * only the invalid contract instead of failing later while sorting the whole manifest.
 */
function appendValidatedTransaction(
  transactions: Array<Record<string, unknown>>,
  transaction: Record<string, unknown>
): void {
  // Validation only (fail fast on malformed dates); the effective weight context
  // is computed once across the full transaction set inside sortTransactions.
  buildTransactionSortKey(transaction);
  transactions.push(transaction);
}

/** Where each record kind goes in a manifest; the hold pair goes to `transactions` only in an extended export. */
const MANIFEST_CATEGORY = {
  issuer: 'issuer',
  stakeholder: 'stakeholders',
  stockClass: 'stockClasses',
  stockPlan: 'stockPlans',
  vestingTerms: 'vestingTerms',
  valuation: 'valuations',
  document: 'documents',
  financing: 'financings',
  stockLegendTemplate: 'stockLegendTemplates',
  stockHold: 'holds',
  stockHoldCancellation: 'holds',
  // Stock transactions
  stockIssuance: 'transactions',
  stockTransfer: 'transactions',
  stockCancellation: 'transactions',
  stockRetraction: 'transactions',
  stockRepurchase: 'transactions',
  stockAcceptance: 'transactions',
  stockReissuance: 'transactions',
  stockConversion: 'transactions',
  stockConsolidation: 'transactions',
  // Stock class and issuer adjustments
  stockClassAuthorizedSharesAdjustment: 'transactions',
  stockClassConversionRatioAdjustment: 'transactions',
  stockClassSplit: 'transactions',
  issuerAuthorizedSharesAdjustment: 'transactions',
  // Stock plan events
  stockPlanPoolAdjustment: 'transactions',
  stockPlanReturnToPool: 'transactions',
  // Convertible transactions
  convertibleIssuance: 'transactions',
  convertibleTransfer: 'transactions',
  convertibleCancellation: 'transactions',
  convertibleRetraction: 'transactions',
  convertibleAcceptance: 'transactions',
  convertibleConversion: 'transactions',
  // Warrant transactions
  warrantIssuance: 'transactions',
  warrantTransfer: 'transactions',
  warrantCancellation: 'transactions',
  warrantAcceptance: 'transactions',
  warrantExercise: 'transactions',
  warrantRetraction: 'transactions',
  // Equity compensation transactions
  equityCompensationIssuance: 'transactions',
  equityCompensationTransfer: 'transactions',
  equityCompensationCancellation: 'transactions',
  equityCompensationRetraction: 'transactions',
  equityCompensationAcceptance: 'transactions',
  equityCompensationRelease: 'transactions',
  equityCompensationExercise: 'transactions',
  equityCompensationRepricing: 'transactions',
  // Stakeholder events
  stakeholderRelationshipChangeEvent: 'transactions',
  stakeholderStatusChangeEvent: 'transactions',
  // Vesting events
  vestingAcceleration: 'transactions',
  vestingEvent: 'transactions',
  vestingStart: 'transactions',
} as const satisfies Record<OcfEntityType, keyof OcfManifest | 'holds'>;

/**
 * OCF manifest structure compatible with processCapTable / buildCaptableInput.
 */
export interface OcfManifest {
  issuer: Record<string, unknown> | null;
  stockClasses: Array<Record<string, unknown>>;
  stockPlans: Array<Record<string, unknown>>;
  stakeholders: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  vestingTerms: Array<Record<string, unknown>>;
  valuations: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  financings: Array<Record<string, unknown>>;
  stockLegendTemplates: Array<Record<string, unknown>>;
}

/** Options for {@link buildOcfManifest}. */
export interface BuildOcfManifestOptions {
  /**
   * Include the Fairmint OCF extension's hold pair (`TX_STOCK_HOLD`, `TX_STOCK_HOLD_CANCELLATION`) in `transactions`.
   * Default `false`: a strict OCF export, which OCF's own schemas validate.
   */
  includeHoldRecords?: boolean;
}

/**
 * A manifest holding these records, each in its category and in the given order (the hold pair among the
 * transactions), for the offline replay, which puts them in replay order itself.
 */
export function manifestOfRecords(
  records: Iterable<{ readonly entityType: OcfEntityType; readonly data: Record<string, unknown> }>
): OcfManifest {
  const manifest: OcfManifest = {
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    financings: [],
    stockLegendTemplates: [],
  };
  for (const { entityType, data } of records) {
    const category = MANIFEST_CATEGORY[entityType];
    if (category === 'issuer') manifest.issuer = data;
    else manifest[category === 'holds' ? 'transactions' : category].push(data);
  }
  return manifest;
}

function byCreation(a: RegisterRecord, b: RegisterRecord): number {
  return a.createdOffset === b.createdOffset ? a.objectId.localeCompare(b.objectId) : a.createdOffset - b.createdOffset;
}

/**
 * Build a book's OCF manifest from its key index: every record the index holds, grouped by category, with
 * transactions in the domain-aware date order of {@link sortTransactions} and the other categories in the order the
 * ledger created them.
 *
 * @param index - A key index read with `retainPayloads` (the default)
 * @param options - Whether to include the hold pair
 * @throws OcpValidationError when the index keeps no record data, or a transaction has an invalid date
 * @throws OcpContractError when the book holds more than one issuer record
 *
 * @example
 * ```typescript
 * import { register } from '@open-captable-protocol/canton';
 * import { buildOcfManifest } from '@open-captable-protocol/canton/replication';
 *
 * const { books } = await register.readRegister(client, { readAs: issuerParty, capTableId });
 * const manifest = buildOcfManifest(books[0]);
 * ```
 */
export function buildOcfManifest(index: RegisterIndex, options: BuildOcfManifestOptions = {}): OcfManifest {
  if (!index.retainsPayloads) {
    throw new OcpValidationError(
      'index',
      'The key index was read with retainPayloads: false and holds no record data',
      {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      }
    );
  }
  const result: OcfManifest = {
    issuer: null,
    stockClasses: [],
    stockPlans: [],
    stakeholders: [],
    transactions: [],
    vestingTerms: [],
    valuations: [],
    documents: [],
    financings: [],
    stockLegendTemplates: [],
  };
  const issuers: RegisterRecord[] = [];
  for (const record of [...index.records()].sort(byCreation)) {
    if (record.data === null) continue;
    const data: Record<string, unknown> = { ...record.data };
    const category = MANIFEST_CATEGORY[record.entityType];
    if (category === 'issuer') {
      issuers.push(record);
      result.issuer = data;
    } else if (category === 'holds') {
      if (options.includeHoldRecords === true) appendValidatedTransaction(result.transactions, data);
    } else if (category === 'transactions') {
      appendValidatedTransaction(result.transactions, data);
    } else {
      result[category].push(data);
    }
  }
  if (issuers.length > 1) {
    throw new OcpContractError(
      `Cap table ${index.context.cap_table_id} holds ${issuers.length} issuer records; a manifest has one`,
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'multiple_issuer_records',
        context: { capTableId: index.context.cap_table_id, contractIds: issuers.map((issuer) => issuer.contractId) },
      }
    );
  }

  // Sort transactions by date with domain-aware same-day ordering
  // This matches the DB loader behavior (buildCaptableInput uses sortTransactions)
  // and is critical for consistent cap table processing results
  result.transactions = sortTransactions(result.transactions);
  return result;
}

/**
 * Options for extracting OCF data from Canton.
 */
export interface ExtractCantonOcfOptions extends BuildOcfManifestOptions {
  /** The party to read as: the book's issuer, `system_operator` or TA */
  readAs: string;
  /** The cap table to export; required when the party can read more than one */
  capTableId?: string;
  /** The offset to read at; defaults to the ledger end */
  activeAtOffset?: number;
  /**
   * Export a book that reads incomplete: one with contracts signed by its three parties that the reader could not
   * admit (`unreadable_contract`), or with no anchor. Default `false`: such a book throws, as its manifest would
   * silently miss records.
   */
  allowIncomplete?: boolean;
  /** Fail the read when no message arrives for this many milliseconds (default 600,000) */
  idleTimeoutMs?: number;
  /** Log progress to console. Default: false */
  verbose?: boolean;
  /** Callback for logging (defaults to console.log when verbose) */
  logger?: (message: string) => void;
}

/**
 * Read a book from the active contract set and return its OCF manifest.
 *
 * @param client - LedgerJsonApiClient instance
 * @param options - The party to read as, the cap table, and the export options
 * @returns OCF manifest with all objects grouped by category
 * @throws OcpContractError when no single trusted book matches, or the book reads incomplete
 *
 * @example
 * ```typescript
 * import { extractCantonOcfManifest } from '@open-captable-protocol/canton/replication';
 *
 * const manifest = await extractCantonOcfManifest(client, { readAs: issuerParty, capTableId });
 * // manifest.stakeholders, manifest.stockClasses, manifest.transactions, etc.
 * ```
 */
export async function extractCantonOcfManifest(
  client: LedgerJsonApiClient,
  options: ExtractCantonOcfOptions
): Promise<OcfManifest> {
  const { verbose = false, allowIncomplete = false, capTableId } = options;
  // eslint-disable-next-line no-console
  const log = options.logger ?? (verbose ? (msg: string) => console.log(msg) : () => {});

  const snapshot = await readRegister(client, {
    readAs: options.readAs,
    ...(capTableId !== undefined ? { capTableId } : {}),
    ...(options.activeAtOffset !== undefined ? { activeAtOffset: options.activeAtOffset } : {}),
    ...(options.idleTimeoutMs !== undefined ? { idleTimeoutMs: options.idleTimeoutMs } : {}),
  });
  for (const rejection of snapshot.rejected) {
    log(`  ⚠️ Rejected ${rejection.contractId} [${rejection.reason}]: ${rejection.message}`);
  }
  const books = snapshot.books.filter((book) => capTableId === undefined || book.context.cap_table_id === capTableId);
  const [book] = books;
  if (book === undefined || books.length > 1) {
    const duplicateAnchors = snapshot.rejected.filter((rejection) => rejection.reason === 'duplicate_anchor');
    throw new OcpContractError(
      book === undefined
        ? `No book${capTableId === undefined ? '' : ` for cap table ${capTableId}`} at offset ${snapshot.offset}`
        : `${books.length} books at offset ${snapshot.offset}; name the cap table to export`,
      {
        code: OcpErrorCodes.CONTRACT_NOT_FOUND,
        classification: book === undefined ? 'register_book_not_found' : 'register_book_ambiguous',
        context: {
          capTableId,
          offset: snapshot.offset,
          books: books.map((candidate) => candidate.context.cap_table_id),
          duplicateAnchors: duplicateAnchors.length,
        },
      }
    );
  }
  const flags = book.flags();
  for (const flag of flags) log(`  ⚠️ Cap table ${book.context.cap_table_id} flag: ${flag.kind}`);
  const incomplete = flags.filter((flag) => flag.kind === 'unreadable_contract' || flag.kind === 'missing_anchor');
  if (incomplete.length > 0 && !allowIncomplete) {
    throw new OcpContractError(
      `Cap table ${book.context.cap_table_id} reads incomplete at offset ${snapshot.offset}: ${incomplete
        .map((flag) => flag.kind)
        .join(', ')}`,
      {
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'register_book_incomplete',
        context: { capTableId: book.context.cap_table_id, offset: snapshot.offset, flags: incomplete },
      }
    );
  }
  const counts = book.counts();
  log(`  Read cap table ${book.context.cap_table_id} at offset ${snapshot.offset}: ${counts.records} records`);
  return buildOcfManifest(book, options);
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
  count += (manifest.financings ?? []).length;
  count += (manifest.stockLegendTemplates ?? []).length;
  return count;
}
