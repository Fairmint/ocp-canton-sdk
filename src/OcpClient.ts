/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * The OcpClient provides a clean, organized API for all OCP operations, grouped by domain:
 *
 * - **OpenCapTable**: Core cap table operations (issuer, stakeholders, stock classes, issuances, etc.)
 * - **OpenCapTableReports**: Reporting operations (company valuations)
 * - **CantonPayments**: Payment and airdrop operations
 * - **PaymentStreams**: Recurring payment stream management
 *
 * @example
 * ```typescript
 * import { OcpClient, toContractId, toPartyId } from '@open-captable-protocol/canton';
 *
 * const ocp = new OcpClient({ baseUrl: 'http://localhost:3975' });
 *
 * // Set context once to cache common parameters
 * ocp.context.setFeaturedAppRight(appRightContract);
 * ocp.context.setIssuerParty(partyId);
 *
 * // Read operations return ContractResult<T> with { data, contractId }
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({
 *   contractId: toContractId('00abc123'),
 * });
 * console.log(issuer.object_type); // 'ISSUER'
 * console.log(issuer.legal_name);
 *
 * // Batch updates
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId: toContractId('...'),
 *   actAs: [toPartyId('issuer::namespace')],
 * });
 * batch.create('stakeholder', stakeholderData);
 * await batch.execute();
 * ```
 *
 * @see https://ocp.canton.fairmint.com/ - Full SDK documentation with usage examples
 *
 * @module
 */

