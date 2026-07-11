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
import type {
  OcpClientDependencies,
  OcpClientEnvironmentOptions,
  OcpClientEnvOptions,
  OcpClientHostedPresetOptions,
  OcpClientLocalNetOptions,
  OcpFactoryCoordinates,
} from './clientOptions';
import {
  loadEnvironmentConfigFromEnv,
  resolveEnvironmentConfig,
  toCantonNetwork,
  toResolvedCantonConfig,
  type EnvironmentConfig,
  type OcpEnvironment,
} from './environment';
import { OcpErrorCodes, OcpValidationError } from './errors';
import {
  archiveCapTable,
  type ArchiveCapTableParams,
  type ArchiveCapTableResult,
} from './functions/OpenCapTable/capTable/archiveCapTable';
import { CapTableBatch, type CapTableBatchParams } from './functions/OpenCapTable/capTable/CapTableBatch';
import { getEntityAsOcf } from './functions/OpenCapTable/capTable/damlToOcf';
import {
  mapOcfObjectTypeToEntityType,
  type OcfDataTypeFor,
  type OcfEntityType,
  type OcfReadableDataForObjectType,
  type OcfReadableObjectType,
} from './functions/OpenCapTable/capTable/entityTypes';
import {
  classifyIssuerCapTables,
  getCapTableState,
  type CapTableState,
  type IssuerCapTableClassification,
} from './functions/OpenCapTable/capTable/getCapTableState';
import { buildCreateIssuerCommand } from './functions/OpenCapTable/issuer/api';
import type { CreateIssuerParams } from './functions/OpenCapTable/issuer/types';
import { authorizeIssuer } from './functions/OpenCapTable/issuerAuthorization/authorizeIssuer';
import type {
  AuthorizeIssuerParams,
  AuthorizeIssuerResult,
  WithdrawAuthorizationParams,
  WithdrawAuthorizationResult,
} from './functions/OpenCapTable/issuerAuthorization/types';
import { withdrawAuthorization } from './functions/OpenCapTable/issuerAuthorization/withdrawAuthorization';
import { mergeCommandContext, type CommandObservabilityOptions, type OcpObservabilityOptions } from './observability';
import type { CommandWithDisclosedContracts, ContractResult, GetByContractIdParams } from './types/common';
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
import { validateFactoryCoordinates } from './utils/factoryCoordinates';

type WithClientObservability<T extends CommandObservabilityOptions> = Omit<T, keyof OcpObservabilityOptions> &
  OcpObservabilityOptions;

// ===== Helper to adapt underlying function results to ContractResult<T> =====

/**
 * Adapt an underlying `get*AsOcf` function result to the standardized `ContractResult<T>` format.
 *
 * @typeParam T - The canonical entity type returned by the underlying reader
 * @param data - Canonically typed entity data from the underlying function
 * @param contractId - The contract ID returned by the underlying function
 * @internal
 */
function toContractResult<T>(data: T, contractId: string): ContractResult<T> {
  if (data == null) {
    throw new OcpValidationError(
      'toContractResult.data',
      `Expected entity data but received ${data === null ? 'null' : 'undefined'} (contractId: ${contractId})`,
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: data }
    );
  }
  return { data, contractId };
}

function makeGenericEntityReader<T extends OcfEntityType>(
  client: LedgerJsonApiClient,
  entityType: T
): EntityReader<OcfDataTypeFor<T>> {
  return {
    get: async ({ contractId, ...options }) => {
      const r = await getEntityAsOcf(client, entityType, contractId, options);
      return toContractResult(r.data, r.contractId);
    },
  };
}

type OpenCapTableObjectReaderMap = {
  [ObjectType in OcfReadableObjectType]: EntityReader<OcfReadableDataForObjectType<ObjectType>>;
};

