import type { ClientConfig, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
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
  getConvertibleCancellationEventAsOcf,
  getConvertibleIssuanceAsOcf,
  getDocumentAsOcf,
  getEquityCompensationCancellationEventAsOcf,
  getEquityCompensationExerciseEventAsOcf,
  getEquityCompensationIssuanceEventAsOcf,
  getIssuerAsOcf,
  getIssuerAuthorizedSharesAdjustmentEventAsOcf,
  getStakeholderAsOcf,
  getStockCancellationEventAsOcf,
  getStockClassAsOcf,
  getStockClassAuthorizedSharesAdjustmentEventAsOcf,
  getStockIssuanceAsOcf,
  getStockLegendTemplateAsOcf,
  getStockPlanAsOcf,
  getStockPlanPoolAdjustmentEventAsOcf,
  getStockRepurchaseAsOcf,
  getStockTransferAsOcf,
  getValuationAsOcf,
  getVestingAccelerationAsOcf,
  getVestingEventAsOcf,
  getVestingStartAsOcf,
  getVestingTermsAsOcf,
  getWarrantCancellationEventAsOcf,
  getWarrantIssuanceAsOcf,
  updateCompanyValuationReport,
  withdrawAuthorization,
  type AuthorizeIssuerParams,
  type AuthorizeIssuerResult,
  type CanMintResult,
  type CouponMinterPayload,
  type CreateCompanyValuationReportParams,
  type CreateCompanyValuationReportResult,
  type CreateIssuerParams,
  type GetConvertibleCancellationEventAsOcfParams,
  type GetConvertibleCancellationEventAsOcfResult,
  type GetConvertibleIssuanceAsOcfParams,
  type GetConvertibleIssuanceAsOcfResult,
  type GetDocumentAsOcfParams,
  type GetDocumentAsOcfResult,
  type GetEquityCompensationCancellationEventAsOcfParams,
  type GetEquityCompensationCancellationEventAsOcfResult,
  type GetEquityCompensationExerciseEventAsOcfParams,
  type GetEquityCompensationExerciseEventAsOcfResult,
  type GetEquityCompensationIssuanceEventAsOcfParams,
  type GetEquityCompensationIssuanceEventAsOcfResult,
  type GetIssuerAsOcfParams,
  type GetIssuerAsOcfResult,
  type GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams,
  type GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult,
  type GetStakeholderAsOcfParams,
  type GetStakeholderAsOcfResult,
  type GetStockCancellationEventAsOcfParams,
  type GetStockCancellationEventAsOcfResult,
  type GetStockClassAsOcfParams,
  type GetStockClassAsOcfResult,
  type GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams,
  type GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult,
  type GetStockIssuanceAsOcfParams,
  type GetStockIssuanceAsOcfResult,
  type GetStockLegendTemplateAsOcfParams,
  type GetStockLegendTemplateAsOcfResult,
  type GetStockPlanAsOcfParams,
  type GetStockPlanAsOcfResult,
  type GetStockPlanPoolAdjustmentEventAsOcfParams,
  type GetStockPlanPoolAdjustmentEventAsOcfResult,
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
  type GetWarrantCancellationEventAsOcfParams,
  type GetWarrantCancellationEventAsOcfResult,
  type GetWarrantIssuanceAsOcfParams,
  type GetWarrantIssuanceAsOcfResult,
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
   * @throws Error if FeaturedAppRight has not been set
   */
  requireFeaturedAppRight(): DisclosedContract {
    if (!this._featuredAppRight) {
      throw new Error('FeaturedAppRight not set. Call context.setFeaturedAppRight() first.');
    }
    return this._featuredAppRight;
  }

  /**
   * Get the issuer party or throw if not set.
   * @throws Error if issuer party has not been set
   */
  requireIssuerParty(): string {
    if (!this._issuerParty) {
      throw new Error('Issuer party not set. Call context.setIssuerParty() first.');
    }
    return this._issuerParty;
  }

  /**
   * Get the cap table contract ID or throw if not set.
   * @throws Error if cap table contract ID has not been set
   */
  requireCapTableContractId(): string {
    if (!this._capTableContractId) {
      throw new Error('Cap table contract ID not set. Call context.setCapTableContractId() first.');
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
        getEquityCompensationIssuanceEventAsOcf: async (params: GetEquityCompensationIssuanceEventAsOcfParams) =>
          getEquityCompensationIssuanceEventAsOcf(client, params),
      },
      equityCompensationExercise: {
        getEquityCompensationExerciseEventAsOcf: async (params: GetEquityCompensationExerciseEventAsOcfParams) =>
          getEquityCompensationExerciseEventAsOcf(client, params),
      },
      warrantIssuance: {
        getWarrantIssuanceAsOcf: async (params: GetWarrantIssuanceAsOcfParams) =>
          getWarrantIssuanceAsOcf(client, params),
      },
      convertibleIssuance: {
        getConvertibleIssuanceAsOcf: async (params: GetConvertibleIssuanceAsOcfParams) =>
          getConvertibleIssuanceAsOcf(client, params),
      },
      stockCancellation: {
        getStockCancellationEventAsOcf: async (params: GetStockCancellationEventAsOcfParams) =>
          getStockCancellationEventAsOcf(client, params),
      },
      warrantCancellation: {
        getWarrantCancellationEventAsOcf: async (params: GetWarrantCancellationEventAsOcfParams) =>
          getWarrantCancellationEventAsOcf(client, params),
      },
      convertibleCancellation: {
        getConvertibleCancellationEventAsOcf: async (params: GetConvertibleCancellationEventAsOcfParams) =>
          getConvertibleCancellationEventAsOcf(client, params),
      },
      equityCompensationCancellation: {
        getEquityCompensationCancellationEventAsOcf: async (
          params: GetEquityCompensationCancellationEventAsOcfParams
        ) => getEquityCompensationCancellationEventAsOcf(client, params),
      },
      stockTransfer: {
        getStockTransferAsOcf: async (params: GetStockTransferAsOcfParams) => getStockTransferAsOcf(client, params),
      },
      issuerAuthorizedSharesAdjustment: {
        getIssuerAuthorizedSharesAdjustmentEventAsOcf: async (
          params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
        ) => getIssuerAuthorizedSharesAdjustmentEventAsOcf(client, params),
      },
      stockClassAuthorizedSharesAdjustment: {
        getStockClassAuthorizedSharesAdjustmentEventAsOcf: async (
          params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
        ) => getStockClassAuthorizedSharesAdjustmentEventAsOcf(client, params),
      },
      stockPlanPoolAdjustment: {
        getStockPlanPoolAdjustmentEventAsOcf: async (params: GetStockPlanPoolAdjustmentEventAsOcfParams) =>
          getStockPlanPoolAdjustmentEventAsOcf(client, params),
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
          featuredAppRightContractDetails: DisclosedContract;
          capTableContractDetails?: DisclosedContract;
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
    getEquityCompensationIssuanceEventAsOcf: (
      params: GetEquityCompensationIssuanceEventAsOcfParams
    ) => Promise<GetEquityCompensationIssuanceEventAsOcfResult>;
  };
  equityCompensationExercise: {
    getEquityCompensationExerciseEventAsOcf: (
      params: GetEquityCompensationExerciseEventAsOcfParams
    ) => Promise<GetEquityCompensationExerciseEventAsOcfResult>;
  };
  warrantIssuance: {
    getWarrantIssuanceAsOcf: (params: GetWarrantIssuanceAsOcfParams) => Promise<GetWarrantIssuanceAsOcfResult>;
  };
  convertibleIssuance: {
    getConvertibleIssuanceAsOcf: (
      params: GetConvertibleIssuanceAsOcfParams
    ) => Promise<GetConvertibleIssuanceAsOcfResult>;
  };
  stockCancellation: {
    getStockCancellationEventAsOcf: (
      params: GetStockCancellationEventAsOcfParams
    ) => Promise<GetStockCancellationEventAsOcfResult>;
  };
  warrantCancellation: {
    getWarrantCancellationEventAsOcf: (
      params: GetWarrantCancellationEventAsOcfParams
    ) => Promise<GetWarrantCancellationEventAsOcfResult>;
  };
  convertibleCancellation: {
    getConvertibleCancellationEventAsOcf: (
      params: GetConvertibleCancellationEventAsOcfParams
    ) => Promise<GetConvertibleCancellationEventAsOcfResult>;
  };
  equityCompensationCancellation: {
    getEquityCompensationCancellationEventAsOcf: (
      params: GetEquityCompensationCancellationEventAsOcfParams
    ) => Promise<GetEquityCompensationCancellationEventAsOcfResult>;
  };
  stockTransfer: {
    getStockTransferAsOcf: (params: GetStockTransferAsOcfParams) => Promise<GetStockTransferAsOcfResult>;
  };
  issuerAuthorizedSharesAdjustment: {
    getIssuerAuthorizedSharesAdjustmentEventAsOcf: (
      params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
    ) => Promise<GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
  };
  stockClassAuthorizedSharesAdjustment: {
    getStockClassAuthorizedSharesAdjustmentEventAsOcf: (
      params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
    ) => Promise<GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
  };
  stockPlanPoolAdjustment: {
    getStockPlanPoolAdjustmentEventAsOcf: (
      params: GetStockPlanPoolAdjustmentEventAsOcfParams
    ) => Promise<GetStockPlanPoolAdjustmentEventAsOcfResult>;
  };
  stockIssuance: {
    getStockIssuanceAsOcf: (params: GetStockIssuanceAsOcfParams) => Promise<GetStockIssuanceAsOcfResult>;
  };
  stockRepurchase: {
    getStockRepurchaseAsOcf: (params: GetStockRepurchaseAsOcfParams) => Promise<GetStockRepurchaseAsOcfResult>;
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
      featuredAppRightContractDetails: DisclosedContract;
      capTableContractDetails?: DisclosedContract;
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
