/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * The OcpClient provides a clean, organized API for OCP operations, grouped by domain:
 *
 * - **OpenCapTable**: Core cap table reads (issuer, stakeholders, stock classes, issuances, etc.), whole-book
 *   reads of the OpenCapTable-v35 register (`OpenCapTable.register`) and the three-step cap table setup
 *   (`OpenCapTable.setup`)
 *
 * Payment-stream, coupon-minter, and related validator-backed helpers were removed in v0.4.0. Consumers that need those flows must implement them against the injected ledger and validator clients (or other integration of their choice).
 *
 * **Company valuation reports** (`OpenCapTableReports`) are not part of this package (removed from the public client in v0.5.0+).
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
 * ```
 *
 * @example For localnet or custom factory deployments
 * ```typescript
 * // The factory is identified by its factory_id and system operator, not by a contract ID: each authorization
 * // consumes it, and the live contract is found at call time.
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   factory: { factoryId: 'acme', systemOperator: systemOperatorParty },
 * });
 * await ocp.OpenCapTable.setup.createFactory();
 * ```
 *
 * @see https://github.com/Fairmint/ocp-canton-sdk/wiki
 *
 * @module
 */

import { Canton, type LedgerJsonApiClient, type ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
import {
  assertOpenCapTableV35Network,
  loadEnvironmentConfigFromEnv,
  resolveEnvironmentConfig,
  resolveFactoryIdentity,
  toCantonNetwork,
  toResolvedCantonConfig,
  type EnvironmentConfig,
  type EnvironmentConfigInput,
  type OcpEnvironment,
} from './environment';
import { OcpErrorCodes, OcpValidationError } from './errors';
import { CapTableApply, type CapTableApplyParams } from './functions/OpenCapTable/capTable/apply';
import {
  buildFreezeClassCommand,
  buildUnfreezeClassCommand,
  readFreezeClassResult,
  readUnfreezeClassResult,
} from './functions/OpenCapTable/capTable/classFreeze';
import { getEntityAsOcf } from './functions/OpenCapTable/capTable/damlToOcf';
import {
  mapOcfObjectTypeToEntityType,
  type OcfDataTypeFor,
  type OcfEntityType,
  type OcfReadableDataForObjectType,
  type OcfReadableObjectType,
} from './functions/OpenCapTable/capTable/entityTypes';
import {
  buildCancelHoldsCommand,
  buildPlaceHoldsCommand,
  readCancelHoldsResult,
  readPlaceHoldsResult,
} from './functions/OpenCapTable/capTable/holds';
import { CapTableRestate, type CapTableRestateParams } from './functions/OpenCapTable/capTable/restate';
import { buildSettleCommand, findSettleResults, readSettleResult } from './functions/OpenCapTable/capTable/settle';
import {
  buildBeginTeardownCommand,
  buildCloseCommand,
  buildPurgeCommand,
  readBeginTeardownResult,
  readCloseResult,
} from './functions/OpenCapTable/capTable/teardown';
import { createFactory } from './functions/OpenCapTable/factory/createFactory';
import { validateFactoryIdentity } from './functions/OpenCapTable/factory/factoryIdentity';
import { findFactory } from './functions/OpenCapTable/factory/findFactory';
import {
  acceptIssuerAuthorization,
  type AcceptIssuerAuthorizationParams,
} from './functions/OpenCapTable/issuerAuthorization/acceptIssuerAuthorization';
import {
  authorizeIssuer,
  type AuthorizeIssuerParams,
} from './functions/OpenCapTable/issuerAuthorization/authorizeIssuer';
import {
  buildCreateCapTableCommand,
  readCreateCapTableResult,
  type BuildCreateCapTableParams,
} from './functions/OpenCapTable/issuerAuthorization/createCapTable';
import {
  withdrawAuthorization,
  type WithdrawAuthorizationParams,
} from './functions/OpenCapTable/issuerAuthorization/withdrawAuthorization';
import { mergeCommandContext, type CommandObservabilityOptions, type OcpObservabilityOptions } from './observability';
import {
  findCapTables,
  readRegister,
  type FindCapTablesOptions,
  type FoundCapTables,
  type ReadRegisterOptions,
  type RegisterSnapshot,
} from './register/reader';
import type { ContractResult, GetByContractIdParams, SubmitAndWaitForTransactionResponse } from './types/common';
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
  OcfFinancingOutput,
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
  OcfStockHoldCancellationOutput,
  OcfStockHoldOutput,
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
import type {
  AcceptIssuerAuthorizationResult,
  AuthorizeIssuerResult,
  CreateCapTableCommand,
  CreateCapTableResult,
  CreateFactoryResult,
  LiveOcpFactory,
  OcpFactoryIdentity,
  WithdrawAuthorizationResult,
} from './types/setup';

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
 * ocp.context.setTransferAgentParty(transferAgentPartyId);
 * ocp.context.setCapTableId(capTableId);
 *
 * // Later, retrieve cached values when needed
 * const issuerParty = ocp.context.requireIssuerParty();
 * const capTableContractId = ocp.context.requireCapTableContractId();
 * ```
 */
