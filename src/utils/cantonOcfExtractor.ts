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
} from './contractReadDiagnostics';
import { ledgerReadScope } from './readScope';

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
    return Number.isNaN(input) ? null : input;
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
  readonly createdAt?: string | number;
  readonly created_at?: string | number;
}

/** Loose runtime boundary retained for diagnostic helpers that validate malformed input. */
interface TransactionSortCandidate {
  readonly id?: unknown;
  readonly date?: unknown;
  readonly object_type?: unknown;
  readonly security_id?: unknown;
  readonly createdAt?: unknown;
  readonly created_at?: unknown;
}

/**
 * Compute intra-day ordering weight for a transaction.
 *
 * Lower weights are processed first within the same day.
 * This ensures domain-correct ordering: issuances before exercises,
 * acceptances before splits, transfers before conversions, etc.
 *
 * Weights are ported from libs/api/service-ocp/utils/transactionSort.js
 * to ensure parity between DB and Canton data processing.
 */
export function txWeight(tx: Pick<TransactionSortCandidate, 'object_type'>): number {
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
    case 'TX_PLAN_SECURITY_ISSUANCE': // schema-supported OCF alias
    case 'TX_WARRANT_ISSUANCE':
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 10;

    // Acceptances after issuances, before splits
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

    // Splits after vesting, before transfers
    case 'TX_STOCK_CLASS_SPLIT':
      return 15;

    // Retractions after splits, before transfers
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
export function buildTransactionSortKey(tx: TransactionSortCandidate): string {
  const dateMs = getTimestampOrNull(tx.date);
  if (dateMs === null) {
    const txId = typeof tx.id === 'string' ? tx.id : 'unknown';
    const txType = typeof tx.object_type === 'string' ? tx.object_type : 'unknown';
    throw new OcpValidationError(
      'tx.date',
      `Transaction has missing or invalid date - id: ${txId}, object_type: ${txType}, date: ${JSON.stringify(tx.date)}`,
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: tx.date }
    );
  }
  const day = new Date(dateMs).toISOString().slice(0, 10);
  const weight = txWeight(tx).toString().padStart(3, '0');
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
export function sortTransactions<const Transaction extends SortableOcfTransaction>(
  transactions: readonly Transaction[]
): Transaction[] {
  // Decorate: precompute sort keys once per transaction
  const decorated = transactions.map((tx) => ({
    tx,
    key: buildTransactionSortKey(tx),
  }));

  // Sort by precomputed key
  decorated.sort((a, b) => a.key.localeCompare(b.key));

  // Undecorate: return transactions in sorted order
  return decorated.map((item) => item.tx);
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
   * Default: true. Non-benign child read failures still throw with classified
   * diagnostics. Archived or not-found contracts remain soft-skipped regardless
   * of this flag.
   *
   * Set to false to log and skip classified non-benign read failures instead of
   * throwing, returning a partial manifest.
   */
  failOnReadErrors?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        break;
      } catch (error) {
        issuerLastError = error instanceof Error ? error : new Error(String(error));
        const outcome = analyzeContractReadFailure(error);
        if (attempt === 0 && outcome.retryable) {
          log(`  ⏳ Transient error fetching issuer/${issuerId}, retrying in 2s...`);
          await sleep(2000);
          continue;
        }
        break;
      }
    }
    if (issuerLastError) {
      const outcome = analyzeContractReadFailure(issuerLastError);
      log(`  ⚠️ Failed to fetch issuer/${issuerId} [${outcome.classification}]: ${issuerLastError.message}`);
      if (!outcome.benignMissing) {
        const diagnosedError = createDiagnosedContractReadError({
          message: `Failed to fetch issuer/${issuerId} (${outcome.classification})`,
          contractId: issuerCid,
          code: contractReadFailureCode(outcome.classification),
          cause: issuerLastError,
          diagnostics: {
            classification: outcome.classification,
            operation: 'extractCantonOcfManifest',
            entityType: 'issuer',
            objectId: issuerId,
            contractId: issuerCid,
            attempts: issuerAttempts,
            ...readScopeOpts,
          },
        });
        if (failOnReadErrors) {
          throw diagnosedError;
        }
        log('  -> Continuing with partial manifest because failOnReadErrors=false');
      }
    }
  } else if (cantonState.issuerContractId) {
    log(`  ⚠️ Skipping issuer fetch: contract ${cantonState.issuerContractId} not in contractIds (likely archived)`);
  }

  // Process each entity type from the cap table (issuer handled above)
  for (const [entityType, idToContractId] of cantonState.contractIds) {
    if (entityType === 'issuer') continue;
    for (const [objectId, contractId] of idToContractId) {
      let lastError: Error | null = null;
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
              const transaction: OcfTransaction = data;
              result.transactions.push(transaction);
            }
          }
          lastError = null;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const outcome = analyzeContractReadFailure(error);
          if (attempt === 0 && outcome.retryable) {
            log(`  ⏳ Transient error fetching ${entityType}/${objectId}, retrying in 2s...`);
            await sleep(2000);
            continue;
          }
          break;
        }
      }
      if (lastError) {
        const outcome = analyzeContractReadFailure(lastError);
        log(`  ⚠️ Failed to fetch ${entityType}/${objectId} [${outcome.classification}]: ${lastError.message}`);
        if (!outcome.benignMissing) {
          const diagnosedError = createDiagnosedContractReadError({
            message: `Failed to fetch ${entityType}/${objectId} (${outcome.classification})`,
            contractId,
            code: contractReadFailureCode(outcome.classification),
            cause: lastError,
            diagnostics: {
              classification: outcome.classification,
              operation: 'extractCantonOcfManifest',
              entityType,
              objectId,
              contractId,
              attempts: readAttempts,
              ...readScopeOpts,
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

  // Sort transactions by date with domain-aware same-day ordering
  // This matches the DB loader behavior (buildCaptableInput uses sortTransactions)
  // and is critical for consistent cap table processing results
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
