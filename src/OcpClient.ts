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
  getStakeholderTokenBalance,
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
  type GetConvertibleAcceptanceAsOcfParams,
  type GetConvertibleAcceptanceAsOcfResult,
  type GetConvertibleCancellationAsOcfParams,
  type GetConvertibleCancellationAsOcfResult,
  type GetConvertibleConversionAsOcfParams,
  type GetConvertibleConversionAsOcfResult,
  type GetConvertibleIssuanceAsOcfParams,
  type GetConvertibleIssuanceAsOcfResult,
  type GetConvertibleTransferAsOcfParams,
  type GetConvertibleTransferAsOcfResult,
  type GetDocumentAsOcfParams,
  type GetDocumentAsOcfResult,
  type GetEquityCompensationAcceptanceAsOcfParams,
  type GetEquityCompensationAcceptanceAsOcfResult,
  type GetEquityCompensationCancellationAsOcfParams,
  type GetEquityCompensationCancellationAsOcfResult,
  type GetEquityCompensationExerciseAsOcfParams,
  type GetEquityCompensationExerciseAsOcfResult,
  type GetEquityCompensationIssuanceAsOcfParams,
  type GetEquityCompensationIssuanceAsOcfResult,
  type GetEquityCompensationTransferAsOcfParams,
  type GetEquityCompensationTransferAsOcfResult,
  type GetIssuerAsOcfParams,
  type GetIssuerAsOcfResult,
  type GetIssuerAuthorizedSharesAdjustmentAsOcfParams,
  type GetIssuerAuthorizedSharesAdjustmentAsOcfResult,
  type GetStakeholderAsOcfParams,
  type GetStakeholderAsOcfResult,
  type GetStakeholderRelationshipChangeEventAsOcfParams,
  type GetStakeholderRelationshipChangeEventAsOcfResult,
  type GetStakeholderStatusChangeEventAsOcfParams,
  type GetStakeholderStatusChangeEventAsOcfResult,
  type GetStakeholderTokenBalanceParams,
  type GetStakeholderTokenBalanceResult,
  type GetStockAcceptanceAsOcfParams,
  type GetStockAcceptanceAsOcfResult,
  type GetStockCancellationAsOcfParams,
  type GetStockCancellationAsOcfResult,
  type GetStockClassAsOcfParams,
  type GetStockClassAsOcfResult,
  type GetStockClassAuthorizedSharesAdjustmentAsOcfParams,
  type GetStockClassAuthorizedSharesAdjustmentAsOcfResult,
  type GetStockClassConversionRatioAdjustmentAsOcfParams,
  type GetStockClassConversionRatioAdjustmentAsOcfResult,
  type GetStockClassSplitAsOcfParams,
  type GetStockClassSplitAsOcfResult,
  type GetStockConsolidationAsOcfParams,
  type GetStockConsolidationAsOcfResult,
  type GetStockConversionAsOcfParams,
  type GetStockConversionAsOcfResult,
  type GetStockIssuanceAsOcfParams,
  type GetStockIssuanceAsOcfResult,
  type GetStockLegendTemplateAsOcfParams,
  type GetStockLegendTemplateAsOcfResult,
  type GetStockPlanAsOcfParams,
  type GetStockPlanAsOcfResult,
  type GetStockPlanPoolAdjustmentAsOcfParams,
  type GetStockPlanPoolAdjustmentAsOcfResult,
  type GetStockReissuanceAsOcfParams,
  type GetStockReissuanceAsOcfResult,
  type GetStockRepurchaseAsOcfParams,
  type GetStockRepurchaseAsOcfResult,
  type GetStockTransferAsOcfParams,
  type GetStockTransferAsOcfResult,
  type GetValuationAsOcfParams,
  type GetValuationAsOcfResult,
  type GetVestingAccelerationAsOcfParams,
  type GetVestingAccelerationAsOcfResult,
  type GetVestingEventAsOcfParams,
  type GetVestingEventAsOcfResult,
  type GetVestingStartAsOcfParams,
  type GetVestingStartAsOcfResult,
  type GetVestingTermsAsOcfParams,
  type GetVestingTermsAsOcfResult,
  type GetWarrantAcceptanceAsOcfParams,
  type GetWarrantAcceptanceAsOcfResult,
  type GetWarrantCancellationAsOcfParams,
  type GetWarrantCancellationAsOcfResult,
  type GetWarrantExerciseAsOcfParams,
  type GetWarrantExerciseAsOcfResult,
  type GetWarrantIssuanceAsOcfParams,
  type GetWarrantIssuanceAsOcfResult,
  type GetWarrantTransferAsOcfParams,
  type GetWarrantTransferAsOcfResult,
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

