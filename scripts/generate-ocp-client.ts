#!/usr/bin/env ts-node

/**
 * OcpClient Generator Script
 *
 * Generates src/OcpClient.ts from function definitions in src/functions/.
 *
 * This script scans the function modules and generates a type-safe facade class
 * that organizes all operations by domain.
 *
 * Usage: npm run generate:client
 *
 * The generated file is gitignored. Regenerate after adding new functions.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'src', 'OcpClient.ts');

// Configuration defining the OcpClient structure
interface FunctionConfig {
  /** Name of the function in the generated client */
  name: string;
  /** Actual function name in the source */
  sourceName: string;
  /** Whether the function needs the client as first argument */
  needsClient: boolean;
  /** Whether the function is async */
  isAsync: boolean;
  /** Params type name (optional, will be inferred if not provided) */
  paramsType?: string;
  /** Result type name (optional, will be inferred if not provided) */
  resultType?: string;
  /** Whether to use lazy require() instead of import (for bundle size) */
  useLazyRequire?: boolean;
  /** Import path for lazy require */
  lazyRequirePath?: string;
}

interface NamespaceConfig {
  /** Nested namespaces */
  namespaces?: Record<string, NamespaceConfig>;
  /** Functions in this namespace */
  functions?: FunctionConfig[];
  /** Custom code to inject (for special cases like CapTableBatch) */
  customCode?: string;
  /** Custom type definition for this namespace */
  customType?: string;
}