import type { ClientConfig, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
import { OcpErrorCodes, OcpValidationError } from './errors';
import {
  createCantonPaymentsExtension,
  createPaymentStreamsExtension,
  type CantonPaymentsMethods,
  type PaymentStreamsMethods,
} from './extensions';
import {
  addObserversToCompanyValuationReport,
  authorizeIssuer,
  buildCreateCompanyValuationReportCommand,
  buildCreateIssuerCommand,
  createCompanyValuationReport,
  getConvertibleAcceptanceAsOcf,
  getConvertibleCancellationAsOcf,
  getConvertibleConversionAsOcf,
  getConvertibleIssuanceAsOcf,
  getConvertibleTransferAsOcf,
  getDocumentAsOcf,
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
  updateCompanyValuationReport,
  withdrawAuthorization,
  type AuthorizeIssuerParams,
  type AuthorizeIssuerResult,
  type CanMintResult,
  type CouponMinterPayload,
  type CreateCompanyValuationReportParams,
  type CreateCompanyValuationReportResult,
  type CreateIssuerParams,
  type UpdateCompanyValuationParams,
  type UpdateCompanyValuationResult,
  type WithdrawAuthorizationParams,
  type WithdrawAuthorizationResult,
} from './functions';
import {
  canMintCouponsNow,
  getRateLimitStatus,
  mintWithRateLimit,
  waitUntilCanMint,
  type MintWithRateLimitOptions,
  type MintWithRateLimitResult,
  type WaitUntilCanMintOptions,
} from './functions/CouponMinter';
import { CapTableBatch } from './functions/OpenCapTable/capTable';
import type { CommandWithDisclosedContracts } from './types';
import type { ContractResult, GetByContractIdParams } from './types/common';
import type {
  OcfConvertibleAcceptanceOutput,
  OcfConvertibleCancellationOutput,
  OcfConvertibleConversionOutput,
  OcfConvertibleIssuanceOutput,
  OcfConvertibleTransferOutput,
  OcfDocumentOutput,
  OcfEquityCompensationAcceptanceOutput,
  OcfEquityCompensationCancellationOutput,
  OcfEquityCompensationExerciseOutput,
  OcfEquityCompensationIssuanceOutput,
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
  OcfStockReissuanceOutput,
  OcfStockRepurchaseOutput,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toContractResult<T>(data: any, contractId: string): ContractResult<T> {
  if (data == null) {
    throw new OcpValidationError(
      'toContractResult.data',
      `Expected entity data but received ${data === null ? 'null' : 'undefined'} (contractId: ${contractId})`,
      { code: OcpErrorCodes.REQUIRED_FIELD_MISSING, receivedValue: data }
    );
  }
  return { data: data as T, contractId };
}

// ===== Context Manager =====

/**
 * Context for OCP operations that can be cached and reused.
 *
 * Store commonly used contract details to avoid passing them repeatedly.
 *
 * @example
 * ```typescript
 * const ocp = new OcpClient({ network: 'localnet' });
 *
 * // Set context once after initial setup
 * ocp.context.setFeaturedAppRight(featuredAppRightDetails);
 *
 * // Later, retrieve cached values when needed
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId: ocp.context.requireCapTableContractId(),
 *   featuredAppRightContractDetails: ocp.context.requireFeaturedAppRight(),
 *   actAs: [ocp.context.requireIssuerParty()],
 * });
 * ```
 */
export interface OcpContext {
  /** The cached FeaturedAppRight disclosed contract details */
  featuredAppRight: DisclosedContract | null;
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
  private _featuredAppRight: DisclosedContract | null = null;
  private _issuerParty: string | null = null;
  private _capTableContractId: string | null = null;

  /** Get the cached FeaturedAppRight disclosed contract details */
  get featuredAppRight(): DisclosedContract | null {
    return this._featuredAppRight;
  }

  /** Get the cached issuer party ID */
  get issuerParty(): string | null {
    return this._issuerParty;
  }

  /** Get the cached cap table contract ID */
  get capTableContractId(): string | null {
    return this._capTableContractId;
  }

  /**
   * Set the FeaturedAppRight disclosed contract details.
   * @param details - The disclosed contract details to cache
   */
  setFeaturedAppRight(details: DisclosedContract): void {
    this._featuredAppRight = details;
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
    if (context.featuredAppRight !== undefined) {
      this._featuredAppRight = context.featuredAppRight;
    }
    if (context.issuerParty !== undefined) {
      this._issuerParty = context.issuerParty;
    }
    if (context.capTableContractId !== undefined) {
      this._capTableContractId = context.capTableContractId;
    }
  }

  /**
   * Get the FeaturedAppRight or throw if not set.
   * @throws OcpValidationError if FeaturedAppRight has not been set
   */
  requireFeaturedAppRight(): DisclosedContract {
    if (!this._featuredAppRight) {
      throw new OcpValidationError(
        'context.featuredAppRight',
        'FeaturedAppRight not set. Call context.setFeaturedAppRight() first.',
        { code: OcpErrorCodes.REQUIRED_FIELD_MISSING }
      );
    }
    return this._featuredAppRight;
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
    this._featuredAppRight = null;
    this._issuerParty = null;
    this._capTableContractId = null;
  }

  /** Check if the context has all required values for batch operations */
  isReadyForBatchOperations(): boolean {
    return this._featuredAppRight !== null && this._capTableContractId !== null;
  }
}

// ===== OcpClient =====

/**
 * High-level client for interacting with Open Cap Table Protocol (OCP) contracts on Canton.
 *
 * @example
 * ```typescript
 * import { OcpClient, toContractId } from '@open-captable-protocol/canton';
 *
 * const ocp = new OcpClient({ baseUrl: 'http://localhost:3975' });
 *
 * // Read an issuer - all get() methods return { data, contractId }
 * const { data: issuer } = await ocp.OpenCapTable.issuer.get({
 *   contractId: toContractId('00abc123'),
 * });
 * console.log(issuer.legal_name);
 * console.log(issuer.object_type); // 'ISSUER' - enables discriminated unions
 * ```
 */
export class OcpClient {
  /** The underlying LedgerJsonApiClient for direct ledger access */
  public readonly client: LedgerJsonApiClient;

  /**
   * Context manager for caching commonly used values.
   *
   * Use this to store FeaturedAppRight details, issuer party, and cap table contract ID
   * after fetching them once, so they can be reused across operations.
   */
  public readonly context: OcpContextManager = new OcpContextManager();

  /** Core cap table operations */
  public readonly OpenCapTable: OpenCapTableMethods;

  /** Reporting operations for cap table analytics */
  public readonly OpenCapTableReports: OpenCapTableReportsMethods;

  /** CouponMinter utilities for TPS rate limit checking */
  public readonly CouponMinter: CouponMinterMethods;

  /** Payment and airdrop operations using Canton's native token */
  public readonly CantonPayments: CantonPaymentsMethods;

  /** Recurring payment stream management */
  public readonly PaymentStreams: PaymentStreamsMethodsWithClient;

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.OpenCapTable = this.createOpenCapTableMethods();
    this.OpenCapTableReports = this.createOpenCapTableReportsMethods();

    this.CouponMinter = {
      canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => canMintCouponsNow(payload, now),
      getRateLimitStatus: (payload: CouponMinterPayload, now?: Date) => getRateLimitStatus(payload, now),
      waitUntilCanMint: async (payload: CouponMinterPayload, options?: WaitUntilCanMintOptions) =>
        waitUntilCanMint(payload, options),
      mintWithRateLimit: async <T>(
        payload: CouponMinterPayload,
        mintFn: () => Promise<T>,
        options?: MintWithRateLimitOptions
      ) => mintWithRateLimit(payload, mintFn, options),
    };

    this.CantonPayments = createCantonPaymentsExtension();
    this.PaymentStreams = this.createPaymentStreamsMethods();
  }

  /** Create a new transaction batch for submitting multiple commands atomically */
  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }

  private createOpenCapTableMethods(): OpenCapTableMethods {
    const { client } = this;
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
        authorize: async (params: AuthorizeIssuerParams) => authorizeIssuer(client, params),
        withdraw: async (params: WithdrawAuthorizationParams) => withdrawAuthorization(client, params),
      },

      // ===== Batch Updates =====
      capTable: {
        update: (params: CapTableUpdateParams) => new CapTableBatch(params, client),
      },
    };
  }

  private createOpenCapTableReportsMethods(): OpenCapTableReportsMethods {
    const { client } = this;
    return {
      companyValuationReport: {
        buildCreate: (params: CreateCompanyValuationReportParams) =>
          buildCreateCompanyValuationReportCommand(client, params),
        addObservers: async (params: { companyValuationReportContractId: string; added: string[] }) =>
          addObserversToCompanyValuationReport(client, params),
        create: async (params: CreateCompanyValuationReportParams) => createCompanyValuationReport(client, params),
        update: async (params: UpdateCompanyValuationParams) => updateCompanyValuationReport(client, params),
      },
    };
  }

  private createPaymentStreamsMethods(): PaymentStreamsMethodsWithClient {
    const { client } = this;
    const baseExtension = createPaymentStreamsExtension();

    return {
      ...baseExtension,
      utils: {
        ...baseExtension.utils,
        getFactoryDisclosedContracts: () => baseExtension.utils.getFactoryDisclosedContracts(client),
        getProposedPaymentStreamDisclosedContracts: async (
          proposedPaymentStreamContractId: string,
          readAs?: string[]
        ) =>
          baseExtension.utils.getProposedPaymentStreamDisclosedContracts(
            client,
            proposedPaymentStreamContractId,
            readAs
          ),
      },
    };
  }
}

