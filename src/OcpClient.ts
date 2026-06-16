/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * The OcpClient provides a clean, organized API for OCP operations, grouped by domain:
 *
 * - **OpenCapTable**: Core cap table operations (issuer, stakeholders, stock classes, issuances, etc.)
 *
 * Payment-stream, coupon-minter, and related validator-backed helpers were removed in v0.4.0. Consumers that need those flows must implement them against the injected ledger and validator clients (or other integration of their choice).
 *
 * **Company valuation reports** (`OpenCapTableReports` DAML) are not part of this package — use
 * `@fairmint/canton-fairmint-sdk` (`createFairmintOcpClient`) and `@fairmint/daml-js` instead (v0.5.0+).
 *
 * @example
 * ```typescript
 * import { OcpClient } from '@open-captable-protocol/canton';
 * import { Canton } from '@fairmint/canton-node-sdk';
 *
 * const canton = new Canton({ network: 'localnet' });
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   validator: canton.validator,
 * });
 *
 * // Set context once to cache common parameters
 * ocp.context.setIssuerParty(partyId);
 *
 * // Read operations return ContractResult<T> with { data, contractId }
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({
 *   contractId: '00abc123',
 * });
 * console.log(issuer.object_type); // 'ISSUER'
 * console.log(issuer.legal_name);
 *
 * // Batch updates
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId: 'REPLACE_WITH_CAP_TABLE_CONTRACT_ID',
 *   actAs: ['issuer::namespace'],
 * });
 * batch.create('stakeholder', stakeholderData);
 * await batch.execute();
 * ```
 *
 * @example For localnet or custom factory deployments
 * ```typescript
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   factory: {
 *     contractId: 'YOUR_FACTORY_CONTRACT_ID',
 *     templateId: 'YOUR_FACTORY_TEMPLATE_ID',
 *   },
 * });
 * ```
 *
 * @see https://ocp.canton.fairmint.com/ — documentation site (fairmint/web)
 *
 * @module
 */