export interface OcpContext {
  /** The cached issuer party ID */
  issuerParty: string | null;
  /** The cached transfer agent party ID: the party that writes the cap table */
  transferAgentParty: string | null;
  /** The cached cap table ID (`<factory_id>-<n>`), which names the book in every contract's context */
  capTableId: string | null;
  /** The cached contract ID of the cap table's `CapTable` anchor contract */
  capTableContractId: string | null;
}

/**
 * Manager for OCP operation context.
 *
 * Provides methods to set, get, and clear cached context values.
 */
export class OcpContextManager implements OcpContext {
  private _issuerParty: string | null = null;
  private _transferAgentParty: string | null = null;
  private _capTableId: string | null = null;
  private _capTableContractId: string | null = null;

  /** Get the cached issuer party ID */
  get issuerParty(): string | null {
    return this._issuerParty;
  }

  /** Get the cached transfer agent party ID */
  get transferAgentParty(): string | null {
    return this._transferAgentParty;
  }

  /** Get the cached cap table ID */
  get capTableId(): string | null {
    return this._capTableId;
  }

  /** Get the cached contract ID of the `CapTable` anchor contract */
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
   * Set the transfer agent party ID.
   * @param partyId - The party ID to cache
   */
  setTransferAgentParty(partyId: string): void {
    this._transferAgentParty = partyId;
  }

  /**
   * Set the cap table ID.
   * @param capTableId - The cap table ID (`<factory_id>-<n>`) to cache
   */
  setCapTableId(capTableId: string): void {
    this._capTableId = capTableId;
  }

  /**
   * Set the contract ID of the `CapTable` anchor contract.
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
    if (context.transferAgentParty !== undefined) {
      this._transferAgentParty = context.transferAgentParty;
    }
    if (context.capTableId !== undefined) {
      this._capTableId = context.capTableId;
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
   * Get the transfer agent party or throw if not set.
   * @throws OcpValidationError if the transfer agent party has not been set
   */
  requireTransferAgentParty(): string {
    if (!this._transferAgentParty) {
      throw new OcpValidationError(
        'context.transferAgentParty',
        'Transfer agent party not set. Call context.setTransferAgentParty() first.',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
      );
    }
    return this._transferAgentParty;
  }

  /**
   * Get the cap table ID or throw if not set.
   * @throws OcpValidationError if the cap table ID has not been set
   */
  requireCapTableId(): string {
    if (!this._capTableId) {
      throw new OcpValidationError('context.capTableId', 'Cap table ID not set. Call context.setCapTableId() first.', {
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      });
    }
    return this._capTableId;
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
    this._transferAgentParty = null;
    this._capTableId = null;
    this._capTableContractId = null;
  }
}

// ===== OcpClient =====

