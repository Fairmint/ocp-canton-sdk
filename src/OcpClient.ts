import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
import type {
  AuthorizeIssuerParams,
  AuthorizeIssuerResult,
  CanMintResult,
  CouponMinterPayload,
  CreateCompanyValuationReportParams,
  CreateCompanyValuationReportResult,
  CreateIssuerParams,
  GetConvertibleCancellationEventAsOcfParams,
  GetConvertibleIssuanceAsOcfParams,
  GetDocumentAsOcfParams,
  GetEquityCompensationCancellationEventAsOcfParams,
  GetEquityCompensationExerciseEventAsOcfParams,
  GetEquityCompensationIssuanceEventAsOcfParams,
  GetIssuerAsOcfParams,
  GetIssuerAsOcfResult,
  GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams,
  GetStakeholderAsOcfParams,
  GetStockCancellationEventAsOcfParams,
  GetStockClassAsOcfParams,
  GetStockClassAsOcfResult,
  GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams,
  GetStockIssuanceAsOcfParams,
  GetStockLegendTemplateAsOcfParams,
  GetStockPlanAsOcfParams,
  GetStockPlanPoolAdjustmentEventAsOcfParams,
  GetStockRepurchaseAsOcfParams,
  GetStockTransferAsOcfParams,
  GetVestingTermsAsOcfParams,
  GetWarrantCancellationEventAsOcfParams,
  GetWarrantIssuanceAsOcfParams,
  UpdateCompanyValuationParams,
  UpdateCompanyValuationResult,
  WithdrawAuthorizationParams,
  WithdrawAuthorizationResult,
} from './functions';
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
} from './functions';
import { canMintCouponsNow } from './functions/CouponMinter';
import { CapTableBatch } from './functions/OpenCapTable/capTable';
import type { CommandWithDisclosedContracts } from './types';

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
 *   Creating
 *   an issuer
 *   ```typescript
 *   import { OcpClient } from '@open-captable-protocol/canton';
 *
 *   const ocp = new OcpClient({ network: 'localnet' });
 *
 *   const cmd = ocp.OpenCapTable.issuer.buildCreateIssuerCommand({
 *   issuerAuthorizationContractDetails: authDetails,
 *   featuredAppRightContractDetails: featuredDetails,
 *   issuerParty: 'alice::...',
 *   issuerData: {
 *   id: 'issuer-1',
 *   legal_name: 'Acme Corp',
 *   formation_date: '2024-01-01',
 *   country_of_formation: 'US',
 *   tax_ids: [],
 *   },
 *   });
 *   ```
 *
 * @example
 *   Batch
 *   cap table updates
 *   ```typescript
 *   const result = await ocp.OpenCapTable.capTable
 *   .update({
 *   capTableContractId,
 *   featuredAppRightContractDetails,
 *   actAs: [issuerParty],
 *   })
 *   .create('stakeholder', stakeholderData)
 *   .create('stockClass', stockClassData)
 *   .edit('stakeholder', updatedStakeholderData)
 *   .delete('document', documentId)
 *   .execute();
 *   ```
 *
 * @see https://ocp.canton.fairmint.com/ - Full SDK documentation
 */
export class OcpClient {
  /** The underlying LedgerJsonApiClient for direct ledger access. */
  public readonly client: LedgerJsonApiClient;