// Complete configuration
const CLIENT_CONFIG: Record<string, NamespaceConfig> = {
  OpenCapTable: {
    namespaces: {
      issuer: {
        functions: [
          {
            name: 'buildCreateIssuerCommand',
            sourceName: 'buildCreateIssuerCommand',
            needsClient: false,
            isAsync: false,
            paramsType: 'CreateIssuerParams',
            resultType: 'CommandWithDisclosedContracts',
          },
          {
            name: 'getIssuerAsOcf',
            sourceName: 'getIssuerAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetIssuerAsOcfParams',
            resultType: 'GetIssuerAsOcfResult',
          },
        ],
      },
      stockClass: {
        functions: [
          {
            name: 'getStockClassAsOcf',
            sourceName: 'getStockClassAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockClassAsOcfParams',
            resultType: 'GetStockClassAsOcfResult',
          },
        ],
      },
      stakeholder: {
        functions: [
          {
            name: 'getStakeholderAsOcf',
            sourceName: 'getStakeholderAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStakeholderAsOcfParams',
            resultType: "import('./functions').GetStakeholderAsOcfResult",
          },
        ],
      },
      stockLegendTemplate: {
        functions: [
          {
            name: 'getStockLegendTemplateAsOcf',
            sourceName: 'getStockLegendTemplateAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockLegendTemplateAsOcfParams',
            resultType: "import('./functions').GetStockLegendTemplateAsOcfResult",
          },
        ],
      },
      vestingTerms: {
        functions: [
          {
            name: 'getVestingTermsAsOcf',
            sourceName: 'getVestingTermsAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetVestingTermsAsOcfParams',
            resultType: "import('./functions').GetVestingTermsAsOcfResult",
          },
        ],
      },
      stockPlan: {
        functions: [
          {
            name: 'getStockPlanAsOcf',
            sourceName: 'getStockPlanAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockPlanAsOcfParams',
            resultType: "import('./functions').GetStockPlanAsOcfResult",
          },
        ],
      },
      equityCompensationIssuance: {
        functions: [
          {
            name: 'getEquityCompensationIssuanceEventAsOcf',
            sourceName: 'getEquityCompensationIssuanceEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetEquityCompensationIssuanceEventAsOcfParams',
            resultType: "import('./functions').GetEquityCompensationIssuanceEventAsOcfResult",
          },
        ],
      },
      equityCompensationExercise: {
        functions: [
          {
            name: 'getEquityCompensationExerciseEventAsOcf',
            sourceName: 'getEquityCompensationExerciseEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetEquityCompensationExerciseEventAsOcfParams',
            resultType: "import('./functions').GetEquityCompensationExerciseEventAsOcfResult",
          },
        ],
      },
      warrantIssuance: {
        functions: [
          {
            name: 'getWarrantIssuanceAsOcf',
            sourceName: 'getWarrantIssuanceAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetWarrantIssuanceAsOcfParams',
            resultType: "import('./functions').GetWarrantIssuanceAsOcfResult",
          },
        ],
      },
      convertibleIssuance: {
        functions: [
          {
            name: 'getConvertibleIssuanceAsOcf',
            sourceName: 'getConvertibleIssuanceAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetConvertibleIssuanceAsOcfParams',
            resultType: "import('./functions').GetConvertibleIssuanceAsOcfResult",
          },
        ],
      },
      stockCancellation: {
        functions: [
          {
            name: 'getStockCancellationEventAsOcf',
            sourceName: 'getStockCancellationEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockCancellationEventAsOcfParams',
            resultType: "import('./functions').GetStockCancellationEventAsOcfResult",
          },
        ],
      },
      warrantCancellation: {
        functions: [
          {
            name: 'getWarrantCancellationEventAsOcf',
            sourceName: 'getWarrantCancellationEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetWarrantCancellationEventAsOcfParams',
            resultType: "import('./functions').GetWarrantCancellationEventAsOcfResult",
          },
        ],
      },
      convertibleCancellation: {
        functions: [
          {
            name: 'getConvertibleCancellationEventAsOcf',
            sourceName: 'getConvertibleCancellationEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetConvertibleCancellationEventAsOcfParams',
            resultType: "import('./functions').GetConvertibleCancellationEventAsOcfResult",
          },
        ],
      },
      equityCompensationCancellation: {
        functions: [
          {
            name: 'getEquityCompensationCancellationEventAsOcf',
            sourceName: 'getEquityCompensationCancellationEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetEquityCompensationCancellationEventAsOcfParams',
            resultType: "import('./functions').GetEquityCompensationCancellationEventAsOcfResult",
          },
        ],
      },
      stockTransfer: {
        functions: [
          {
            name: 'getStockTransferAsOcf',
            sourceName: 'getStockTransferAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockTransferAsOcfParams',
            resultType: "import('./functions').GetStockTransferAsOcfResult",
          },
        ],
      },
      issuerAuthorizedSharesAdjustment: {
        functions: [
          {
            name: 'getIssuerAuthorizedSharesAdjustmentEventAsOcf',
            sourceName: 'getIssuerAuthorizedSharesAdjustmentEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams',
            resultType: "import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult",
          },
        ],
      },
      stockClassAuthorizedSharesAdjustment: {
        functions: [
          {
            name: 'getStockClassAuthorizedSharesAdjustmentEventAsOcf',
            sourceName: 'getStockClassAuthorizedSharesAdjustmentEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams',
            resultType: "import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult",
          },
        ],
      },
      stockPlanPoolAdjustment: {
        functions: [
          {
            name: 'getStockPlanPoolAdjustmentEventAsOcf',
            sourceName: 'getStockPlanPoolAdjustmentEventAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockPlanPoolAdjustmentEventAsOcfParams',
            resultType: "import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult",
          },
        ],
      },
      stockIssuance: {
        functions: [
          {
            name: 'getStockIssuanceAsOcf',
            sourceName: 'getStockIssuanceAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockIssuanceAsOcfParams',
            resultType: "import('./functions').GetStockIssuanceAsOcfResult",
          },
        ],
      },
      stockRepurchase: {
        functions: [
          {
            name: 'getStockRepurchaseAsOcf',
            sourceName: 'getStockRepurchaseAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetStockRepurchaseAsOcfParams',
            resultType: "import('./functions').GetStockRepurchaseAsOcfResult",
          },
        ],
      },
      document: {
        functions: [
          {
            name: 'getDocumentAsOcf',
            sourceName: 'getDocumentAsOcf',
            needsClient: true,
            isAsync: true,
            paramsType: 'GetDocumentAsOcfParams',
            resultType: "import('./functions').GetDocumentAsOcfResult",
          },
        ],
      },
      issuerAuthorization: {
        functions: [
          {
            name: 'authorizeIssuer',
            sourceName: 'authorizeIssuer',
            needsClient: true,
            isAsync: true,
            paramsType: 'AuthorizeIssuerParams',
            resultType: 'AuthorizeIssuerResult',
          },
          {
            name: 'withdrawAuthorization',
            sourceName: 'withdrawAuthorization',
            needsClient: true,
            isAsync: true,
            paramsType: 'WithdrawAuthorizationParams',
            resultType: 'WithdrawAuthorizationResult',
          },
        ],
      },
      capTable: {
        customType: `{
      update: (params: {
        capTableContractId: string;
        featuredAppRightContractDetails: DisclosedContract;
        capTableContractDetails?: DisclosedContract;
        actAs: string[];
        readAs?: string[];
      }) => CapTableBatch;
    }`,
        customCode: `{
        update: (params) => new CapTableBatch(params, this.client),
      }`,
      },
    },
  },
  OpenCapTableReports: {
    namespaces: {
      companyValuationReport: {
        functions: [
          {
            name: 'addObserversToCompanyValuationReport',
            sourceName: 'addObserversToCompanyValuationReport',
            needsClient: true,
            isAsync: true,
            paramsType: '{ companyValuationReportContractId: string; added: string[]; }',
            resultType: '{ contractId: string; updateId: string }',
          },
          {
            name: 'createCompanyValuationReport',
            sourceName: 'createCompanyValuationReport',
            needsClient: true,
            isAsync: true,
            paramsType: 'CreateCompanyValuationReportParams',
            resultType: 'CreateCompanyValuationReportResult',
          },
          {
            name: 'updateCompanyValuationReport',
            sourceName: 'updateCompanyValuationReport',
            needsClient: true,
            isAsync: true,
            paramsType: 'UpdateCompanyValuationParams',
            resultType: 'UpdateCompanyValuationResult',
          },
          {
            name: 'buildCreateCompanyValuationReportCommand',
            sourceName: 'buildCreateCompanyValuationReportCommand',
            needsClient: true,
            isAsync: false,
            paramsType: 'CreateCompanyValuationReportParams',
            resultType: 'CommandWithDisclosedContracts',
          },
        ],
      },
    },
  },
  CouponMinter: {
    customType: `{
    /**
     * Checks if minting coupons is currently allowed based on TPS rate limits.
     *
     * @param payload - The CouponMinter contract payload
     * @param now - Optional current time for testing
     * @returns {canMint: true} Or { canMint: false, waitMs: number }
     */
    canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => CanMintResult;
  }`,
    customCode: `{
      canMintCouponsNow: (payload: CouponMinterPayload, now?: Date) => canMintCouponsNow(payload, now),
    }`,
  },
  CantonPayments: {
    namespaces: {
      airdrop: {
        functions: [
          {
            name: 'buildCreateAirdropCommand',
            sourceName: 'buildCreateAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').CreateAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/airdrop',
          },
          {
            name: 'buildUpdateAirdropConfigCommand',
            sourceName: 'buildUpdateAirdropConfigCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').UpdateAirdropConfigParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/airdrop',
          },
          {
            name: 'buildAddObserversToAirdropCommand',
            sourceName: 'buildAddObserversToAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').AddObserversToAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/airdrop',
          },
          {
            name: 'buildJoinAirdropCommand',
            sourceName: 'buildJoinAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').JoinAirdropParams",
            resultType: 'CommandWithDisclosedContracts',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/airdrop',
          },
          {
            name: 'buildExecuteAirdropCommand',
            sourceName: 'buildExecuteAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ExecuteAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/airdrop',
          },
        ],
      },
      simpleAirdrop: {
        functions: [
          {
            name: 'buildCreateSimpleAirdropCommand',
            sourceName: 'buildCreateSimpleAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').CreateSimpleAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/simpleAirdrop',
          },
          {
            name: 'buildArchiveSimpleAirdropCommand',
            sourceName: 'buildArchiveSimpleAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ArchiveSimpleAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/simpleAirdrop',
          },
          {
            name: 'buildExecuteSimpleAirdropCommand',
            sourceName: 'buildExecuteSimpleAirdropCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ExecuteSimpleAirdropParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/CantonPayments/simpleAirdrop',
          },
        ],
      },
    },
  },
  PaymentStreams: {
    namespaces: {
      paymentStreamFactory: {
        functions: [
          {
            name: 'buildCreatePaymentStreamProposalCommand',
            sourceName: 'buildCreatePaymentStreamProposalCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').CreatePaymentStreamProposalParams",
            resultType: 'CommandWithDisclosedContracts',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
        ],
      },
      proposedPaymentStream: {
        functions: [
          {
            name: 'buildApproveCommand',
            sourceName: 'buildProposedPaymentStreamApproveCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProposedPaymentStreamApproveParams",
            resultType: 'CommandWithDisclosedContracts',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildStartPaymentStreamCommand',
            sourceName: 'buildProposedPaymentStreamStartCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProposedPaymentStreamStartParams",
            resultType: 'CommandWithDisclosedContracts',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildEditPaymentStreamProposalCommand',
            sourceName: 'buildEditPaymentStreamProposalCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').EditPaymentStreamProposalParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildWithdrawCommand',
            sourceName: 'buildProposedPaymentStreamWithdrawCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProposedPaymentStreamWithdrawParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildChangePartyCommand',
            sourceName: 'buildProposedPaymentStreamChangePartyCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProposedPaymentStreamChangePartyParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
        ],
      },
      activePaymentStream: {
        functions: [
          {
            name: 'buildProcessPaymentCommand',
            sourceName: 'buildProcessPaymentCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProcessPaymentParams",
            resultType: 'CommandWithDisclosedContracts',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildProcessFreeTrialCommand',
            sourceName: 'buildProcessFreeTrialCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProcessFreeTrialParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildCancelCommand',
            sourceName: 'buildCancelPaymentStreamCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').CancelPaymentStreamParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildProposeChangesCommand',
            sourceName: 'buildProposeChangesCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ProposeChangesParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildRefundCommand',
            sourceName: 'buildRefundPaymentStreamCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').RefundPaymentStreamParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildArchiveInactivePaymentStreamCommand',
            sourceName: 'buildArchiveInactivePaymentStreamCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ArchiveInactivePaymentStreamParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildChangePartyCommand',
            sourceName: 'buildActivePaymentStreamChangePartyCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').ActivePaymentStreamChangePartyParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
        ],
      },
      paymentStreamChangeProposal: {
        functions: [
          {
            name: 'buildApproveCommand',
            sourceName: 'buildPaymentStreamChangeProposalApproveCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').PaymentStreamChangeProposalApproveParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildApplyCommand',
            sourceName: 'buildPaymentStreamChangeProposalApplyCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').PaymentStreamChangeProposalApplyParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildRejectCommand',
            sourceName: 'buildPaymentStreamChangeProposalRejectCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').PaymentStreamChangeProposalRejectParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
        ],
      },
      partyMigrationProposal: {
        functions: [
          {
            name: 'buildApproveCommand',
            sourceName: 'buildPartyMigrationProposalApproveCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').PartyMigrationProposalApproveParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildMigrateActivePaymentStreamCommand',
            sourceName: 'buildMigrateActivePaymentStreamCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').MigrateActivePaymentStreamParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildMigrateProposedPaymentStreamCommand',
            sourceName: 'buildMigrateProposedPaymentStreamCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').MigrateProposedPaymentStreamParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
          {
            name: 'buildArchiveCommand',
            sourceName: 'buildPartyMigrationProposalArchiveCommand',
            needsClient: false,
            isAsync: false,
            paramsType: "import('./functions').PartyMigrationProposalArchiveParams",
            resultType: 'Command',
            useLazyRequire: true,
            lazyRequirePath: './functions/PaymentStreams',
          },
        ],
      },
      utils: {
        customType: `{
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
    }`,
        customCode: `{
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
      }`,
      },
    },
  },
};