/**
 * Context for OCP operations that can be cached and reused.
 *
 * Store commonly used contract details to avoid passing them repeatedly.
 *
 * @example
 *   ```typescript
 *   const ocp = new OcpClient({ network: 'localnet' });
 *
 *   // Set context once after initial setup
 *   ocp.context.setFeaturedAppRight(featuredAppRightDetails);
 *
 *   // Later, retrieve cached values when needed
 *   const batch = ocp.OpenCapTable.capTable.update({
 *     capTableContractId,
 *     featuredAppRightContractDetails: ocp.context.requireFeaturedAppRight(),
 *     actAs: [issuerParty],
 *   });
 *   ```
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
 * const ocp = new OcpClient({ baseUrl: 'http://localhost:3975' });
 *
 * // Set context once to cache common parameters
 * ocp.context.setFeaturedAppRight(appRightContract);
 * ocp.context.setIssuerParty(partyId);
 *
 * // Now use cached values in operations
 * const batch = ocp.OpenCapTable.capTable.update({
 *   capTableContractId,
 *   featuredAppRightContractDetails: ocp.context.requireFeaturedAppRight(),
 *   actAs: [ocp.context.requireIssuerParty()],
 * });
 * ```
 *
 * @see https://ocp.canton.fairmint.com/ - Full SDK documentation with usage examples
 */
export class OcpClient {
  /** The underlying LedgerJsonApiClient for direct ledger access */
  public readonly client: LedgerJsonApiClient;

