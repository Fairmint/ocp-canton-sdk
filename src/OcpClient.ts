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
import { canMintCouponsNow } from './functions/CouponMinter';
import { CapTableBatch } from './functions/OpenCapTable/capTable';
import type { CommandWithDisclosedContracts, OcpClientContext } from './types';

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
 * ocp.setContext({
 *   featuredAppRightContractDetails: appRightContract,
 *   defaultActAs: [partyId],
 * });
 *
 * // Now all operations use cached context
 * const issuer = await ocp.OpenCapTable.issuer.getIssuerAsOcf({ contractId });
 * ```
 *
 * @see https://ocp.canton.fairmint.com/ - Full SDK documentation with usage examples
 */
export class OcpClient {
  /** The underlying LedgerJsonApiClient for direct ledger access */
  public readonly client: LedgerJsonApiClient;

  /** Cached context for common parameters */
  private context: OcpClientContext = {};

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
    };

    // Initialize extensions
    this.CantonPayments = createCantonPaymentsExtension();
    this.PaymentStreams = this.createPaymentStreamsMethods();
  }

  /**
   * Set context for caching common parameters across operations.
   *
   * @example
   * ```typescript
   * ocp.setContext({
   *   featuredAppRightContractDetails: appRightContract,
   *   defaultActAs: [partyId],
   * });
   * ```
   */
  public setContext(context: OcpClientContext): void {
    this.context = { ...this.context, ...context };
  }

  /** Get the current cached context */
  public getContext(): Readonly<OcpClientContext> {
    return this.context;
  }

  /** Clear the cached context */
  public clearContext(): void {
    this.context = {};
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
  canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => CanMintResult;
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