function selectObjectTypeReader<T extends OcfReadableObjectType>(
  readers: OpenCapTableObjectReaderMap,
  objectType: T
): OpenCapTableObjectReaderMap[T] {
  const runtimeObjectType: unknown = objectType;
  if (typeof runtimeObjectType !== 'string' || mapOcfObjectTypeToEntityType(runtimeObjectType) === null) {
    const detail = typeof runtimeObjectType === 'string' ? `: ${runtimeObjectType}` : '';
    throw new OcpValidationError('objectType', `Unsupported OCF object_type${detail}`, {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      receivedValue: objectType,
    });
  }

  return readers[runtimeObjectType as T];
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
  public readonly validator: ValidatorApiClient | undefined;

  /**
   * Optional factory coordinates when not using the bundled mainnet/devnet config
   * (e.g. localnet, staging, or a custom network).
   */
  public readonly factory: Readonly<OcpFactoryCoordinates> | undefined;

  /** Logical Canton environment when this client was created through environment helpers. */
  public readonly environment: OcpEnvironment | undefined;

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
    this.factory = dependencies.factory === undefined ? undefined : Object.freeze({ ...dependencies.factory });
    this.environment = dependencies.environment;
    this.productionSafetyChecksEnabled = dependencies.productionSafetyChecks ?? false;
    const observability: OcpObservabilityOptions = {};
    if (dependencies.logger !== undefined) observability.logger = dependencies.logger;
    if (dependencies.metrics !== undefined) observability.metrics = dependencies.metrics;
    if (dependencies.defaultContext !== undefined) observability.defaultContext = dependencies.defaultContext;
    this.observability = observability;

    this.OpenCapTable = this.createOpenCapTableMethods();
  }

  private withObservability<T extends CommandObservabilityOptions>(params: T): WithClientObservability<T> {
    const { logger, metrics, defaultContext: paramsDefaultContext, ...commandParams } = params;
    const defaultContext = mergeCommandContext(this.observability.defaultContext, paramsDefaultContext);
    return {
      ...this.observability,
      ...commandParams,
      ...(logger !== undefined ? { logger } : {}),
      ...(metrics !== undefined ? { metrics } : {}),
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
  public static forLocalNet(options: OcpClientLocalNetOptions = {}): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'localnet' });
  }

  /** Create a client for DevNet with explicit API URLs and OAuth2 credentials. */
  public static forDevNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'devnet', authMode: 'oauth2' });
  }

  /** Create a client for TestNet with explicit API URLs and OAuth2 credentials. */
  public static forTestNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'testnet', authMode: 'oauth2' });
  }

  /** Create a client for MainNet with explicit API URLs and OAuth2 credentials. */
  public static forMainNet(options: OcpClientHostedPresetOptions): OcpClient {
    return OcpClient.fromEnvironment({ ...options, environment: 'mainnet', authMode: 'oauth2' });
  }

  /** Create a client from `CANTON_*` environment variables, with optional per-call overrides. */
  public static fromEnv(options: OcpClientEnvOptions = {}): OcpClient {
    const { factory, productionSafetyChecks, ...overrides } = options;
    const config = loadEnvironmentConfigFromEnv(process.env, overrides);
    return OcpClient.fromResolvedEnvironment(config, factory, productionSafetyChecks);
  }

  private static fromEnvironment(options: OcpClientEnvironmentOptions): OcpClient {
    const { factory, productionSafetyChecks, ...environmentInput } = options;
    const environmentConfig = resolveEnvironmentConfig(environmentInput);
    return OcpClient.fromResolvedEnvironment(environmentConfig, factory, productionSafetyChecks);
  }

  private static fromResolvedEnvironment(
    environmentConfig: EnvironmentConfig,
    factory: OcpFactoryCoordinates | undefined,
    productionSafetyChecks: boolean | undefined
  ): OcpClient {
    const canton = new Canton(toResolvedCantonConfig(environmentConfig));

    return new OcpClient({
      ledger: canton.ledger,
      validator: canton.validator,
      environment: environmentConfig.environment,
      ...(factory !== undefined ? { factory } : {}),
      ...(productionSafetyChecks !== undefined ? { productionSafetyChecks } : {}),
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
   *   issuerData: {
   *     object_type: 'ISSUER',
   *     id: 'i1',
   *     legal_name: 'Co',
   *     country_of_formation: 'US',
   *     formation_date: '2020-01-01',
   *   },
   * });
   * await batch.addBuiltCommand(built).submitAndWaitForTransactionTree();
   * ```
   */
  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.ledger, params.actAs, params.readAs);
  }

  private createOpenCapTableMethods(): OpenCapTableMethods {
    const client = this.ledger;
    const genericEntity = <T extends OcfEntityType>(entityType: T): EntityReader<OcfDataTypeFor<T>> =>
      makeGenericEntityReader(client, entityType);

    const methods = {
      // ===== Objects =====
      issuer: {
        ...genericEntity('issuer'),
        buildCreate: (params) => buildCreateIssuerCommand(params),
      },
      stakeholder: genericEntity('stakeholder'),
      stockClass: genericEntity('stockClass'),
      stockLegendTemplate: genericEntity('stockLegendTemplate'),
      stockPlan: genericEntity('stockPlan'),
      vestingTerms: genericEntity('vestingTerms'),
      valuation: genericEntity('valuation'),
      document: genericEntity('document'),

      // ===== Issuances =====
      stockIssuance: genericEntity('stockIssuance'),
      equityCompensationIssuance: genericEntity('equityCompensationIssuance'),
      warrantIssuance: genericEntity('warrantIssuance'),
      convertibleIssuance: genericEntity('convertibleIssuance'),

      // ===== Transfers =====
      stockTransfer: genericEntity('stockTransfer'),
      warrantTransfer: genericEntity('warrantTransfer'),
      convertibleTransfer: genericEntity('convertibleTransfer'),
      equityCompensationTransfer: genericEntity('equityCompensationTransfer'),

      // ===== Cancellations =====
      stockCancellation: genericEntity('stockCancellation'),
      warrantCancellation: genericEntity('warrantCancellation'),
      convertibleCancellation: genericEntity('convertibleCancellation'),
      equityCompensationCancellation: genericEntity('equityCompensationCancellation'),

      // ===== Retractions =====
      stockRetraction: genericEntity('stockRetraction'),
      warrantRetraction: genericEntity('warrantRetraction'),
      convertibleRetraction: genericEntity('convertibleRetraction'),
      equityCompensationRetraction: genericEntity('equityCompensationRetraction'),

      // ===== Exercises =====
      equityCompensationExercise: genericEntity('equityCompensationExercise'),
      warrantExercise: genericEntity('warrantExercise'),

      // ===== Conversions =====
      stockConversion: genericEntity('stockConversion'),
      convertibleConversion: genericEntity('convertibleConversion'),

      // ===== Acceptances =====
      stockAcceptance: genericEntity('stockAcceptance'),
      warrantAcceptance: genericEntity('warrantAcceptance'),
      convertibleAcceptance: genericEntity('convertibleAcceptance'),
      equityCompensationAcceptance: genericEntity('equityCompensationAcceptance'),

      // ===== Adjustments =====
      issuerAuthorizedSharesAdjustment: genericEntity('issuerAuthorizedSharesAdjustment'),
      stockClassAuthorizedSharesAdjustment: genericEntity('stockClassAuthorizedSharesAdjustment'),
      stockClassConversionRatioAdjustment: genericEntity('stockClassConversionRatioAdjustment'),
      stockClassSplit: genericEntity('stockClassSplit'),
      stockPlanPoolAdjustment: genericEntity('stockPlanPoolAdjustment'),
      stockPlanReturnToPool: genericEntity('stockPlanReturnToPool'),

      // ===== Other Transactions =====
      stockRepurchase: genericEntity('stockRepurchase'),
      stockConsolidation: genericEntity('stockConsolidation'),
      stockReissuance: genericEntity('stockReissuance'),
      equityCompensationRelease: genericEntity('equityCompensationRelease'),
      equityCompensationRepricing: genericEntity('equityCompensationRepricing'),

      // ===== Vesting =====
      vestingStart: genericEntity('vestingStart'),
      vestingEvent: genericEntity('vestingEvent'),
      vestingAcceleration: genericEntity('vestingAcceleration'),

      // ===== Stakeholder Events =====
      stakeholderRelationshipChangeEvent: genericEntity('stakeholderRelationshipChangeEvent'),
      stakeholderStatusChangeEvent: genericEntity('stakeholderStatusChangeEvent'),

      // ===== Authorization =====
      issuerAuthorization: {
        authorize: async (params: AuthorizeIssuerParams) => {
          const factory = selectFactoryCoordinates(params.factory, this.factory);
          validateFactoryCoordinates(factory);
          if (factory === undefined && requiresExplicitFactory(this.environment)) {
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
              ...(factory !== undefined ? { factory } : {}),
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
    } satisfies Omit<OpenCapTableMethods, 'getByObjectType'>;

    const objectReaders = {
      CE_STAKEHOLDER_RELATIONSHIP: methods.stakeholderRelationshipChangeEvent,
      CE_STAKEHOLDER_STATUS: methods.stakeholderStatusChangeEvent,
      DOCUMENT: methods.document,
      ISSUER: methods.issuer,
      STAKEHOLDER: methods.stakeholder,
      STOCK_CLASS: methods.stockClass,
      STOCK_LEGEND_TEMPLATE: methods.stockLegendTemplate,
      STOCK_PLAN: methods.stockPlan,
      TX_CONVERTIBLE_ACCEPTANCE: methods.convertibleAcceptance,
      TX_CONVERTIBLE_CANCELLATION: methods.convertibleCancellation,
      TX_CONVERTIBLE_CONVERSION: methods.convertibleConversion,
      TX_CONVERTIBLE_ISSUANCE: methods.convertibleIssuance,
      TX_CONVERTIBLE_RETRACTION: methods.convertibleRetraction,
      TX_CONVERTIBLE_TRANSFER: methods.convertibleTransfer,
      TX_EQUITY_COMPENSATION_ACCEPTANCE: methods.equityCompensationAcceptance,
      TX_EQUITY_COMPENSATION_CANCELLATION: methods.equityCompensationCancellation,
      TX_EQUITY_COMPENSATION_EXERCISE: methods.equityCompensationExercise,
      TX_EQUITY_COMPENSATION_ISSUANCE: methods.equityCompensationIssuance,
      TX_EQUITY_COMPENSATION_RELEASE: methods.equityCompensationRelease,
      TX_EQUITY_COMPENSATION_REPRICING: methods.equityCompensationRepricing,
      TX_EQUITY_COMPENSATION_RETRACTION: methods.equityCompensationRetraction,
      TX_EQUITY_COMPENSATION_TRANSFER: methods.equityCompensationTransfer,
      TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: methods.issuerAuthorizedSharesAdjustment,
      TX_STOCK_ACCEPTANCE: methods.stockAcceptance,
      TX_STOCK_CANCELLATION: methods.stockCancellation,
      TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: methods.stockClassAuthorizedSharesAdjustment,
      TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT: methods.stockClassConversionRatioAdjustment,
      TX_STOCK_CLASS_SPLIT: methods.stockClassSplit,
      TX_STOCK_CONSOLIDATION: methods.stockConsolidation,
      TX_STOCK_CONVERSION: methods.stockConversion,
      TX_STOCK_ISSUANCE: methods.stockIssuance,
      TX_STOCK_PLAN_POOL_ADJUSTMENT: methods.stockPlanPoolAdjustment,
      TX_STOCK_PLAN_RETURN_TO_POOL: methods.stockPlanReturnToPool,
      TX_STOCK_REISSUANCE: methods.stockReissuance,
      TX_STOCK_REPURCHASE: methods.stockRepurchase,
      TX_STOCK_RETRACTION: methods.stockRetraction,
      TX_STOCK_TRANSFER: methods.stockTransfer,
      TX_VESTING_ACCELERATION: methods.vestingAcceleration,
      TX_VESTING_EVENT: methods.vestingEvent,
      TX_VESTING_START: methods.vestingStart,
      TX_WARRANT_ACCEPTANCE: methods.warrantAcceptance,
      TX_WARRANT_CANCELLATION: methods.warrantCancellation,
      TX_WARRANT_EXERCISE: methods.warrantExercise,
      TX_WARRANT_ISSUANCE: methods.warrantIssuance,
      TX_WARRANT_RETRACTION: methods.warrantRetraction,
      TX_WARRANT_TRANSFER: methods.warrantTransfer,
      VALUATION: methods.valuation,
      VESTING_TERMS: methods.vestingTerms,
    } satisfies OpenCapTableObjectReaderMap;

    return {
      getByObjectType: async ({ objectType, ...params }) => {
        const reader = selectObjectTypeReader(objectReaders, objectType);
        return reader.get(params);
      },
      ...methods,
    };
  }
}

// ===== Type Definitions =====

function requiresExplicitFactory(environment: OcpEnvironment | undefined): boolean {
  return environment === 'localnet' || environment === 'custom' || environment === 'scratchnet';
}

function selectFactoryCoordinates(
  perCallFactory: unknown,
  clientFactory: Readonly<OcpFactoryCoordinates> | undefined
): unknown {
  if (perCallFactory !== undefined) {
    return perCallFactory;
  }
  return clientFactory;
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

/** Parameters for reading an OCF contract by its `object_type` and contract ID. */
export interface GetByObjectTypeParams<
  T extends OcfReadableObjectType = OcfReadableObjectType,
> extends GetByContractIdParams {
  /** OCF `object_type` discriminant, e.g. `STOCK_CLASS` or `TX_STOCK_ISSUANCE`. */
  objectType: T;
}

/** Parameters for creating a batch cap table update */
type CapTableUpdateParams = CapTableBatchParams;

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
  /**
   * Retrieve a contract by OCF `object_type` without manually switching over
   * `OpenCapTable.<entity>.get()` reader namespaces.
   */
  getByObjectType: <T extends OcfReadableObjectType>(
    params: GetByObjectTypeParams<T>
  ) => Promise<ContractResult<OcfReadableDataForObjectType<T>>>;

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