/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * **Namespaced APIs** (each mirrors a domain of the DAML model):
 * - {@link OcpClient.OpenCapTable} — issuer, stakeholders, stock classes, issuances and the other OCF record readers,
 *   whole-book reads (`register`) and the three-step cap table setup (`setup`)
 *
 * Prefer {@link OcpClient.context} to cache the issuer and transfer agent parties, the cap table ID and the anchor
 * contract ID across calls.
 *
 * Payment-stream, coupon-minter, and related flows are not included (removed in v0.4.0); implement them with the same injected `ledger` / `validator` clients or your own modules.
 *
 * @example Wire client and read the issuer
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
 * ```
 *
 * @example For localnet or custom factory deployments
 * ```typescript
 * import { OcpClient } from '@open-captable-protocol/canton';
 * import { Canton } from '@fairmint/canton-node-sdk';
 *
 * const canton = new Canton({ network: 'localnet' });
 * // The factory is identified by its factory_id and system operator, not by a contract ID: each authorization
 * // consumes it, and the live contract is found at call time.
 * const ocp = new OcpClient({
 *   ledger: canton.ledger,
 *   factory: { factoryId: 'acme', systemOperator: systemOperatorParty },
 * });
 * ```
 *
 * @example The three-step cap table setup
 * ```typescript
 * // 1. system_operator takes the next cap table ID and pins the issuer's transfer agent
 * const authorized = await ocp.OpenCapTable.setup.authorizeIssuer({ issuer, transferAgent });
 * // 2. the transfer agent accepts
 * const { authorization } = await ocp.OpenCapTable.setup.acceptAuthorization({
 *   authorizationContractId: authorized.authorizationContractId,
 *   transferAgent,
 * });
 * // 3. the issuer creates the cap table, with the authorization disclosed
 * const { command, disclosedContracts, actAs } = ocp.OpenCapTable.setup.buildCreateCapTable({
 *   authorization,
 *   transferAgent,
 *   issuerData,
 * });
 * ```
 */
export class OcpClient {
  /** The injected Ledger JSON API client for direct ledger access */
  public readonly ledger: LedgerJsonApiClient;

  /** Optional injected Validator API client for validator-backed workflows */
  public readonly validator?: ValidatorApiClient;

  /**
   * Optional factory identity when not using the identity the Daml package ships for the network (it ships DevNet's
   * once that factory exists; any other network, such as localnet or staging, needs one). Resolved when a setup call
   * needs it.
   */
  public readonly factory?: OcpFactoryIdentity;

  /** Logical Canton environment when this client was created through environment helpers. */
  public readonly environment?: OcpEnvironment;

  /** Optional logger, metrics, and default command context for OCP write operations. */
  public readonly observability: OcpObservabilityOptions;

  private productionSafetyChecksEnabled: boolean;

  /**
   * Context manager for caching commonly used values.
   *
   * Use this to store the issuer and transfer agent parties, the cap table ID and the anchor contract ID after
   * fetching them once, so they can be reused across operations.
   */
  public readonly context: OcpContextManager = new OcpContextManager();

  /** Core cap table operations */
  public readonly OpenCapTable: OpenCapTableMethods;

  /**
   * @param dependencies - **`ledger`** — required for OpenCapTable reads.
   * **`validator`** — optional when using cap-table-only APIs from this package.
   */
  constructor(dependencies: OcpClientDependencies) {
    validateInjectedEnvironment(dependencies.environment, dependencies.ledger);
    if (dependencies.factory !== undefined) validateFactoryIdentity(dependencies.factory);
    this.ledger = dependencies.ledger;
    this.validator = dependencies.validator;
    this.factory =
      dependencies.factory === undefined
        ? undefined
        : {
            factoryId: dependencies.factory.factoryId,
            systemOperator: dependencies.factory.systemOperator,
            ...(dependencies.factory.templateId !== undefined ? { templateId: dependencies.factory.templateId } : {}),
          };
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

  /** The network this client talks to: its logical environment when it has one, else the ledger's network. */
  private network(): string {
    return this.environment ?? this.ledger.getNetwork();
  }

  /** The factory identity a setup call uses, resolved when called (see {@link OcpClient.factory}). */
  private resolveFactory(): OcpFactoryIdentity {
    return resolveFactoryIdentity(this.network(), this.factory);
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
   * Use with `addBuiltCommand` / `addCommand` from `@fairmint/canton-node-sdk` when composing custom flows.
   *
   * @param params.actAs - Parties that authorize the submission (signatories).
   * @param params.readAs - Optional parties granted read access for contract resolution.
   * @returns Fluent batch builder; call `addBuiltCommand` or `addCommand`, then `submitAndWaitForTransaction`.
   *
   * @example
   * ```typescript
   * const batch = ocp.createBatch({ actAs: [issuerPartyId] });
   * await batch.addBuiltCommand(builtCommand).submitAndWaitForTransaction();
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
      issuer: genericEntity('issuer'),
      stakeholder: genericEntity('stakeholder'),
      stockClass: genericEntity('stockClass'),
      stockLegendTemplate: genericEntity('stockLegendTemplate'),
      stockPlan: genericEntity('stockPlan'),
      vestingTerms: genericEntity('vestingTerms'),
      valuation: genericEntity('valuation'),
      financing: genericEntity('financing'),
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

      // ===== Holds (Fairmint OCF extension, written by the register itself) =====
      stockHold: genericEntity('stockHold'),
      stockHoldCancellation: genericEntity('stockHoldCancellation'),

      // ===== Stakeholder Events =====
      stakeholderRelationshipChangeEvent: genericEntity('stakeholderRelationshipChangeEvent'),
      stakeholderStatusChangeEvent: genericEntity('stakeholderStatusChangeEvent'),
    } satisfies Omit<OpenCapTableMethods, 'getByObjectType' | 'register' | 'setup' | 'capTable'>;

    const objectReaders = {
      CE_STAKEHOLDER_RELATIONSHIP: methods.stakeholderRelationshipChangeEvent,
      CE_STAKEHOLDER_STATUS: methods.stakeholderStatusChangeEvent,
      DOCUMENT: methods.document,
      FINANCING: methods.financing,
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
      TX_STOCK_HOLD: methods.stockHold,
      TX_STOCK_HOLD_CANCELLATION: methods.stockHoldCancellation,
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

    const setup: SetupMethods = {
      createFactory: async (params = {}) => {
        const factory = this.resolveFactory();
        return createFactory(client, {
          ...this.withObservability(params),
          systemOperator: factory.systemOperator,
          factoryId: factory.factoryId,
          ...(factory.templateId !== undefined ? { templateId: factory.templateId } : {}),
        });
      },
      findFactory: async () => {
        const factory = this.resolveFactory();
        return findFactory(client, {
          systemOperator: factory.systemOperator,
          factoryId: factory.factoryId,
          ...(factory.templateId !== undefined ? { templateId: factory.templateId } : {}),
        });
      },
      authorizeIssuer: async (params) => {
        const factory = this.resolveFactory();
        return authorizeIssuer(client, {
          ...this.withObservability(params),
          systemOperator: factory.systemOperator,
          factoryId: factory.factoryId,
          ...(factory.templateId !== undefined ? { templateId: factory.templateId } : {}),
        });
      },
      acceptAuthorization: async (params) => {
        assertOpenCapTableV35Network(this.network());
        return acceptIssuerAuthorization(client, this.withObservability(params));
      },
      buildCreateCapTable: (params) => buildCreateCapTableCommand(params),
      readCreateCapTableResult: (response) => readCreateCapTableResult(response),
      withdrawAuthorization: async (params) => {
        const factory = this.resolveFactory();
        return withdrawAuthorization(client, {
          ...this.withObservability(params),
          systemOperator: factory.systemOperator,
        });
      },
    };

    const capTable: CapTableMethods = {
      apply: (params) => {
        assertOpenCapTableV35Network(this.network());
        return new CapTableApply(this.withObservability(params), client);
      },
      restate: (params) => {
        assertOpenCapTableV35Network(this.network());
        return new CapTableRestate(this.withObservability(params), client);
      },
      buildPlaceHolds: buildPlaceHoldsCommand,
      readPlaceHoldsResult,
      buildCancelHolds: buildCancelHoldsCommand,
      readCancelHoldsResult,
      buildSettle: buildSettleCommand,
      readSettleResult,
      findSettleResults,
      buildFreezeClass: buildFreezeClassCommand,
      readFreezeClassResult,
      buildUnfreezeClass: buildUnfreezeClassCommand,
      readUnfreezeClassResult,
      buildBeginTeardown: buildBeginTeardownCommand,
      readBeginTeardownResult,
      buildPurge: buildPurgeCommand,
      buildClose: buildCloseCommand,
      readCloseResult,
    };

    return {
      register: {
        read: async (options) => readRegister(client, options),
        findCapTables: async (options) => findCapTables(client, options),
      },
      setup,
      capTable,
      getByObjectType: async ({ objectType, ...params }) => {
        const reader = selectObjectTypeReader(objectReaders, objectType);
        return reader.get(params);
      },
      ...methods,
    };
  }
}