import { Canton, type LedgerJsonApiClient, type ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
import {
  loadEnvironmentConfigFromEnv,
  resolveEnvironmentConfig,
  toCantonNetwork,
  toResolvedCantonConfig,
  type EnvironmentConfig,
  type EnvironmentConfigInput,
  type OcpEnvironment,
} from './environment';
import { OcpErrorCodes, OcpValidationError } from './errors';
import {
  authorizeIssuer,
  buildCreateIssuerCommand,
  getConvertibleAcceptanceAsOcf,
  getConvertibleCancellationAsOcf,
  getConvertibleConversionAsOcf,
  getConvertibleIssuanceAsOcf,
  getConvertibleTransferAsOcf,
  getDocumentAsOcf,
  getEntityAsOcf,
  getEquityCompensationAcceptanceAsOcf,
  getEquityCompensationCancellationAsOcf,
  getEquityCompensationExerciseAsOcf,
  getEquityCompensationIssuanceAsOcf,
  getEquityCompensationTransferAsOcf,
  getIssuerAsOcf,
  getIssuerAuthorizedSharesAdjustmentAsOcf,
  getStakeholderAsOcf,
  getStakeholderRelationshipChangeEventAsOcf,
  getStakeholderStatusChangeEventAsOcf,
  getStockAcceptanceAsOcf,
  getStockCancellationAsOcf,
  getStockClassAsOcf,
  getStockClassAuthorizedSharesAdjustmentAsOcf,
  getStockClassConversionRatioAdjustmentAsOcf,
  getStockClassSplitAsOcf,
  getStockConsolidationAsOcf,
  getStockConversionAsOcf,
  getStockIssuanceAsOcf,
  getStockLegendTemplateAsOcf,
  getStockPlanAsOcf,
  getStockPlanPoolAdjustmentAsOcf,
  getStockReissuanceAsOcf,
  getStockRepurchaseAsOcf,
  getStockTransferAsOcf,
  getValuationAsOcf,
  getVestingAccelerationAsOcf,
  getVestingEventAsOcf,
  getVestingStartAsOcf,
  getVestingTermsAsOcf,
  getWarrantAcceptanceAsOcf,
  getWarrantCancellationAsOcf,
  getWarrantExerciseAsOcf,
  getWarrantIssuanceAsOcf,
  getWarrantTransferAsOcf,
  withdrawAuthorization,
  type AuthorizeIssuerParams,
  type AuthorizeIssuerResult,
  type CreateIssuerParams,
  type WithdrawAuthorizationParams,
  type WithdrawAuthorizationResult,
} from './functions';
import {
  archiveCapTable,
  CapTableBatch,
  classifyIssuerCapTables,
  ENTITY_OBJECT_TYPE_MAP,
  getCapTableState,
  type ArchiveCapTableParams,
  type ArchiveCapTableResult,
  type CapTableState,
  type IssuerCapTableClassification,
} from './functions/OpenCapTable/capTable';
import { mergeCommandContext, type CommandObservabilityOptions, type OcpObservabilityOptions } from './observability';
import type { CommandWithDisclosedContracts } from './types';
import type { ContractResult, GetByContractIdParams } from './types/common';
import type {
  OcfConvertibleAcceptanceOutput,
  OcfConvertibleCancellationOutput,
  OcfConvertibleConversionOutput,
  OcfConvertibleIssuanceOutput,
  OcfConvertibleRetractionOutput,
  OcfConvertibleTransferOutput,
  OcfDocumentOutput,
  OcfEquityCompensationAcceptanceOutput,
  OcfEquityCompensationCancellationOutput,
  OcfEquityCompensationExerciseOutput,
  OcfEquityCompensationIssuanceOutput,
  OcfEquityCompensationReleaseOutput,
  OcfEquityCompensationRepricingOutput,
  OcfEquityCompensationRetractionOutput,
  OcfEquityCompensationTransferOutput,
  OcfIssuerAuthorizedSharesAdjustmentOutput,
  OcfIssuerOutput,
  OcfStakeholderOutput,
  OcfStakeholderRelationshipChangeEventOutput,
  OcfStakeholderStatusChangeEventOutput,
  OcfStockAcceptanceOutput,
  OcfStockCancellationOutput,
  OcfStockClassAuthorizedSharesAdjustmentOutput,
  OcfStockClassConversionRatioAdjustmentOutput,
  OcfStockClassOutput,
  OcfStockClassSplitOutput,
  OcfStockConsolidationOutput,
  OcfStockConversionOutput,
  OcfStockIssuanceOutput,
  OcfStockLegendTemplateOutput,
  OcfStockPlanOutput,
  OcfStockPlanPoolAdjustmentOutput,
  OcfStockPlanReturnToPoolOutput,
  OcfStockReissuanceOutput,
  OcfStockRepurchaseOutput,
  OcfStockRetractionOutput,
  OcfStockTransferOutput,
  OcfValuationOutput,
  OcfVestingAccelerationOutput,
  OcfVestingEventOutput,
  OcfVestingStartOutput,
  OcfVestingTermsOutput,
  OcfWarrantAcceptanceOutput,
  OcfWarrantCancellationOutput,
  OcfWarrantExerciseOutput,
  OcfWarrantIssuanceOutput,
  OcfWarrantRetractionOutput,
  OcfWarrantTransferOutput,
} from './types/output';

// ===== Helper to adapt underlying function results to ContractResult<T> =====

/**
 * Adapt an underlying `get*AsOcf` function result to the standardized `ContractResult<T>` format.
 *
 * The underlying functions define their own local output types that may differ
 * structurally from the centralized output types in `types/output.ts` (e.g., optional
 * vs required fields, locally-defined interfaces vs `WithObjectType` aliases). The
 * centralized types are stricter and canonical. This adapter performs a single, contained
 * type assertion to bridge the gap, keeping the cast out of individual call sites.
 *
 * @typeParam T - The target output type from `types/output.ts`
 * @param data - Entity data from the underlying function (runtime-correct, locally-typed)
 * @param contractId - The contract ID returned by the underlying function
 * @internal
 */
function toContractResult<T>(data: unknown, contractId: string): ContractResult<T> {
  if (data == null) {
    throw new OcpValidationError(
      'toContractResult.data',
      `Expected entity data but received ${data === null ? 'null' : 'undefined'} (contractId: ${contractId})`,
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: data }
    );
  }
  return { data: data as T, contractId };
}

function withObjectType(data: unknown, objectType: string): unknown {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  return typeof record.object_type === 'string' ? record : { ...record, object_type: objectType };
}

function makeGenericEntityReader<T>(
  client: LedgerJsonApiClient,
  entityType: Parameters<typeof getEntityAsOcf>[1]
): EntityReader<T> {
  return {
    get: async ({ contractId, ...options }) => {
      const r = await getEntityAsOcf(client, entityType, contractId, options);
      return toContractResult<T>(withObjectType(r.data, ENTITY_OBJECT_TYPE_MAP[entityType]), r.contractId);
    },
  };
}

// ===== Context Manager =====

/**
 * Context for OCP operations that can be cached and reused.
 *
 * Store commonly used contract details to avoid passing them repeatedly.
 *
 * @example
 * ```typescript
 * const canton = new Canton({ network: 'localnet' });
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   validator: canton.validator,
 * });
 *
 * // Set context once after initial setup
 * ocp.context.setIssuerParty(issuerPartyId);
 *
 * // Later, retrieve cached values when needed
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId: ocp.context.requireCapTableContractId(),
 *   actAs: [ocp.context.requireIssuerParty()],
 * });
 * ```
 */