  /**
   * Context manager for caching commonly used values.
   *
   * Use this to store FeaturedAppRight details, issuer party, and cap table contract ID
   * after fetching them once, so they can be reused across operations.
   *
   * @example
   *   ```typescript
   *   // Set context after initial setup
   *   ocp.context.setFeaturedAppRight(featuredAppRightDetails);
   *   ocp.context.setIssuerParty(issuerParty);
   *   ocp.context.setCapTableContractId(capTableContractId);
   *
   *   // Later, use cached values
   *   const batch = ocp.OpenCapTable.capTable.update({
   *     capTableContractId: ocp.context.requireCapTableContractId(),
   *     featuredAppRightContractDetails: ocp.context.requireFeaturedAppRight(),
   *     actAs: [ocp.context.requireIssuerParty()],
   *   });
   *   ```
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

    // Initialize OpenCapTable methods
    this.OpenCapTable = this.createOpenCapTableMethods();

    // Initialize OpenCapTableReports methods
    this.OpenCapTableReports = this.createOpenCapTableReportsMethods();

    // Initialize CouponMinter methods
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

    // Initialize extensions
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
      issuer: {
        buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
        getIssuerAsOcf: async (params: GetIssuerAsOcfParams) => getIssuerAsOcf(client, params),
      },
      stockClass: {
        getStockClassAsOcf: async (params: GetStockClassAsOcfParams) => getStockClassAsOcf(client, params),
      },
      stakeholder: {
        getStakeholderAsOcf: async (params: GetStakeholderAsOcfParams) => getStakeholderAsOcf(client, params),
        getStakeholderTokenBalance: async (
          validatorClient: ValidatorApiClient,
          params: GetStakeholderTokenBalanceParams
        ) => getStakeholderTokenBalance(validatorClient, params),
      },
      stakeholderRelationshipChangeEvent: {
        getStakeholderRelationshipChangeEventAsOcf: async (params: GetStakeholderRelationshipChangeEventAsOcfParams) =>
          getStakeholderRelationshipChangeEventAsOcf(client, params),
      },
      stakeholderStatusChangeEvent: {
        getStakeholderStatusChangeEventAsOcf: async (params: GetStakeholderStatusChangeEventAsOcfParams) =>
          getStakeholderStatusChangeEventAsOcf(client, params),
      },
      stockLegendTemplate: {
        getStockLegendTemplateAsOcf: async (params: GetStockLegendTemplateAsOcfParams) =>
          getStockLegendTemplateAsOcf(client, params),
      },
      vestingTerms: {
        getVestingTermsAsOcf: async (params: GetVestingTermsAsOcfParams) => getVestingTermsAsOcf(client, params),
      },
      stockPlan: {
        getStockPlanAsOcf: async (params: GetStockPlanAsOcfParams) => getStockPlanAsOcf(client, params),
      },
      equityCompensationIssuance: {
        getEquityCompensationIssuanceAsOcf: async (params: GetEquityCompensationIssuanceAsOcfParams) =>
          getEquityCompensationIssuanceAsOcf(client, params),
      },
      equityCompensationExercise: {
        getEquityCompensationExerciseAsOcf: async (params: GetEquityCompensationExerciseAsOcfParams) =>
          getEquityCompensationExerciseAsOcf(client, params),
      },
      warrantIssuance: {
        getWarrantIssuanceAsOcf: async (params: GetWarrantIssuanceAsOcfParams) =>
          getWarrantIssuanceAsOcf(client, params),
      },
      warrantExercise: {
        getWarrantExerciseAsOcf: async (params: GetWarrantExerciseAsOcfParams) =>
          getWarrantExerciseAsOcf(client, params),
      },
      convertibleIssuance: {
        getConvertibleIssuanceAsOcf: async (params: GetConvertibleIssuanceAsOcfParams) =>
          getConvertibleIssuanceAsOcf(client, params),
      },
      convertibleConversion: {
        getConvertibleConversionAsOcf: async (params: GetConvertibleConversionAsOcfParams) =>
          getConvertibleConversionAsOcf(client, params),
      },
      stockCancellation: {
        getStockCancellationAsOcf: async (params: GetStockCancellationAsOcfParams) =>
          getStockCancellationAsOcf(client, params),
      },
      stockConversion: {
        getStockConversionAsOcf: async (params: GetStockConversionAsOcfParams) =>
          getStockConversionAsOcf(client, params),
      },
      warrantCancellation: {
        getWarrantCancellationAsOcf: async (params: GetWarrantCancellationAsOcfParams) =>
          getWarrantCancellationAsOcf(client, params),
      },
      convertibleCancellation: {
        getConvertibleCancellationAsOcf: async (params: GetConvertibleCancellationAsOcfParams) =>
          getConvertibleCancellationAsOcf(client, params),
      },
      equityCompensationCancellation: {
        getEquityCompensationCancellationAsOcf: async (params: GetEquityCompensationCancellationAsOcfParams) =>
          getEquityCompensationCancellationAsOcf(client, params),
      },
      stockTransfer: {
        getStockTransferAsOcf: async (params: GetStockTransferAsOcfParams) => getStockTransferAsOcf(client, params),
      },
      convertibleTransfer: {
        getConvertibleTransferAsOcf: async (params: GetConvertibleTransferAsOcfParams) =>
          getConvertibleTransferAsOcf(client, params),
      },
      equityCompensationTransfer: {
        getEquityCompensationTransferAsOcf: async (params: GetEquityCompensationTransferAsOcfParams) =>
          getEquityCompensationTransferAsOcf(client, params),
      },
      warrantTransfer: {
        getWarrantTransferAsOcf: async (params: GetWarrantTransferAsOcfParams) =>
          getWarrantTransferAsOcf(client, params),
      },
      issuerAuthorizedSharesAdjustment: {
        getIssuerAuthorizedSharesAdjustmentAsOcf: async (params: GetIssuerAuthorizedSharesAdjustmentAsOcfParams) =>
          getIssuerAuthorizedSharesAdjustmentAsOcf(client, params),
      },
      stockClassAuthorizedSharesAdjustment: {
        getStockClassAuthorizedSharesAdjustmentAsOcf: async (
          params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
        ) => getStockClassAuthorizedSharesAdjustmentAsOcf(client, params),
      },
      stockClassConversionRatioAdjustment: {
        getStockClassConversionRatioAdjustmentAsOcf: async (
          params: GetStockClassConversionRatioAdjustmentAsOcfParams
        ) => getStockClassConversionRatioAdjustmentAsOcf(client, params),
      },
      stockClassSplit: {
        getStockClassSplitAsOcf: async (params: GetStockClassSplitAsOcfParams) =>
          getStockClassSplitAsOcf(client, params),
      },
      stockConsolidation: {
        getStockConsolidationAsOcf: async (params: GetStockConsolidationAsOcfParams) =>
          getStockConsolidationAsOcf(client, params),
      },
      stockReissuance: {
        getStockReissuanceAsOcf: async (params: GetStockReissuanceAsOcfParams) =>
          getStockReissuanceAsOcf(client, params),
      },
      stockPlanPoolAdjustment: {
        getStockPlanPoolAdjustmentAsOcf: async (params: GetStockPlanPoolAdjustmentAsOcfParams) =>
          getStockPlanPoolAdjustmentAsOcf(client, params),
      },
      document: {
        getDocumentAsOcf: async (params: GetDocumentAsOcfParams) => getDocumentAsOcf(client, params),
      },
      stockIssuance: {
        getStockIssuanceAsOcf: async (params: GetStockIssuanceAsOcfParams) => getStockIssuanceAsOcf(client, params),
      },
      stockRepurchase: {
        getStockRepurchaseAsOcf: async (params: GetStockRepurchaseAsOcfParams) =>
          getStockRepurchaseAsOcf(client, params),
      },
      stockAcceptance: {
        getStockAcceptanceAsOcf: async (params: GetStockAcceptanceAsOcfParams) =>
          getStockAcceptanceAsOcf(client, params),
      },
      warrantAcceptance: {
        getWarrantAcceptanceAsOcf: async (params: GetWarrantAcceptanceAsOcfParams) =>
          getWarrantAcceptanceAsOcf(client, params),
      },
      convertibleAcceptance: {
        getConvertibleAcceptanceAsOcf: async (params: GetConvertibleAcceptanceAsOcfParams) =>
          getConvertibleAcceptanceAsOcf(client, params),
      },
      equityCompensationAcceptance: {
        getEquityCompensationAcceptanceAsOcf: async (params: GetEquityCompensationAcceptanceAsOcfParams) =>
          getEquityCompensationAcceptanceAsOcf(client, params),
      },
      valuation: {
        getValuationAsOcf: async (params: GetValuationAsOcfParams) => getValuationAsOcf(client, params),
      },
      vestingStart: {
        getVestingStartAsOcf: async (params: GetVestingStartAsOcfParams) => getVestingStartAsOcf(client, params),
      },
      vestingEvent: {
        getVestingEventAsOcf: async (params: GetVestingEventAsOcfParams) => getVestingEventAsOcf(client, params),
      },
      vestingAcceleration: {
        getVestingAccelerationAsOcf: async (params: GetVestingAccelerationAsOcfParams) =>
          getVestingAccelerationAsOcf(client, params),
      },
      issuerAuthorization: {
        authorizeIssuer: async (params: AuthorizeIssuerParams) => authorizeIssuer(client, params),
        withdrawAuthorization: async (params: WithdrawAuthorizationParams) => withdrawAuthorization(client, params),
      },
      capTable: {
        update: (params: {
          capTableContractId: string;
          capTableContractDetails?: { templateId: string };
          actAs: string[];
          readAs?: string[];
        }) => new CapTableBatch(params, client),
      },
    };
  }

  private createOpenCapTableReportsMethods(): OpenCapTableReportsMethods {
    const { client } = this;
    return {
      companyValuationReport: {
        buildCreateCompanyValuationReportCommand: (params: CreateCompanyValuationReportParams) =>
          buildCreateCompanyValuationReportCommand(client, params),
        addObserversToCompanyValuationReport: async (params: {
          companyValuationReportContractId: string;
          added: string[];
        }) => addObserversToCompanyValuationReport(client, params),
        createCompanyValuationReport: async (params: CreateCompanyValuationReportParams) =>
          createCompanyValuationReport(client, params),
        updateCompanyValuationReport: async (params: UpdateCompanyValuationParams) =>
          updateCompanyValuationReport(client, params),
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
        // Wrap utils that need the client
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

// =============================================================================
// Type Definitions for OpenCapTable methods
// =============================================================================

interface OpenCapTableMethods {
  issuer: {
    buildCreateIssuerCommand: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
    getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
  };
  stockClass: {
    getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
  };
  stakeholder: {
    getStakeholderAsOcf: (params: GetStakeholderAsOcfParams) => Promise<GetStakeholderAsOcfResult>;
    getStakeholderTokenBalance: (
      validatorClient: ValidatorApiClient,
      params: GetStakeholderTokenBalanceParams
    ) => Promise<GetStakeholderTokenBalanceResult>;
  };
  stakeholderRelationshipChangeEvent: {
    getStakeholderRelationshipChangeEventAsOcf: (
      params: GetStakeholderRelationshipChangeEventAsOcfParams
    ) => Promise<GetStakeholderRelationshipChangeEventAsOcfResult>;
  };
  stakeholderStatusChangeEvent: {
    getStakeholderStatusChangeEventAsOcf: (
      params: GetStakeholderStatusChangeEventAsOcfParams
    ) => Promise<GetStakeholderStatusChangeEventAsOcfResult>;
  };
  stockLegendTemplate: {
    getStockLegendTemplateAsOcf: (
      params: GetStockLegendTemplateAsOcfParams
    ) => Promise<GetStockLegendTemplateAsOcfResult>;
  };
  vestingTerms: {
    getVestingTermsAsOcf: (params: GetVestingTermsAsOcfParams) => Promise<GetVestingTermsAsOcfResult>;
  };
  stockPlan: {
    getStockPlanAsOcf: (params: GetStockPlanAsOcfParams) => Promise<GetStockPlanAsOcfResult>;
  };
  equityCompensationIssuance: {
    getEquityCompensationIssuanceAsOcf: (
      params: GetEquityCompensationIssuanceAsOcfParams
    ) => Promise<GetEquityCompensationIssuanceAsOcfResult>;
  };
  equityCompensationExercise: {
    getEquityCompensationExerciseAsOcf: (
      params: GetEquityCompensationExerciseAsOcfParams
    ) => Promise<GetEquityCompensationExerciseAsOcfResult>;
  };
  warrantIssuance: {
    getWarrantIssuanceAsOcf: (params: GetWarrantIssuanceAsOcfParams) => Promise<GetWarrantIssuanceAsOcfResult>;
  };
  warrantExercise: {
    getWarrantExerciseAsOcf: (params: GetWarrantExerciseAsOcfParams) => Promise<GetWarrantExerciseAsOcfResult>;
  };
  convertibleIssuance: {
    getConvertibleIssuanceAsOcf: (
      params: GetConvertibleIssuanceAsOcfParams
    ) => Promise<GetConvertibleIssuanceAsOcfResult>;
  };
  convertibleConversion: {
    getConvertibleConversionAsOcf: (
      params: GetConvertibleConversionAsOcfParams
    ) => Promise<GetConvertibleConversionAsOcfResult>;
  };
  stockCancellation: {
    getStockCancellationAsOcf: (params: GetStockCancellationAsOcfParams) => Promise<GetStockCancellationAsOcfResult>;
  };
  stockConversion: {
    getStockConversionAsOcf: (params: GetStockConversionAsOcfParams) => Promise<GetStockConversionAsOcfResult>;
  };
  warrantCancellation: {
    getWarrantCancellationAsOcf: (
      params: GetWarrantCancellationAsOcfParams
    ) => Promise<GetWarrantCancellationAsOcfResult>;
  };
  convertibleCancellation: {
    getConvertibleCancellationAsOcf: (
      params: GetConvertibleCancellationAsOcfParams
    ) => Promise<GetConvertibleCancellationAsOcfResult>;
  };
  equityCompensationCancellation: {
    getEquityCompensationCancellationAsOcf: (
      params: GetEquityCompensationCancellationAsOcfParams
    ) => Promise<GetEquityCompensationCancellationAsOcfResult>;
  };
  stockTransfer: {
    getStockTransferAsOcf: (params: GetStockTransferAsOcfParams) => Promise<GetStockTransferAsOcfResult>;
  };
  convertibleTransfer: {
    getConvertibleTransferAsOcf: (
      params: GetConvertibleTransferAsOcfParams
    ) => Promise<GetConvertibleTransferAsOcfResult>;
  };
  equityCompensationTransfer: {
    getEquityCompensationTransferAsOcf: (
      params: GetEquityCompensationTransferAsOcfParams
    ) => Promise<GetEquityCompensationTransferAsOcfResult>;
  };
  warrantTransfer: {
    getWarrantTransferAsOcf: (params: GetWarrantTransferAsOcfParams) => Promise<GetWarrantTransferAsOcfResult>;
  };
  issuerAuthorizedSharesAdjustment: {
    getIssuerAuthorizedSharesAdjustmentAsOcf: (
      params: GetIssuerAuthorizedSharesAdjustmentAsOcfParams
    ) => Promise<GetIssuerAuthorizedSharesAdjustmentAsOcfResult>;
  };
  stockClassAuthorizedSharesAdjustment: {
    getStockClassAuthorizedSharesAdjustmentAsOcf: (
      params: GetStockClassAuthorizedSharesAdjustmentAsOcfParams
    ) => Promise<GetStockClassAuthorizedSharesAdjustmentAsOcfResult>;
  };
  stockClassConversionRatioAdjustment: {
    getStockClassConversionRatioAdjustmentAsOcf: (
      params: GetStockClassConversionRatioAdjustmentAsOcfParams
    ) => Promise<GetStockClassConversionRatioAdjustmentAsOcfResult>;
  };
  stockClassSplit: {
    getStockClassSplitAsOcf: (params: GetStockClassSplitAsOcfParams) => Promise<GetStockClassSplitAsOcfResult>;
  };
  stockConsolidation: {
    getStockConsolidationAsOcf: (params: GetStockConsolidationAsOcfParams) => Promise<GetStockConsolidationAsOcfResult>;
  };
  stockReissuance: {
    getStockReissuanceAsOcf: (params: GetStockReissuanceAsOcfParams) => Promise<GetStockReissuanceAsOcfResult>;
  };
  stockPlanPoolAdjustment: {
    getStockPlanPoolAdjustmentAsOcf: (
      params: GetStockPlanPoolAdjustmentAsOcfParams
    ) => Promise<GetStockPlanPoolAdjustmentAsOcfResult>;
  };
  stockIssuance: {
    getStockIssuanceAsOcf: (params: GetStockIssuanceAsOcfParams) => Promise<GetStockIssuanceAsOcfResult>;
  };
  stockRepurchase: {
    getStockRepurchaseAsOcf: (params: GetStockRepurchaseAsOcfParams) => Promise<GetStockRepurchaseAsOcfResult>;
  };
  stockAcceptance: {
    getStockAcceptanceAsOcf: (params: GetStockAcceptanceAsOcfParams) => Promise<GetStockAcceptanceAsOcfResult>;
  };
  warrantAcceptance: {
    getWarrantAcceptanceAsOcf: (params: GetWarrantAcceptanceAsOcfParams) => Promise<GetWarrantAcceptanceAsOcfResult>;
  };
  convertibleAcceptance: {
    getConvertibleAcceptanceAsOcf: (
      params: GetConvertibleAcceptanceAsOcfParams
    ) => Promise<GetConvertibleAcceptanceAsOcfResult>;
  };
  equityCompensationAcceptance: {
    getEquityCompensationAcceptanceAsOcf: (
      params: GetEquityCompensationAcceptanceAsOcfParams
    ) => Promise<GetEquityCompensationAcceptanceAsOcfResult>;
  };
  valuation: {
    getValuationAsOcf: (params: GetValuationAsOcfParams) => Promise<GetValuationAsOcfResult>;
  };
  vestingStart: {
    getVestingStartAsOcf: (params: GetVestingStartAsOcfParams) => Promise<GetVestingStartAsOcfResult>;
  };
  vestingEvent: {
    getVestingEventAsOcf: (params: GetVestingEventAsOcfParams) => Promise<GetVestingEventAsOcfResult>;
  };
  vestingAcceleration: {
    getVestingAccelerationAsOcf: (
      params: GetVestingAccelerationAsOcfParams
    ) => Promise<GetVestingAccelerationAsOcfResult>;
  };
  document: {
    getDocumentAsOcf: (params: GetDocumentAsOcfParams) => Promise<GetDocumentAsOcfResult>;
  };
  issuerAuthorization: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    withdrawAuthorization: (params: WithdrawAuthorizationParams) => Promise<WithdrawAuthorizationResult>;
  };
  capTable: {
    update: (params: {
      capTableContractId: string;
      capTableContractDetails?: { templateId: string };
      actAs: string[];
      readAs?: string[];
    }) => CapTableBatch;
  };
}

interface OpenCapTableReportsMethods {
  companyValuationReport: {
    addObserversToCompanyValuationReport: (params: {
      companyValuationReportContractId: string;
      added: string[];
    }) => Promise<{ contractId: string; updateId: string }>;
    createCompanyValuationReport: (
      params: CreateCompanyValuationReportParams
    ) => Promise<CreateCompanyValuationReportResult>;
    updateCompanyValuationReport: (params: UpdateCompanyValuationParams) => Promise<UpdateCompanyValuationResult>;
    buildCreateCompanyValuationReportCommand: (
      params: CreateCompanyValuationReportParams
    ) => CommandWithDisclosedContracts;
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