// ===== Type Definitions =====

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
   * Optional factory identity — use when deploying your own OCP Factory (e.g. localnet, staging, or custom network).
   * If omitted, the SDK resolves the identity the Daml package ships for the network, when it ships one.
   */
  readonly factory?: OcpFactoryIdentity;
  readonly environment?: OcpEnvironment;
  readonly productionSafetyChecks?: boolean;
}

export type OcpClientEnvironmentOptions = EnvironmentConfigInput & {
  readonly factory?: OcpFactoryIdentity;
  readonly productionSafetyChecks?: boolean;
};

export type OcpClientPresetOptions = Omit<Partial<EnvironmentConfigInput>, 'environment'> & {
  readonly factory?: OcpFactoryIdentity;
  readonly productionSafetyChecks?: boolean;
};

export type OcpClientHostedPresetOptions = OcpClientPresetOptions &
  Required<Pick<EnvironmentConfig, 'ledgerApiUrl' | 'authUrl' | 'clientId' | 'clientSecret'>>;

export type OcpClientEnvOptions = Partial<EnvironmentConfigInput> & {
  readonly factory?: OcpFactoryIdentity;
  readonly productionSafetyChecks?: boolean;
};

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

/** Entity namespace with a single `get()` method */
interface EntityReader<T> {
  /** Retrieve a contract by ID and return its OCF data */
  get: (params: GetByContractIdParams) => Promise<ContractResult<T>>;
}