export interface OcpContext {
  /** The cached issuer party ID */
  issuerParty: string | null;
  /** The cached cap table contract ID */
  capTableContractId: string | null;
}

/**
 * Manager for OCP operation context.
 *
 * Provides methods to set, get, and clear cached context values.
 */
export class OcpContextManager implements OcpContext {
  private _issuerParty: string | null = null;
  private _capTableContractId: string | null = null;

  /** Get the cached issuer party ID */
  get issuerParty(): string | null {
    return this._issuerParty;
  }

  /** Get the cached cap table contract ID */
  get capTableContractId(): string | null {
    return this._capTableContractId;
  }

  /**
   * Set the issuer party ID.
   * @param partyId - The party ID to cache
   */
  setIssuerParty(partyId: string): void {
    this._issuerParty = partyId;
  }

  /**
   * Set the cap table contract ID.
   * @param contractId - The contract ID to cache
   */
  setCapTableContractId(contractId: string): void {
    this._capTableContractId = contractId;
  }

  /**
   * Set all context values at once.
   * @param context - Partial context object with values to set
   */
  setAll(context: Partial<OcpContext>): void {
    if (context.issuerParty !== undefined) {
      this._issuerParty = context.issuerParty;
    }
    if (context.capTableContractId !== undefined) {
      this._capTableContractId = context.capTableContractId;
    }
  }

  /**
   * Get the issuer party or throw if not set.
   * @throws OcpValidationError if issuer party has not been set
   */
  requireIssuerParty(): string {
    if (!this._issuerParty) {
      throw new OcpValidationError(
        'context.issuerParty',
        'Issuer party not set. Call context.setIssuerParty() first.',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
      );
    }
    return this._issuerParty;
  }

  /**
   * Get the cap table contract ID or throw if not set.
   * @throws OcpValidationError if cap table contract ID has not been set
   */
  requireCapTableContractId(): string {
    if (!this._capTableContractId) {
      throw new OcpValidationError(
        'context.capTableContractId',
        'Cap table contract ID not set. Call context.setCapTableContractId() first.',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
      );
    }
    return this._capTableContractId;
  }

  /** Clear all cached context values */
  clear(): void {
    this._issuerParty = null;
    this._capTableContractId = null;
  }

  /** Check if the context has all required values for batch operations */
  isReadyForBatchOperations(): boolean {
    return this._capTableContractId !== null;
  }
}

// ===== OcpClient =====

/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * **Namespaced APIs** (each mirrors a domain of the DAML model):
 * - {@link OcpClient.OpenCapTable} — issuer, stakeholders, stock classes, issuances, `capTable` lifecycle and batch updates
 *
 * Prefer {@link OcpClient.context} to cache issuer party and cap table contract id across calls.
 *
 * Payment-stream, coupon-minter, and related flows are not included (removed in v0.4.0); implement them with the same injected `ledger` / `validator` clients or your own modules.
 *
 * @example Wire client, read issuer, batch cap table update
 * ```typescript
 * import { OcpClient } from '@open-captable-protocol/canton';
 * import { Canton } from '@fairmint/canton-node-sdk';
 *
 * const canton = new Canton({ network: 'localnet' });
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   validator: canton.validator,
 * });
 *
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({
 *   contractId: '00abc123',
 * });
 *
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId: 'REPLACE_WITH_CAP_TABLE_CONTRACT_ID',
 *   actAs: ['issuer::namespace'],
 * });
 * batch.create('stakeholder', { id: 'sh_1', name: { legal_name: 'Example' }, ... });
 * await batch.execute();
 * ```
 *
 * @example For localnet or custom factory deployments
 * ```typescript
 * import { OcpClient } from '@open-captable-protocol/canton';
 * import { Canton } from '@fairmint/canton-node-sdk';
 *
 * const canton = new Canton({ network: 'localnet' });
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   factory: {
 *     contractId: 'YOUR_FACTORY_CONTRACT_ID',
 *     templateId: 'YOUR_FACTORY_TEMPLATE_ID',
 *   },
 * });
 * ```
 */
export class OcpClient {
  /** The injected Ledger JSON API client for direct ledger access */
  public readonly ledger: LedgerJsonApiClient;

  /** Optional injected Validator API client for validator-backed workflows */
  public readonly validator?: ValidatorApiClient;

  /**
   * Optional factory coordinates when not using the bundled mainnet/devnet config
   * (e.g. localnet, staging, or a custom network).
   */
  public readonly factory?: OcpFactoryCoordinates;

  /** Logical Canton environment when this client was created through environment helpers. */
  public readonly environment?: OcpEnvironment;

  /** Optional logger, metrics, and default command context for OCP write operations. */
  public readonly observability: OcpObservabilityOptions;