// Types that should NOT be imported from ./functions (they come from elsewhere)
const EXCLUDED_TYPES = new Set(['Command', 'CommandWithDisclosedContracts']);

// Collect all imported types
function collectImportedTypes(config: Record<string, NamespaceConfig>): Set<string> {
  const types = new Set<string>();

  function processNamespace(ns: NamespaceConfig): void {
    if (ns.functions) {
      for (const fn of ns.functions) {
        if (
          fn.paramsType &&
          !fn.paramsType.startsWith('import(') &&
          !fn.paramsType.startsWith('{') &&
          !EXCLUDED_TYPES.has(fn.paramsType)
        ) {
          types.add(fn.paramsType);
        }
        if (
          fn.resultType &&
          !fn.resultType.startsWith('import(') &&
          !fn.resultType.startsWith('{') &&
          !EXCLUDED_TYPES.has(fn.resultType)
        ) {
          types.add(fn.resultType);
        }
      }
    }
    if (ns.namespaces) {
      for (const subNs of Object.values(ns.namespaces)) {
        processNamespace(subNs);
      }
    }
  }

  for (const ns of Object.values(config)) {
    processNamespace(ns);
  }

  return types;
}

// Collect all imported functions
function collectImportedFunctions(config: Record<string, NamespaceConfig>): Set<string> {
  const functions = new Set<string>();

  function processNamespace(ns: NamespaceConfig): void {
    if (ns.functions) {
      for (const fn of ns.functions) {
        if (!fn.useLazyRequire) {
          functions.add(fn.sourceName);
        }
      }
    }
    if (ns.namespaces) {
      for (const subNs of Object.values(ns.namespaces)) {
        processNamespace(subNs);
      }
    }
  }

  for (const ns of Object.values(config)) {
    processNamespace(ns);
  }

  return functions;
}