/** Reads of whole OpenCapTable-v35 books from the active contract set. */
interface RegisterReaderMethods {
  /**
   * Read the books a party can see at one offset, admitting only genuine v35 register contracts and indexing each book
   * by key (`register.readRegister`).
   */
  read: (options: ReadRegisterOptions) => Promise<RegisterSnapshot>;
  /** List the cap tables a party can read (`register.findCapTables`). */
  findCapTables: (options: FindCapTablesOptions) => Promise<FoundCapTables>;
}

/**
 * The three-step cap table setup: `system_operator` authorizes an issuer and pins its transfer agent, that transfer
 * agent accepts, then the issuer creates the cap table. The factory behind step 1 is the client's factory identity,
 * resolved when a call needs it.
 */
interface SetupMethods {
  /**
   * Create the `OcpFactory` of the client's factory identity, with its counter at 1. Use it on a stack that has no
   * factory (LocalNet, staging).
   */
  createFactory: (params?: CommandObservabilityOptions) => Promise<CreateFactoryResult>;
  /** Find the live `OcpFactory` of the client's factory identity: exactly one, or an error. */
  findFactory: () => Promise<LiveOcpFactory>;
  /**
   * Step 1: as `system_operator`, take the next cap table ID and create the `IssuerAuthorization` that pins the
   * issuer's transfer agent. Refused locally unless the issuer, `system_operator` and transfer agent are three distinct
   * parties.
   */
  authorizeIssuer: (
    params: Omit<AuthorizeIssuerParams, 'systemOperator' | 'factoryId' | 'templateId'>
  ) => Promise<AuthorizeIssuerResult>;
  /** Step 2: as the pinned transfer agent, accept the authorization. Returns it recreated, ready to disclose. */
  acceptAuthorization: (params: AcceptIssuerAuthorizationParams) => Promise<AcceptIssuerAuthorizationResult>;
  /**
   * Step 3: build the issuer's `IssuerAuthorization_CreateCapTable` (submit it as `actAs`, with `disclosedContracts`).
   * Refused locally when the issuer's ID has the cap table's derived form.
   */
  buildCreateCapTable: (params: BuildCreateCapTableParams) => CreateCapTableCommand;
  /** Read the cap table, issuer and shards that step 3 created from the issuer's submission. */
  readCreateCapTableResult: (response: SubmitAndWaitForTransactionResponse) => CreateCapTableResult;
  /** As `system_operator`, withdraw an authorization before the issuer uses it. */
  withdrawAuthorization: (
    params: Omit<WithdrawAuthorizationParams, 'systemOperator'>
  ) => Promise<WithdrawAuthorizationResult>;
}

/**
 * The `CapTable` anchor's choices. Every write is the transfer agent's (`actAs: [transferAgent]`); a book being rebuilt
 * is purged and closed by `system_operator`. `apply` and `restate` return builders that submit through this client;
 * the other choices are built here and submitted by the caller (in production the trade desk places and settles a
 * trade's holds in its own choices), and their results read back from the ledger-effects transaction.
 */