  private productionSafetyChecksEnabled: boolean;

  /**
   * Context manager for caching commonly used values.
   *
   * Use this to store issuer party and cap table contract ID after fetching them once,
   * so they can be reused across operations.
   */
  public readonly context: OcpContextManager = new OcpContextManager();

  /** Core cap table operations */
  public readonly OpenCapTable: OpenCapTableMethods;

  /**
   * @param dependencies - **`ledger`** — required for OpenCapTable reads and `CapTableBatch`.
   * **`validator`** — optional when using cap-table-only APIs from this package.
   */
  constructor(dependencies: OcpClientDependencies) {
    validateInjectedEnvironment(dependencies.environment, dependencies.ledger);
    validateFactoryCoordinates(dependencies.factory);
    this.ledger = dependencies.ledger;
    this.validator = dependencies.validator;
    this.factory =
      dependencies.factory === undefined
        ? undefined
        : { contractId: dependencies.factory.contractId, templateId: dependencies.factory.templateId };
    this.environment = dependencies.environment;
    this.productionSafetyChecksEnabled = dependencies.productionSafetyChecks ?? false;
    const observability: OcpObservabilityOptions = {};
    if (dependencies.logger !== undefined) observability.logger = dependencies.logger;
    if (dependencies.metrics !== undefined) observability.metrics = dependencies.metrics;
    if (dependencies.defaultContext !== undefined) observability.defaultContext = dependencies.defaultContext;
    this.observability = observability;

    this.OpenCapTable = this.createOpenCapTableMethods();
  }

  private withObservability<T extends CommandObservabilityOptions>(params: T): T {
    const defaultContext = mergeCommandContext(this.observability.defaultContext, params.defaultContext);
    return {
      ...this.observability,
      ...params,
      ...(defaultContext ? { defaultContext } : {}),
    };
  }

  /**
   * Create an OCP client from an environment config.
   *
   * This is an opt-in convenience around `@fairmint/canton-node-sdk`'s `Canton` client. The constructor still accepts
   * injected `ledger` / `validator` clients for callers that manage runtime clients themselves.
   */
  public static create(options: OcpClientEnvironmentOptions): OcpClient {
    return OcpClient.fromEnvironment(options);
  }