// Generate type definition for a function
function generateFunctionType(fn: FunctionConfig): string {
  const paramsType = fn.paramsType ?? 'unknown';
  const resultType = fn.resultType ?? 'void';

  if (fn.isAsync) {
    return `(params: ${paramsType}) => Promise<${resultType}>`;
  }
  return `(params: ${paramsType}) => ${resultType}`;
}

// Generate namespace type definition
function generateNamespaceType(name: string, ns: NamespaceConfig, indent = '    '): string {
  if (ns.customType) {
    return `${indent}${name}: ${ns.customType};`;
  }

  const lines: string[] = [];
  lines.push(`${indent}${name}: {`);

  if (ns.namespaces) {
    for (const [subName, subNs] of Object.entries(ns.namespaces)) {
      lines.push(generateNamespaceType(subName, subNs, `${indent}  `));
    }
  }

  if (ns.functions) {
    for (const fn of ns.functions) {
      const fnType = generateFunctionType(fn);
      lines.push(`${indent}  ${fn.name}: ${fnType};`);
    }
  }

  lines.push(`${indent}};`);
  return lines.join('\n');
}

// Generate implementation for a function
function generateFunctionImpl(fn: FunctionConfig): string {
  if (fn.useLazyRequire) {
    return `(params) => {
          const { ${fn.sourceName} } = require('${fn.lazyRequirePath}');
          return ${fn.sourceName}(params);
        }`;
  }

  if (fn.needsClient) {
    if (fn.isAsync) {
      return `async (params) => ${fn.sourceName}(this.client, params)`;
    }
    return `(params) => ${fn.sourceName}(this.client, params)`;
  }

  return `(params) => ${fn.sourceName}(params)`;
}