interface CapTableMethods {
  /** Start a `CapTable_Apply` batch (new records, stock events, snapshots, pre-splits); `execute()` submits it */
  apply: (params: CapTableApplyParams) => CapTableApply;
  /** Start a `CapTable_Restate` (edits, deletes and the states they affect); `execute()` submits it */
  restate: (params: CapTableRestateParams) => CapTableRestate;
  /** Build `CapTable_PlaceHolds`: one hold per lot under one reference */
  buildPlaceHolds: typeof buildPlaceHoldsCommand;
  readPlaceHoldsResult: typeof readPlaceHoldsResult;
  /** Build `CapTable_CancelHolds`: whole holds, current or voided */
  buildCancelHolds: typeof buildCancelHoldsCommand;
  readCancelHoldsResult: typeof readCancelHoldsResult;
  /** Build `CapTable_Settle`, for tests and tooling; production settles through the trade desk */
  buildSettle: typeof buildSettleCommand;
  /** The delivered terms of the settlement this client submitted */
  readSettleResult: typeof readSettleResult;
  /** Every `CapTable_Settle` of a v35 anchor in a transaction, nested under a desk choice or not, with its terms */
  findSettleResults: typeof findSettleResults;
  /** Build `CapTable_FreezeClass`, which starts recording a split */
  buildFreezeClass: typeof buildFreezeClassCommand;
  readFreezeClassResult: typeof readFreezeClassResult;
  /** Build `CapTable_UnfreezeClass`, which ends recording a split */
  buildUnfreezeClass: typeof buildUnfreezeClassCommand;
  readUnfreezeClassResult: typeof readUnfreezeClassResult;
  /** Build `CapTable_BeginTeardown`, which ends every write to a book being rebuilt */
  buildBeginTeardown: typeof buildBeginTeardownCommand;
  readBeginTeardownResult: typeof readBeginTeardownResult;
  /** Build `CapTable_Purge` (`system_operator`): at most 500 of a torn-down book's contracts */
  buildPurge: typeof buildPurgeCommand;
  /** Build `CapTable_Close` (`system_operator`), which leaves the anchor as a tombstone */
  buildClose: typeof buildCloseCommand;
  readCloseResult: typeof readCloseResult;
}

/**
 * Core cap table operations, organized by entity type.
 *
 * Each entity has a `get()` method that returns `ContractResult<T>` with
 * `{ data, contractId }`. The `data` field contains the OCF entity with
 * an `object_type` discriminant for type-safe pattern matching.
 */
interface OpenCapTableMethods {
  /** Whole-book reads: the register reader and its key index */
  register: RegisterReaderMethods;

  /** The three-step cap table setup and the factory identity behind it */
  setup: SetupMethods;

  /** The anchor's choices: writes, holds, settlement, split brackets and teardown, and their results */
  capTable: CapTableMethods;

  /**
   * Retrieve a contract by OCF `object_type` without manually switching over
   * `OpenCapTable.<entity>.get()` reader namespaces.
   */
  getByObjectType: <T extends OcfReadableObjectType>(
    params: GetByObjectTypeParams<T>
  ) => Promise<ContractResult<OcfReadableDataForObjectType<T>>>;

  // Objects
  issuer: EntityReader<OcfIssuerOutput>;
  stakeholder: EntityReader<OcfStakeholderOutput>;
  stockClass: EntityReader<OcfStockClassOutput>;
  stockLegendTemplate: EntityReader<OcfStockLegendTemplateOutput>;
  stockPlan: EntityReader<OcfStockPlanOutput>;
  vestingTerms: EntityReader<OcfVestingTermsOutput>;
  valuation: EntityReader<OcfValuationOutput>;
  financing: EntityReader<OcfFinancingOutput>;
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

  // Holds (Fairmint OCF extension): read-only, the register writes them
  stockHold: EntityReader<OcfStockHoldOutput>;
  stockHoldCancellation: EntityReader<OcfStockHoldCancellationOutput>;

  // Stakeholder Events
  stakeholderRelationshipChangeEvent: EntityReader<OcfStakeholderRelationshipChangeEventOutput>;
  stakeholderStatusChangeEvent: EntityReader<OcfStakeholderStatusChangeEventOutput>;
}