  /** Create a client using the LocalNet preset, including cn-quickstart app-provider ports. */
  public static forLocalNet(options: OcpClientPresetOptions = {}): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'localnet' });
  }

  /** Create a client for DevNet with explicit API URLs and OAuth2 credentials. */
  public static forDevNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'devnet' });
  }

  /** Create a client for TestNet with explicit API URLs and OAuth2 credentials. */
  public static forTestNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'testnet' });
  }

  /** Create a client for MainNet with explicit API URLs and OAuth2 credentials. */
  public static forMainNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'mainnet' });
  }

  /** Create a client from `CANTON_*` environment variables, with optional per-call overrides. */
  public static fromEnv(options: OcpClientEnvOptions = {}): OcpClient {
    const { factory, productionSafetyChecks, ...overrides } = options;
    const config = loadEnvironmentConfigFromEnv(process.env, overrides);
    return OcpClient.fromEnvironment({ ...config, factory, productionSafetyChecks });
  }

  private static fromEnvironment(options: OcpClientEnvironmentOptions): OcpClient {
    const { factory, productionSafetyChecks, ...environmentInput } = options;
    const environmentConfig = resolveEnvironmentConfig(environmentInput);
    const canton = new Canton(toResolvedCantonConfig(environmentConfig));

    return new OcpClient({
      ledger: canton.ledger,
      validator: canton.validator,
      factory,
      environment: environmentConfig.environment,
      productionSafetyChecks,
    });
  }

  public isLocalNet(): boolean {
    return this.environment === 'localnet';
  }

  public isProduction(): boolean {
    return this.environment === 'mainnet';
  }

  public setProductionSafetyChecks(enabled = true): this {
    this.productionSafetyChecksEnabled = enabled;
    return this;
  }

  public areProductionSafetyChecksEnabled(): boolean {
    return this.productionSafetyChecksEnabled;
  }

  /**
   * Create a Canton {@link TransactionBatch} to submit multiple ledger commands in one transaction.
   *
   * Use with `addBuiltCommand` / `addCommand` from `@fairmint/canton-node-sdk` when composing custom flows
   * (for example `issuer.buildCreate`). For atomic **UpdateCapTable** changes, prefer
   * {@link OpenCapTableMethods.capTable.update} and {@link CapTableBatch}.
   *
   * @param params.actAs - Parties that authorize the submission (signatories).
   * @param params.readAs - Optional parties granted read access for contract resolution.
   * @returns Fluent batch builder; call `addBuiltCommand` or `addCommand`, then `submitAndWaitForTransactionTree`.
   *
   * @example
   * ```typescript
   * const batch = ocp.createBatch({ actAs: [issuerPartyId] });
   * const built = ocp.OpenCapTable.issuer.buildCreate({
   *   issuerAuthorizationContractDetails,
   *   issuerParty: issuerPartyId,
   *   issuerData: { id: 'i1', legal_name: 'Co', country_of_formation: 'US', formation_date: '2020-01-01' },
   * });
   * await batch.addBuiltCommand(built).submitAndWaitForTransactionTree();
   * ```
   */
  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.ledger, params.actAs, params.readAs);
  }

  private createOpenCapTableMethods(): OpenCapTableMethods {
    const client = this.ledger;
    const genericEntity = <T>(entityType: Parameters<typeof getEntityAsOcf>[1]): EntityReader<T> =>
      makeGenericEntityReader<T>(client, entityType);

    return {
      // ===== Objects =====
      issuer: {
        get: async (params) => getIssuerAsOcf(client, params),
        buildCreate: (params) => buildCreateIssuerCommand(params),
      },
      stakeholder: {
        get: async (params) => {
          const r = await getStakeholderAsOcf(client, params);
          return toContractResult(r.stakeholder, r.contractId);
        },
      },
      stockClass: {
        get: async (params) => {
          const r = await getStockClassAsOcf(client, params);
          return toContractResult(r.stockClass, r.contractId);
        },
      },
      stockLegendTemplate: {
        get: async (params) => {
          const r = await getStockLegendTemplateAsOcf(client, params);
          return toContractResult(r.stockLegendTemplate, r.contractId);
        },
      },
      stockPlan: {
        get: async (params) => {
          const r = await getStockPlanAsOcf(client, params);
          return toContractResult(r.stockPlan, r.contractId);
        },
      },
      vestingTerms: {
        get: async (params) => {
          const r = await getVestingTermsAsOcf(client, params);
          return toContractResult(r.vestingTerms, r.contractId);
        },
      },
      valuation: {
        get: async (params) => {
          const r = await getValuationAsOcf(client, params);
          return toContractResult(r.valuation, r.contractId);
        },
      },
      document: {
        get: async (params) => {
          const r = await getDocumentAsOcf(client, params);
          return toContractResult(r.document, r.contractId);
        },
      },

      // ===== Issuances =====
      stockIssuance: {
        get: async (params) => {
          const r = await getStockIssuanceAsOcf(client, params);
          return toContractResult(r.stockIssuance, r.contractId);
        },
      },
      equityCompensationIssuance: {
        get: async (params) => {
          const r = await getEquityCompensationIssuanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      warrantIssuance: {
        get: async (params) => {
          const r = await getWarrantIssuanceAsOcf(client, params);
          return toContractResult(r.warrantIssuance, r.contractId);
        },
      },
      convertibleIssuance: {
        get: async (params) => {
          const r = await getConvertibleIssuanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Transfers =====
      stockTransfer: {
        get: async (params) => {
          const r = await getStockTransferAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      warrantTransfer: {
        get: async (params) => {
          const r = await getWarrantTransferAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      convertibleTransfer: {
        get: async (params) => {
          const r = await getConvertibleTransferAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      equityCompensationTransfer: {
        get: async (params) => {
          const r = await getEquityCompensationTransferAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Cancellations =====
      stockCancellation: {
        get: async (params) => {
          const r = await getStockCancellationAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      warrantCancellation: {
        get: async (params) => {
          const r = await getWarrantCancellationAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      convertibleCancellation: {
        get: async (params) => {
          const r = await getConvertibleCancellationAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      equityCompensationCancellation: {
        get: async (params) => {
          const r = await getEquityCompensationCancellationAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Retractions =====
      stockRetraction: genericEntity<OcfStockRetractionOutput>('stockRetraction'),
      warrantRetraction: genericEntity<OcfWarrantRetractionOutput>('warrantRetraction'),
      convertibleRetraction: genericEntity<OcfConvertibleRetractionOutput>('convertibleRetraction'),
      equityCompensationRetraction:
        genericEntity<OcfEquityCompensationRetractionOutput>('equityCompensationRetraction'),

      // ===== Exercises =====
      equityCompensationExercise: {
        get: async (params) => {
          const r = await getEquityCompensationExerciseAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      warrantExercise: {
        get: async (params) => {
          const r = await getWarrantExerciseAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Conversions =====
      stockConversion: {
        get: async (params) => {
          const r = await getStockConversionAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      convertibleConversion: {
        get: async (params) => {
          const r = await getConvertibleConversionAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Acceptances =====
      stockAcceptance: {
        get: async (params) => {
          const r = await getStockAcceptanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      warrantAcceptance: {
        get: async (params) => {
          const r = await getWarrantAcceptanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      convertibleAcceptance: {
        get: async (params) => {
          const r = await getConvertibleAcceptanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      equityCompensationAcceptance: {
        get: async (params) => {
          const r = await getEquityCompensationAcceptanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Adjustments =====
      issuerAuthorizedSharesAdjustment: {
        get: async (params) => {
          const r = await getIssuerAuthorizedSharesAdjustmentAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockClassAuthorizedSharesAdjustment: {
        get: async (params) => {
          const r = await getStockClassAuthorizedSharesAdjustmentAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockClassConversionRatioAdjustment: {
        get: async (params) => {
          const r = await getStockClassConversionRatioAdjustmentAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockClassSplit: {
        get: async (params) => {
          const r = await getStockClassSplitAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockPlanPoolAdjustment: {
        get: async (params) => {
          const r = await getStockPlanPoolAdjustmentAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockPlanReturnToPool: genericEntity<OcfStockPlanReturnToPoolOutput>('stockPlanReturnToPool'),

      // ===== Other Transactions =====
      stockRepurchase: {
        get: async (params) => {
          const r = await getStockRepurchaseAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockConsolidation: {
        get: async (params) => {
          const r = await getStockConsolidationAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stockReissuance: {
        get: async (params) => {
          const r = await getStockReissuanceAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      equityCompensationRelease: genericEntity<OcfEquityCompensationReleaseOutput>('equityCompensationRelease'),
      equityCompensationRepricing: genericEntity<OcfEquityCompensationRepricingOutput>('equityCompensationRepricing'),

      // ===== Vesting =====
      vestingStart: {
        get: async (params) => {
          const r = await getVestingStartAsOcf(client, params);
          return toContractResult(r.vestingStart, r.contractId);
        },
      },
      vestingEvent: {
        get: async (params) => {
          const r = await getVestingEventAsOcf(client, params);
          return toContractResult(r.vestingEvent, r.contractId);
        },
      },
      vestingAcceleration: {
        get: async (params) => {
          const r = await getVestingAccelerationAsOcf(client, params);
          return toContractResult(r.vestingAcceleration, r.contractId);
        },
      },

      // ===== Stakeholder Events =====
      stakeholderRelationshipChangeEvent: {
        get: async (params) => {
          const r = await getStakeholderRelationshipChangeEventAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },
      stakeholderStatusChangeEvent: {
        get: async (params) => {
          const r = await getStakeholderStatusChangeEventAsOcf(client, params);
          return toContractResult(r.event, r.contractId);
        },
      },

      // ===== Authorization =====
      issuerAuthorization: {
        authorize: async (params: AuthorizeIssuerParams) => {
          const hasPerCallOverride = params.factoryContractId != null || params.factoryTemplateId != null;
          const clientFactory = hasCompleteFactoryCoordinates(this.factory) ? this.factory : undefined;
          if (!hasPerCallOverride && this.factory !== undefined && clientFactory === undefined) {
            throw new OcpValidationError('factory', 'factory override must include contractId and templateId', {
              code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
            });
          }
          if (!hasPerCallOverride && clientFactory === undefined && requiresExplicitFactory(this.environment)) {
            throw new OcpValidationError(
              'factory',
              `factory override is required for ${this.environment} issuer authorization`,
              { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
            );
          }

          return authorizeIssuer(
            client,
            this.withObservability({
              ...params,
              ...(hasPerCallOverride
                ? {}
                : {
                    factoryContractId: clientFactory?.contractId,
                    factoryTemplateId: clientFactory?.templateId,
                  }),
            })
          );
        },
        withdraw: async (params: WithdrawAuthorizationParams) =>
          withdrawAuthorization(client, this.withObservability(params)),
      },

      // ===== Batch Updates & Lifecycle =====
      capTable: {
        classify: async (issuerPartyId: string) => classifyIssuerCapTables(client, issuerPartyId),
        getState: async (issuerPartyId: string) => getCapTableState(client, issuerPartyId),
        update: (params: CapTableUpdateParams) => new CapTableBatch(this.withObservability(params), client),
        archive: async (params: ArchiveCapTableParams) => archiveCapTable(client, this.withObservability(params)),
      },
    };
  }
}

// ===== Type Definitions =====

/** OCP Factory contract coordinates for custom deployments (localnet, staging, etc.). */
export interface OcpFactoryCoordinates {
  /** Contract ID of the deployed OCP Factory */
  contractId: string;
  /** Template ID of the deployed OCP Factory */
  templateId: string;
}

/**
 * Clients consumed by {@link OcpClient}.
 *
 * Usually obtained from `new Canton({ network })` (or equivalent): pass `{ ledger: canton.ledger, validator: canton.validator }`.
 * **`validator`** is optional for cap-table-only usage of this SDK.
 */
export interface OcpClientDependencies extends OcpObservabilityOptions {
  readonly ledger: LedgerJsonApiClient;
  readonly validator?: ValidatorApiClient;
  /**
   * Optional factory override — use when deploying your own OCP Factory (e.g. localnet, staging, or custom network).
   * If omitted, the SDK resolves factory coords from the bundled network config.
   */
  readonly factory?: OcpFactoryCoordinates;
  readonly environment?: OcpEnvironment;
  readonly productionSafetyChecks?: boolean;
}

export type OcpClientEnvironmentOptions = EnvironmentConfigInput & {
  readonly factory?: OcpFactoryCoordinates;
  readonly productionSafetyChecks?: boolean;
};

export type OcpClientPresetOptions = Omit<Partial<EnvironmentConfigInput>, 'environment'> & {
  readonly factory?: OcpFactoryCoordinates;
  readonly productionSafetyChecks?: boolean;
};

export type OcpClientHostedPresetOptions = OcpClientPresetOptions &
  Required<Pick<EnvironmentConfig, 'ledgerApiUrl' | 'authUrl' | 'clientId' | 'clientSecret'>>;

export type OcpClientEnvOptions = Partial<EnvironmentConfigInput> & {
  readonly factory?: OcpFactoryCoordinates;
  readonly productionSafetyChecks?: boolean;
};

function requiresExplicitFactory(environment: OcpEnvironment | undefined): boolean {
  return environment === 'localnet' || environment === 'custom' || environment === 'scratchnet';
}

function hasCompleteFactoryCoordinates(factory: OcpFactoryCoordinates | undefined): factory is OcpFactoryCoordinates {
  return (
    typeof factory?.contractId === 'string' &&
    factory.contractId.trim().length > 0 &&
    typeof factory.templateId === 'string' &&
    factory.templateId.trim().length > 0
  );
}

function validateFactoryCoordinates(factory: OcpFactoryCoordinates | undefined): void {
  if (factory !== undefined && !hasCompleteFactoryCoordinates(factory)) {
    throw new OcpValidationError('factory', 'factory override must include contractId and templateId', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    });
  }
}

function validateInjectedEnvironment(environment: OcpEnvironment | undefined, ledger: LedgerJsonApiClient): void {
  if (environment === undefined) {
    return;
  }

  const ledgerNetwork = ledger.getNetwork();
  const expectedNetwork = toCantonNetwork(environment);
  if (ledgerNetwork !== expectedNetwork) {
    throw new OcpValidationError(
      'environment',
      `environment ${environment} does not match ledger network ${ledgerNetwork}`,
      {
        code: OcpErrorCodes.INVALID_FORMAT,
        expectedType: expectedNetwork,
        receivedValue: ledgerNetwork,
      }
    );
  }
}

/** Parameters for creating a batch cap table update */
interface CapTableUpdateParams extends CommandObservabilityOptions {
  /** The contract ID of the CapTable to update */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
  /** Optional deterministic command ID for idempotent retry handling. */
  commandId?: string;
  /** Party IDs to act as (signatories) */
  actAs: string[];
  /** Optional additional party IDs for read access */
  readAs?: string[];
}

/** Entity namespace with a single `get()` method */
interface EntityReader<T> {
  /** Retrieve a contract by ID and return its OCF data */
  get: (params: GetByContractIdParams) => Promise<ContractResult<T>>;
}

/**
 * Core cap table operations, organized by entity type.
 *
 * Each entity has a `get()` method that returns `ContractResult<T>` with
 * `{ data, contractId }`. The `data` field contains the OCF entity with
 * an `object_type` discriminant for type-safe pattern matching.
 */
interface OpenCapTableMethods {
  // Objects
  issuer: EntityReader<OcfIssuerOutput> & {
    /** Build a CreateIssuer command (for use with transaction batches) */
    buildCreate: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
  };
  stakeholder: EntityReader<OcfStakeholderOutput>;
  stockClass: EntityReader<OcfStockClassOutput>;
  stockLegendTemplate: EntityReader<OcfStockLegendTemplateOutput>;
  stockPlan: EntityReader<OcfStockPlanOutput>;
  vestingTerms: EntityReader<OcfVestingTermsOutput>;
  valuation: EntityReader<OcfValuationOutput>;
  document: EntityReader<OcfDocumentOutput>;

  // Issuances
  stockIssuance: EntityReader<OcfStockIssuanceOutput>;
  equityCompensationIssuance: EntityReader<OcfEquityCompensationIssuanceOutput>;
  warrantIssuance: EntityReader<OcfWarrantIssuanceOutput>;
  convertibleIssuance: EntityReader<OcfConvertibleIssuanceOutput>;

  // Transfers
  stockTransfer: EntityReader<OcfStockTransferOutput>;
  warrantTransfer: EntityReader<OcfWarrantTransferOutput>;
  convertibleTransfer: EntityReader<OcfConvertibleTransferOutput>;
  equityCompensationTransfer: EntityReader<OcfEquityCompensationTransferOutput>;

  // Cancellations
  stockCancellation: EntityReader<OcfStockCancellationOutput>;
  warrantCancellation: EntityReader<OcfWarrantCancellationOutput>;
  convertibleCancellation: EntityReader<OcfConvertibleCancellationOutput>;
  equityCompensationCancellation: EntityReader<OcfEquityCompensationCancellationOutput>;

  // Retractions
  stockRetraction: EntityReader<OcfStockRetractionOutput>;
  warrantRetraction: EntityReader<OcfWarrantRetractionOutput>;
  convertibleRetraction: EntityReader<OcfConvertibleRetractionOutput>;
  equityCompensationRetraction: EntityReader<OcfEquityCompensationRetractionOutput>;

  // Exercises
  equityCompensationExercise: EntityReader<OcfEquityCompensationExerciseOutput>;
  warrantExercise: EntityReader<OcfWarrantExerciseOutput>;

  // Conversions
  stockConversion: EntityReader<OcfStockConversionOutput>;
  convertibleConversion: EntityReader<OcfConvertibleConversionOutput>;

  // Acceptances
  stockAcceptance: EntityReader<OcfStockAcceptanceOutput>;
  warrantAcceptance: EntityReader<OcfWarrantAcceptanceOutput>;
  convertibleAcceptance: EntityReader<OcfConvertibleAcceptanceOutput>;
  equityCompensationAcceptance: EntityReader<OcfEquityCompensationAcceptanceOutput>;

  // Adjustments
  issuerAuthorizedSharesAdjustment: EntityReader<OcfIssuerAuthorizedSharesAdjustmentOutput>;
  stockClassAuthorizedSharesAdjustment: EntityReader<OcfStockClassAuthorizedSharesAdjustmentOutput>;
  stockClassConversionRatioAdjustment: EntityReader<OcfStockClassConversionRatioAdjustmentOutput>;
  stockClassSplit: EntityReader<OcfStockClassSplitOutput>;
  stockPlanPoolAdjustment: EntityReader<OcfStockPlanPoolAdjustmentOutput>;
  stockPlanReturnToPool: EntityReader<OcfStockPlanReturnToPoolOutput>;

  // Other transactions
  stockRepurchase: EntityReader<OcfStockRepurchaseOutput>;
  stockConsolidation: EntityReader<OcfStockConsolidationOutput>;
  stockReissuance: EntityReader<OcfStockReissuanceOutput>;
  equityCompensationRelease: EntityReader<OcfEquityCompensationReleaseOutput>;
  equityCompensationRepricing: EntityReader<OcfEquityCompensationRepricingOutput>;

  // Vesting
  vestingStart: EntityReader<OcfVestingStartOutput>;
  vestingEvent: EntityReader<OcfVestingEventOutput>;
  vestingAcceleration: EntityReader<OcfVestingAccelerationOutput>;

  // Stakeholder Events
  stakeholderRelationshipChangeEvent: EntityReader<OcfStakeholderRelationshipChangeEventOutput>;
  stakeholderStatusChangeEvent: EntityReader<OcfStakeholderStatusChangeEventOutput>;

  // Authorization
  issuerAuthorization: {
    /** Authorize an issuer using the OCP Factory contract */
    authorize: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    /** Withdraw an issuer's authorization */
    withdraw: (params: WithdrawAuthorizationParams) => Promise<WithdrawAuthorizationResult>;
  };

  // Batch Updates & Lifecycle
  capTable: {
    /**
     * Whether the issuer has an active CapTable on **this SDK’s pinned OpenCapTable package line** only.
     * @remarks A `none` result does not mean the issuer has no CapTable on other package versions—see {@link getCapTableState}.
     */
    classify: (issuerPartyId: string) => Promise<IssuerCapTableClassification>;
    /**
     * Snapshot of entity inventories for the pinned-template CapTable, or `null` if none on that line.
     * @returns `null` when the filtered ledger query finds no matching CapTable; otherwise {@link CapTableState}.
     */
    getState: (issuerPartyId: string) => Promise<CapTableState | null>;
    /**
     * Start a fluent {@link CapTableBatch}: chain `create` / `edit` / `delete`, then `build` or `execute`.
     */
    update: (params: CapTableUpdateParams) => CapTableBatch;
    /**
     * Archive the CapTable and issuer (system operator). Entity maps must be empty first—delete via `update` batch.
     * @throws Errors from the ledger if preconditions are not met
     */
    archive: (params: ArchiveCapTableParams) => Promise<ArchiveCapTableResult>;
  };
}