// Generate namespace implementation
function generateNamespaceImpl(ns: NamespaceConfig, indent = '      '): string {
  if (ns.customCode) {
    return ns.customCode;
  }

  const lines: string[] = [];
  lines.push('{');

  if (ns.namespaces) {
    const entries = Object.entries(ns.namespaces);
    for (let i = 0; i < entries.length; i++) {
      const [subName, subNs] = entries[i];
      const impl = generateNamespaceImpl(subNs, `${indent}  `);
      const comma = i < entries.length - 1 || (ns.functions && ns.functions.length > 0) ? ',' : '';
      lines.push(`${indent}${subName}: ${impl}${comma}`);
    }
  }

  if (ns.functions) {
    for (let i = 0; i < ns.functions.length; i++) {
      const fn = ns.functions[i];
      const impl = generateFunctionImpl(fn);
      const comma = i < ns.functions.length - 1 ? ',' : '';
      lines.push(`${indent}${fn.name}: ${impl}${comma}`);
    }
  }

  lines.push(`${indent.slice(2)}}`);
  return lines.join('\n');
}

// Main generation function
function generateOcpClient(): string {
  const importedTypes = collectImportedTypes(CLIENT_CONFIG);
  const importedFunctions = collectImportedFunctions(CLIENT_CONFIG);

  // Add special types that are always needed
  importedTypes.add('CanMintResult');
  importedTypes.add('CouponMinterPayload');

  // Add special functions
  importedFunctions.add('buildCreateCompanyValuationReportCommand');
  importedFunctions.add('canMintCouponsNow');

  const typeImports = Array.from(importedTypes).sort().join(',\n  ');
  const functionImports = Array.from(importedFunctions).sort().join(',\n  ');

  const output = `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.
// Regenerate with: npm run generate:client

import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api';
import type {
  Command,
  DisclosedContract,
} from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { TransactionBatch } from '@fairmint/canton-node-sdk/build/src/utils/transactions';
import type {
  ${typeImports},
} from './functions';
import {
  ${functionImports},
} from './functions';
import { CapTableBatch } from './functions/OpenCapTable/capTable';
import type { CommandWithDisclosedContracts } from './types';

/**
 * Context for OCP operations that can be cached and reused.
 *
 * Store commonly used contract details to avoid passing them repeatedly.
 *
 * @example
 *   \`\`\`typescript
 *   const ocp = new OcpClient({ network: 'localnet' });
 *
 *   // Set context once
 *   ocp.context.setFeaturedAppRight(featuredAppRightDetails);
 *
 *   // Now operations that need it can access it automatically
 *   const batch = ocp.OpenCapTable.capTable.update({
 *     capTableContractId,
 *     featuredAppRightContractDetails: ocp.context.featuredAppRight!, // or use requireFeaturedAppRight()
 *     actAs: [issuerParty],
 *   });
 *   \`\`\`
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
 * @see https://ocp.canton.fairmint.com/ - Full SDK documentation with usage examples
 */
export class OcpClient {
  /** The underlying LedgerJsonApiClient for direct ledger access. */
  public readonly client: LedgerJsonApiClient;

  /**
   * Context manager for caching commonly used values.
   *
   * Use this to store FeaturedAppRight details, issuer party, and cap table contract ID
   * after fetching them once, so they can be reused across operations.
   *
   * @example
   *   \`\`\`typescript
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
   *   \`\`\`
   */
  public readonly context: OcpContextManager = new OcpContextManager();

  /**
   * Core cap table operations.
   *
   * Use \`capTable.update()\` for all creates, edits, and deletes of OCF entities. Use entity-specific \`get*AsOcf()\`
   * methods to read data.
   */
  public OpenCapTable: {
${Object.entries(CLIENT_CONFIG.OpenCapTable.namespaces ?? {})
  .map(([name, ns]) => generateNamespaceType(name, ns))
  .join('\n')}
  };

  /** Reporting operations for cap table analytics. */
  public OpenCapTableReports: {
${Object.entries(CLIENT_CONFIG.OpenCapTableReports.namespaces ?? {})
  .map(([name, ns]) => generateNamespaceType(name, ns))
  .join('\n')}
  };

  /** CouponMinter utilities for TPS rate limit checking. */
  public CouponMinter: ${CLIENT_CONFIG.CouponMinter.customType};

  /** Payment and airdrop operations using Canton's native token. */
  public CantonPayments: {
${Object.entries(CLIENT_CONFIG.CantonPayments.namespaces ?? {})
  .map(([name, ns]) => generateNamespaceType(name, ns))
  .join('\n')}
  };

  /** Recurring payment stream management. */
  public PaymentStreams: {
${Object.entries(CLIENT_CONFIG.PaymentStreams.namespaces ?? {})
  .map(([name, ns]) => generateNamespaceType(name, ns))
  .join('\n')}
  };

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.OpenCapTable = {
${Object.entries(CLIENT_CONFIG.OpenCapTable.namespaces ?? {})
  .map(([name, ns]) => `      ${name}: ${generateNamespaceImpl(ns)},`)
  .join('\n')}
    };

    this.OpenCapTableReports = {
${Object.entries(CLIENT_CONFIG.OpenCapTableReports.namespaces ?? {})
  .map(([name, ns]) => `      ${name}: ${generateNamespaceImpl(ns)},`)
  .join('\n')}
    };

    this.CouponMinter = ${CLIENT_CONFIG.CouponMinter.customCode};

    /* eslint-disable @typescript-eslint/no-require-imports */
    this.CantonPayments = {
${Object.entries(CLIENT_CONFIG.CantonPayments.namespaces ?? {})
  .map(([name, ns]) => `      ${name}: ${generateNamespaceImpl(ns)},`)
  .join('\n')}
    };

    this.PaymentStreams = {
${Object.entries(CLIENT_CONFIG.PaymentStreams.namespaces ?? {})
  .map(([name, ns]) => `      ${name}: ${generateNamespaceImpl(ns)},`)
  .join('\n')}
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  }

  /** Create a new transaction batch for submitting multiple commands atomically. */
  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
`;

  return output;
}

// Main function
function main(): void {
  console.log('OcpClient Generator');
  console.log('===================\n');

  try {
    const output = generateOcpClient();

    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`✓ Generated ${OUTPUT_FILE}`);
    console.log('\nNext steps:');
    console.log('  npm run fix     # Format the generated code');
    console.log('  npm run typecheck  # Verify types');
  } catch (error) {
    console.error('Error generating OcpClient:', error);
    process.exit(1);
  }
}

main();