// ===== Type Definitions =====

/** Parameters for creating a batch cap table update */
interface CapTableUpdateParams {
  /** The contract ID of the CapTable to update */
  capTableContractId: string;
  /** Optional contract details for the CapTable (used to get correct templateId from ledger) */
  capTableContractDetails?: { templateId: string };
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

  // Other transactions
  stockRepurchase: EntityReader<OcfStockRepurchaseOutput>;
  stockConsolidation: EntityReader<OcfStockConsolidationOutput>;
  stockReissuance: EntityReader<OcfStockReissuanceOutput>;

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

  // Batch Updates
  capTable: {
    /** Create a batch builder for atomic cap table updates */
    update: (params: CapTableUpdateParams) => CapTableBatch;
  };
}

interface OpenCapTableReportsMethods {
  companyValuationReport: {
    /** Build a CreateCompanyValuationReport command */
    buildCreate: (params: CreateCompanyValuationReportParams) => CommandWithDisclosedContracts;
    /** Add observers to a company valuation report */
    addObservers: (params: {
      companyValuationReportContractId: string;
      added: string[];
    }) => Promise<{ contractId: string; updateId: string }>;
    /** Create a new company valuation report */
    create: (params: CreateCompanyValuationReportParams) => Promise<CreateCompanyValuationReportResult>;
    /** Update an existing company valuation report */
    update: (params: UpdateCompanyValuationParams) => Promise<UpdateCompanyValuationResult>;
  };
}

interface CouponMinterMethods {
  /** Check if minting is currently allowed based on rate limits */
  canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => CanMintResult;

  /** Get detailed rate limit status with additional context */
  getRateLimitStatus: (
    payload: CouponMinterPayload,
    now?: Date
  ) => CanMintResult & { waitSeconds?: number; isRateLimitEnabled: boolean };

  /** Wait until minting is allowed, sleeping as needed */
  waitUntilCanMint: (payload: CouponMinterPayload, options?: WaitUntilCanMintOptions) => Promise<void>;

  /** Wait for rate limit then execute mint function (fire and forget style) */
  mintWithRateLimit: <T>(
    payload: CouponMinterPayload,
    mintFn: () => Promise<T>,
    options?: MintWithRateLimitOptions
  ) => Promise<MintWithRateLimitResult<T>>;
}

/** PaymentStreams methods with client already bound for utils */
interface PaymentStreamsMethodsWithClient extends Omit<PaymentStreamsMethods, 'utils'> {
  utils: {
    getFactoryDisclosedContracts: () => DisclosedContract[];
    getProposedPaymentStreamDisclosedContracts: (
      proposedPaymentStreamContractId: string,
      readAs?: string[]
    ) => Promise<DisclosedContract[]>;
    buildPaymentContext: (
      validatorClient: ValidatorApiClient,
      provider: string
    ) => Promise<import('./functions/PaymentStreams/utils/paymentContext').PaymentContextWithDisclosedContracts>;
    buildPaymentContextWithAmulets: (
      validatorClient: ValidatorApiClient,
      payerParty: string,
      requestedAmount: string,
      provider: string
    ) => Promise<import('./functions/PaymentStreams/utils/paymentContext').PaymentContextWithAmuletsAndDisclosed>;
  };
}