  /**
   * Core cap table operations.
   *
   * Use `capTable.update()` for all creates, edits, and deletes of OCF entities. Use entity-specific `get*AsOcf()`
   * methods to read data.
   */
  public OpenCapTable: {
    issuer: {
      buildCreateIssuerCommand: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
    };
    stockClass: {
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
    };
    stakeholder: {
      getStakeholderAsOcf: (
        params: GetStakeholderAsOcfParams
      ) => Promise<import('./functions').GetStakeholderAsOcfResult>;
    };
    stockLegendTemplate: {
      getStockLegendTemplateAsOcf: (
        params: GetStockLegendTemplateAsOcfParams
      ) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
    };
    vestingTerms: {
      getVestingTermsAsOcf: (
        params: GetVestingTermsAsOcfParams
      ) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
    };
    stockPlan: {
      getStockPlanAsOcf: (params: GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    };
    equityCompensationIssuance: {
      getEquityCompensationIssuanceEventAsOcf: (
        params: GetEquityCompensationIssuanceEventAsOcfParams
      ) => Promise<import('./functions').GetEquityCompensationIssuanceEventAsOcfResult>;
    };
    equityCompensationExercise: {
      getEquityCompensationExerciseEventAsOcf: (
        params: GetEquityCompensationExerciseEventAsOcfParams
      ) => Promise<import('./functions').GetEquityCompensationExerciseEventAsOcfResult>;
    };
    warrantIssuance: {
      getWarrantIssuanceAsOcf: (
        params: GetWarrantIssuanceAsOcfParams
      ) => Promise<import('./functions').GetWarrantIssuanceAsOcfResult>;
    };
    convertibleIssuance: {
      getConvertibleIssuanceAsOcf: (
        params: GetConvertibleIssuanceAsOcfParams
      ) => Promise<import('./functions').GetConvertibleIssuanceAsOcfResult>;
    };
    stockCancellation: {
      getStockCancellationEventAsOcf: (
        params: GetStockCancellationEventAsOcfParams
      ) => Promise<import('./functions').GetStockCancellationEventAsOcfResult>;
    };
    warrantCancellation: {
      getWarrantCancellationEventAsOcf: (
        params: GetWarrantCancellationEventAsOcfParams
      ) => Promise<import('./functions').GetWarrantCancellationEventAsOcfResult>;
    };
    convertibleCancellation: {
      getConvertibleCancellationEventAsOcf: (
        params: GetConvertibleCancellationEventAsOcfParams
      ) => Promise<import('./functions').GetConvertibleCancellationEventAsOcfResult>;
    };
    equityCompensationCancellation: {
      getEquityCompensationCancellationEventAsOcf: (
        params: GetEquityCompensationCancellationEventAsOcfParams
      ) => Promise<import('./functions').GetEquityCompensationCancellationEventAsOcfResult>;
    };
    stockTransfer: {
      getStockTransferAsOcf: (
        params: GetStockTransferAsOcfParams
      ) => Promise<import('./functions').GetStockTransferAsOcfResult>;
    };
    issuerAuthorizedSharesAdjustment: {
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: (
        params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
    };
    stockClassAuthorizedSharesAdjustment: {
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: (
        params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
    };
    stockPlanPoolAdjustment: {
      getStockPlanPoolAdjustmentEventAsOcf: (
        params: GetStockPlanPoolAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult>;
    };
    stockIssuance: {
      getStockIssuanceAsOcf: (
        params: GetStockIssuanceAsOcfParams
      ) => Promise<import('./functions').GetStockIssuanceAsOcfResult>;
    };
    stockRepurchase: {
      getStockRepurchaseAsOcf: (
        params: GetStockRepurchaseAsOcfParams
      ) => Promise<import('./functions').GetStockRepurchaseAsOcfResult>;
    };
    document: {
      getDocumentAsOcf: (params: GetDocumentAsOcfParams) => Promise<import('./functions').GetDocumentAsOcfResult>;
    };
    issuerAuthorization: {
      authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
      withdrawAuthorization: (params: WithdrawAuthorizationParams) => Promise<WithdrawAuthorizationResult>;
    };
    /** Batch cap table update operations for atomic creates, edits, and deletes. */
    capTable: {
      update: (params: {
        capTableContractId: string;
        featuredAppRightContractDetails: DisclosedContract;
        capTableContractDetails?: DisclosedContract;
        actAs: string[];
        readAs?: string[];
      }) => CapTableBatch;
    };
  };

  /** Reporting operations for cap table analytics. */
  public OpenCapTableReports: {
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
  };

  /** CouponMinter utilities for TPS rate limit checking. */
  public CouponMinter: {
    /**
     * Checks if minting coupons is currently allowed based on TPS rate limits.
     *
     * @param payload - The CouponMinter contract payload
     * @param now - Optional current time for testing
     * @returns {canMint: true} Or { canMint: false, waitMs: number }
     */
    canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => CanMintResult;
  };

  /** Payment and airdrop operations using Canton's native token. */
  public CantonPayments: {
    airdrop: {
      buildCreateAirdropCommand: (params: import('./functions').CreateAirdropParams) => Command;
      buildUpdateAirdropConfigCommand: (params: import('./functions').UpdateAirdropConfigParams) => Command;
      buildAddObserversToAirdropCommand: (params: import('./functions').AddObserversToAirdropParams) => Command;
      buildJoinAirdropCommand: (params: import('./functions').JoinAirdropParams) => CommandWithDisclosedContracts;
      buildExecuteAirdropCommand: (params: import('./functions').ExecuteAirdropParams) => Command;
    };
    simpleAirdrop: {
      buildCreateSimpleAirdropCommand: (params: import('./functions').CreateSimpleAirdropParams) => Command;
      buildArchiveSimpleAirdropCommand: (params: import('./functions').ArchiveSimpleAirdropParams) => Command;
      buildExecuteSimpleAirdropCommand: (params: import('./functions').ExecuteSimpleAirdropParams) => Command;
    };
  };

  /** Recurring payment stream management. */
  public PaymentStreams: {
    paymentStreamFactory: {
      buildCreatePaymentStreamProposalCommand: (
        params: import('./functions').CreatePaymentStreamProposalParams
      ) => CommandWithDisclosedContracts;
    };
    proposedPaymentStream: {
      buildApproveCommand: (
        params: import('./functions').ProposedPaymentStreamApproveParams
      ) => CommandWithDisclosedContracts;
      buildStartPaymentStreamCommand: (
        params: import('./functions').ProposedPaymentStreamStartParams
      ) => CommandWithDisclosedContracts;
      buildEditPaymentStreamProposalCommand: (params: import('./functions').EditPaymentStreamProposalParams) => Command;
      buildWithdrawCommand: (params: import('./functions').ProposedPaymentStreamWithdrawParams) => Command;
      buildChangePartyCommand: (params: import('./functions').ProposedPaymentStreamChangePartyParams) => Command;
    };
    activePaymentStream: {
      buildProcessPaymentCommand: (params: import('./functions').ProcessPaymentParams) => CommandWithDisclosedContracts;
      buildProcessFreeTrialCommand: (params: import('./functions').ProcessFreeTrialParams) => Command;
      buildCancelCommand: (params: import('./functions').CancelPaymentStreamParams) => Command;
      buildProposeChangesCommand: (params: import('./functions').ProposeChangesParams) => Command;
      buildRefundCommand: (params: import('./functions').RefundPaymentStreamParams) => Command;
      buildArchiveInactivePaymentStreamCommand: (
        params: import('./functions').ArchiveInactivePaymentStreamParams
      ) => Command;
      buildChangePartyCommand: (params: import('./functions').ActivePaymentStreamChangePartyParams) => Command;
    };
    paymentStreamChangeProposal: {
      buildApproveCommand: (params: import('./functions').PaymentStreamChangeProposalApproveParams) => Command;
      buildApplyCommand: (params: import('./functions').PaymentStreamChangeProposalApplyParams) => Command;
      buildRejectCommand: (params: import('./functions').PaymentStreamChangeProposalRejectParams) => Command;
    };
    partyMigrationProposal: {
      buildApproveCommand: (params: import('./functions').PartyMigrationProposalApproveParams) => Command;
      buildMigrateActivePaymentStreamCommand: (
        params: import('./functions').MigrateActivePaymentStreamParams
      ) => Command;
      buildMigrateProposedPaymentStreamCommand: (
        params: import('./functions').MigrateProposedPaymentStreamParams
      ) => Command;
      buildArchiveCommand: (params: import('./functions').PartyMigrationProposalArchiveParams) => Command;
    };
    utils: {
      getFactoryDisclosedContracts: () => Array<{
        templateId: string;
        contractId: string;
        createdEventBlob: string;
        synchronizerId: string;
      }>;
      getProposedPaymentStreamDisclosedContracts: (
        proposedPaymentStreamContractId: string,
        readAs?: string[]
      ) => Promise<Array<{ templateId: string; contractId: string; createdEventBlob: string; synchronizerId: string }>>;
      buildPaymentContext: (
        validatorClient: import('@fairmint/canton-node-sdk').ValidatorApiClient,
        provider?: string
      ) => Promise<import('./functions').PaymentContextWithDisclosedContracts>;
      buildPaymentContextWithAmulets: (
        validatorClient: import('@fairmint/canton-node-sdk').ValidatorApiClient,
        payerParty: string,
        requestedAmount: string,
        provider: string
      ) => Promise<import('./functions').PaymentContextWithAmuletsAndDisclosed>;
    };
  };

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.OpenCapTable = {
      issuer: {
        buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
        getIssuerAsOcf: async (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params),
      },
      stockClass: {
        getStockClassAsOcf: async (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params),
      },
      stakeholder: {
        getStakeholderAsOcf: async (params) => getStakeholderAsOcf(this.client, params),
      },
      stockLegendTemplate: {
        getStockLegendTemplateAsOcf: async (params) => getStockLegendTemplateAsOcf(this.client, params),
      },
      vestingTerms: {
        getVestingTermsAsOcf: async (params) => getVestingTermsAsOcf(this.client, params),
      },
      stockPlan: {
        getStockPlanAsOcf: async (params) => getStockPlanAsOcf(this.client, params),
      },
      equityCompensationIssuance: {
        getEquityCompensationIssuanceEventAsOcf: async (params) =>
          getEquityCompensationIssuanceEventAsOcf(this.client, params),
      },
      equityCompensationExercise: {
        getEquityCompensationExerciseEventAsOcf: async (params) =>
          getEquityCompensationExerciseEventAsOcf(this.client, params),
      },
      warrantIssuance: {
        getWarrantIssuanceAsOcf: async (params) => getWarrantIssuanceAsOcf(this.client, params),
      },
      convertibleIssuance: {
        getConvertibleIssuanceAsOcf: async (params) => getConvertibleIssuanceAsOcf(this.client, params),
      },
      stockCancellation: {
        getStockCancellationEventAsOcf: async (params) => getStockCancellationEventAsOcf(this.client, params),
      },
      warrantCancellation: {
        getWarrantCancellationEventAsOcf: async (params) => getWarrantCancellationEventAsOcf(this.client, params),
      },
      convertibleCancellation: {
        getConvertibleCancellationEventAsOcf: async (params) =>
          getConvertibleCancellationEventAsOcf(this.client, params),
      },
      equityCompensationCancellation: {
        getEquityCompensationCancellationEventAsOcf: async (params) =>
          getEquityCompensationCancellationEventAsOcf(this.client, params),
      },
      stockTransfer: {
        getStockTransferAsOcf: async (params) => getStockTransferAsOcf(this.client, params),
      },
      issuerAuthorizedSharesAdjustment: {
        getIssuerAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
          getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      },
      stockClassAuthorizedSharesAdjustment: {
        getStockClassAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
          getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      },
      stockPlanPoolAdjustment: {
        getStockPlanPoolAdjustmentEventAsOcf: async (params) =>
          getStockPlanPoolAdjustmentEventAsOcf(this.client, params),
      },
      document: {
        getDocumentAsOcf: async (params) => getDocumentAsOcf(this.client, params),
      },
      stockIssuance: {
        getStockIssuanceAsOcf: async (params) => getStockIssuanceAsOcf(this.client, params),
      },
      stockRepurchase: {
        getStockRepurchaseAsOcf: async (params) => getStockRepurchaseAsOcf(this.client, params),
      },
      issuerAuthorization: {
        authorizeIssuer: async (params) => authorizeIssuer(this.client, params),
        withdrawAuthorization: async (params) => withdrawAuthorization(this.client, params),
      },
      capTable: {
        update: (params) => new CapTableBatch(params, this.client),
      },
    };

    this.OpenCapTableReports = {
      companyValuationReport: {
        buildCreateCompanyValuationReportCommand: (params: CreateCompanyValuationReportParams) =>
          buildCreateCompanyValuationReportCommand(this.client, params),
        addObserversToCompanyValuationReport: async (params: {
          companyValuationReportContractId: string;
          added: string[];
        }) => addObserversToCompanyValuationReport(this.client, params),
        createCompanyValuationReport: async (params: CreateCompanyValuationReportParams) =>
          createCompanyValuationReport(this.client, params),
        updateCompanyValuationReport: async (params: UpdateCompanyValuationParams) =>
          updateCompanyValuationReport(this.client, params),
      },
    };

    this.CouponMinter = {
      canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => canMintCouponsNow(payload, now),
    };

    /* eslint-disable @typescript-eslint/no-require-imports */
    this.CantonPayments = {
      airdrop: {
        buildCreateAirdropCommand: (params) => {
          const { buildCreateAirdropCommand } = require('./functions/CantonPayments/airdrop');
          return buildCreateAirdropCommand(params);
        },
        buildUpdateAirdropConfigCommand: (params) => {
          const { buildUpdateAirdropConfigCommand } = require('./functions/CantonPayments/airdrop');
          return buildUpdateAirdropConfigCommand(params);
        },
        buildAddObserversToAirdropCommand: (params) => {
          const { buildAddObserversToAirdropCommand } = require('./functions/CantonPayments/airdrop');
          return buildAddObserversToAirdropCommand(params);
        },
        buildJoinAirdropCommand: (params) => {
          const { buildJoinAirdropCommand } = require('./functions/CantonPayments/airdrop');
          return buildJoinAirdropCommand(params);
        },
        buildExecuteAirdropCommand: (params) => {
          const { buildExecuteAirdropCommand } = require('./functions/CantonPayments/airdrop');
          return buildExecuteAirdropCommand(params);
        },
      },
      simpleAirdrop: {
        buildCreateSimpleAirdropCommand: (params) => {
          const { buildCreateSimpleAirdropCommand } = require('./functions/CantonPayments/simpleAirdrop');
          return buildCreateSimpleAirdropCommand(params);
        },
        buildArchiveSimpleAirdropCommand: (params) => {
          const { buildArchiveSimpleAirdropCommand } = require('./functions/CantonPayments/simpleAirdrop');
          return buildArchiveSimpleAirdropCommand(params);
        },
        buildExecuteSimpleAirdropCommand: (params) => {
          const { buildExecuteSimpleAirdropCommand } = require('./functions/CantonPayments/simpleAirdrop');
          return buildExecuteSimpleAirdropCommand(params);
        },
      },
    };

    this.PaymentStreams = {
      paymentStreamFactory: {
        buildCreatePaymentStreamProposalCommand: (params) => {
          const { buildCreatePaymentStreamProposalCommand } = require('./functions/PaymentStreams');
          return buildCreatePaymentStreamProposalCommand(params);
        },
      },
      proposedPaymentStream: {
        buildApproveCommand: (params) => {
          const { buildProposedPaymentStreamApproveCommand } = require('./functions/PaymentStreams');
          return buildProposedPaymentStreamApproveCommand(params);
        },
        buildStartPaymentStreamCommand: (params) => {
          const { buildProposedPaymentStreamStartCommand } = require('./functions/PaymentStreams');
          return buildProposedPaymentStreamStartCommand(params);
        },
        buildEditPaymentStreamProposalCommand: (params) => {
          const { buildEditPaymentStreamProposalCommand } = require('./functions/PaymentStreams');
          return buildEditPaymentStreamProposalCommand(params);
        },
        buildWithdrawCommand: (params) => {
          const { buildProposedPaymentStreamWithdrawCommand } = require('./functions/PaymentStreams');
          return buildProposedPaymentStreamWithdrawCommand(params);
        },
        buildChangePartyCommand: (params) => {
          const { buildProposedPaymentStreamChangePartyCommand } = require('./functions/PaymentStreams');
          return buildProposedPaymentStreamChangePartyCommand(params);
        },
      },
      activePaymentStream: {
        buildProcessPaymentCommand: (params) => {
          const { buildProcessPaymentCommand } = require('./functions/PaymentStreams');
          return buildProcessPaymentCommand(params);
        },
        buildProcessFreeTrialCommand: (params) => {
          const { buildProcessFreeTrialCommand } = require('./functions/PaymentStreams');
          return buildProcessFreeTrialCommand(params);
        },
        buildCancelCommand: (params) => {
          const { buildCancelPaymentStreamCommand } = require('./functions/PaymentStreams');
          return buildCancelPaymentStreamCommand(params);
        },
        buildProposeChangesCommand: (params) => {
          const { buildProposeChangesCommand } = require('./functions/PaymentStreams');
          return buildProposeChangesCommand(params);
        },
        buildRefundCommand: (params) => {
          const { buildRefundPaymentStreamCommand } = require('./functions/PaymentStreams');
          return buildRefundPaymentStreamCommand(params);
        },
        buildArchiveInactivePaymentStreamCommand: (params) => {
          const { buildArchiveInactivePaymentStreamCommand } = require('./functions/PaymentStreams');
          return buildArchiveInactivePaymentStreamCommand(params);
        },
        buildChangePartyCommand: (params) => {
          const { buildActivePaymentStreamChangePartyCommand } = require('./functions/PaymentStreams');
          return buildActivePaymentStreamChangePartyCommand(params);
        },
      },
      paymentStreamChangeProposal: {
        buildApproveCommand: (params) => {
          const { buildPaymentStreamChangeProposalApproveCommand } = require('./functions/PaymentStreams');
          return buildPaymentStreamChangeProposalApproveCommand(params);
        },
        buildApplyCommand: (params) => {
          const { buildPaymentStreamChangeProposalApplyCommand } = require('./functions/PaymentStreams');
          return buildPaymentStreamChangeProposalApplyCommand(params);
        },
        buildRejectCommand: (params) => {
          const { buildPaymentStreamChangeProposalRejectCommand } = require('./functions/PaymentStreams');
          return buildPaymentStreamChangeProposalRejectCommand(params);
        },
      },
      partyMigrationProposal: {
        buildApproveCommand: (params) => {
          const { buildPartyMigrationProposalApproveCommand } = require('./functions/PaymentStreams');
          return buildPartyMigrationProposalApproveCommand(params);
        },
        buildMigrateActivePaymentStreamCommand: (params) => {
          const { buildMigrateActivePaymentStreamCommand } = require('./functions/PaymentStreams');
          return buildMigrateActivePaymentStreamCommand(params);
        },
        buildMigrateProposedPaymentStreamCommand: (params) => {
          const { buildMigrateProposedPaymentStreamCommand } = require('./functions/PaymentStreams');
          return buildMigrateProposedPaymentStreamCommand(params);
        },
        buildArchiveCommand: (params) => {
          const { buildPartyMigrationProposalArchiveCommand } = require('./functions/PaymentStreams');
          return buildPartyMigrationProposalArchiveCommand(params);
        },
      },
      utils: {
        getFactoryDisclosedContracts: () => {
          const { getFactoryDisclosedContracts } = require('./functions/PaymentStreams');
          return getFactoryDisclosedContracts(this);
        },
        getProposedPaymentStreamDisclosedContracts: async (
          proposedPaymentStreamContractId: string,
          readAs?: string[]
        ) => {
          const { getProposedPaymentStreamDisclosedContracts } = require('./functions/PaymentStreams');
          return await getProposedPaymentStreamDisclosedContracts(this, proposedPaymentStreamContractId, readAs);
        },
        buildPaymentContext: async (validatorClient, provider) => {
          const { buildPaymentContext } = require('./functions/PaymentStreams');
          return await buildPaymentContext(validatorClient, provider);
        },
        buildPaymentContextWithAmulets: async (validatorClient, payerParty, requestedAmount, provider) => {
          const { buildPaymentContextWithAmulets } = require('./functions/PaymentStreams');
          return await buildPaymentContextWithAmulets(validatorClient, payerParty, requestedAmount, provider);
        },
      },
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  }

  /** Create a new transaction batch for submitting multiple commands atomically. */
  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
