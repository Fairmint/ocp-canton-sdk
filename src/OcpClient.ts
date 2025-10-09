import type { ClientConfig } from '@fairmint/canton-node-sdk';
import { LedgerJsonApiClient, TransactionBatch } from '@fairmint/canton-node-sdk';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import type {
  AuthorizeIssuerParams,
  AuthorizeIssuerResult,
  CreateCompanyValuationReportParams,
  CreateCompanyValuationReportResult,
  CreateIssuerParams,
  CreateStockClassParams,
  GetConvertibleIssuanceAsOcfParams,
  GetDocumentAsOcfParams,
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
  GetVestingTermsAsOcfParams,
  GetWarrantIssuanceAsOcfParams,
  UpdateCompanyValuationParams,
  UpdateCompanyValuationResult,
  WithdrawAuthorizationParams,
  WithdrawAuthorizationResult,
} from './functions';
import {
  addObserversToCompanyValuationReport,
  authorizeIssuer,
  buildArchiveConvertibleIssuanceByIssuerCommand,
  buildArchiveDocumentByIssuerCommand,
  buildArchiveEquityCompensationExerciseByIssuerCommand,
  buildArchiveEquityCompensationIssuanceByIssuerCommand,
  buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand,
  buildArchiveIssuerByIssuerCommand,
  buildArchiveStakeholderByIssuerCommand,
  buildArchiveStockCancellationByIssuerCommand,
  buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand,
  buildArchiveStockClassByIssuerCommand,
  buildArchiveStockIssuanceByIssuerCommand,
  buildArchiveStockLegendTemplateByIssuerCommand,
  buildArchiveStockPlanByIssuerCommand,
  buildArchiveStockPlanPoolAdjustmentByIssuerCommand,
  buildArchiveVestingTermsByIssuerCommand,
  buildArchiveWarrantIssuanceByIssuerCommand,
  buildCancelByRecipientCommand,
  buildCancelBySubscriberCommand,
  buildCreateCompanyValuationReportCommand,
  buildCreateConvertibleIssuanceCommand,
  buildCreateDocumentCommand,
  buildCreateEquityCompensationExerciseCommand,
  buildCreateEquityCompensationIssuanceCommand,
  buildCreateIssuerAuthorizedSharesAdjustmentCommand,
  buildCreateIssuerCommand,
  buildCreateStakeholderCommand,
  buildCreateStockCancellationCommand,
  buildCreateStockClassAuthorizedSharesAdjustmentCommand,
  buildCreateStockClassCommand,
  buildCreateStockIssuanceCommand,
  buildCreateStockLegendTemplateCommand,
  buildCreateStockPlanCommand,
  buildCreateStockPlanPoolAdjustmentCommand,
  buildCreateSubscriptionProposalCommand,
  buildCreateVestingTermsCommand,
  buildCreateWarrantIssuanceCommand,
  buildProcessFreeTrialCommand,
  buildProcessorApproveCommand,
  buildProcessorApprovedRecipientAcceptCommand,
  buildProcessorApprovedRecipientRejectCommand,
  buildProcessorApprovedSubscriberWithdrawCommand,
  buildProcessorRejectCommand,
  buildProcessPaymentCommand,
  buildRecipientRejectCommand,
  buildSubscriberWithdrawCommand,
  createCompanyValuationReport,
  getConvertibleIssuanceAsOcf,
  getDocumentAsOcf,
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
  getVestingTermsAsOcf,
  getWarrantIssuanceAsOcf,
  updateCompanyValuationReport,
  withdrawAuthorization,
} from './functions';
import type { CommandWithDisclosedContracts } from './types';
import type { CreateOcfObjectParams } from './utils/createOcfObject';
import { buildCreateOcfObjectCommandFactory } from './utils/createOcfObject';

export class OcpClient {
  public readonly client: LedgerJsonApiClient;

  public OpenCapTable: {
    issuer: {
      buildCreateIssuerCommand: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
      buildArchiveIssuerByIssuerCommand: (params: { contractId: string }) => Command;
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
    };
    stockClass: {
      buildCreateStockClassCommand: (params: CreateStockClassParams) => CommandWithDisclosedContracts;
      buildArchiveStockClassByIssuerCommand: (params: { contractId: string }) => Command;
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
    };
    stakeholder: {
      buildCreateStakeholderCommand: (
        params: import('./functions').CreateStakeholderParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStakeholderByIssuerCommand: (params: { contractId: string }) => Command;
      getStakeholderAsOcf: (
        params: GetStakeholderAsOcfParams
      ) => Promise<import('./functions').GetStakeholderAsOcfResult>;
    };
    stockLegendTemplate: {
      buildCreateStockLegendTemplateCommand: (
        params: import('./functions').CreateStockLegendTemplateParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockLegendTemplateByIssuerCommand: (params: { contractId: string }) => Command;
      getStockLegendTemplateAsOcf: (
        params: GetStockLegendTemplateAsOcfParams
      ) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
    };
    vestingTerms: {
      buildCreateVestingTermsCommand: (
        params: import('./functions').CreateVestingTermsParams
      ) => CommandWithDisclosedContracts;
      buildArchiveVestingTermsByIssuerCommand: (params: { contractId: string }) => Command;
      getVestingTermsAsOcf: (
        params: GetVestingTermsAsOcfParams
      ) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
    };
    stockPlan: {
      buildCreateStockPlanCommand: (
        params: import('./functions').CreateStockPlanParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockPlanByIssuerCommand: (params: { contractId: string }) => Command;
      getStockPlanAsOcf: (params: GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    };
    equityCompensationIssuance: {
      buildCreateEquityCompensationIssuanceCommand: (
        params: import('./functions').CreateEquityCompensationIssuanceParams
      ) => CommandWithDisclosedContracts;
      buildArchiveEquityCompensationIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
      getEquityCompensationIssuanceEventAsOcf: (
        params: GetEquityCompensationIssuanceEventAsOcfParams
      ) => Promise<import('./functions').GetEquityCompensationIssuanceEventAsOcfResult>;
    };
    equityCompensationExercise: {
      buildCreateEquityCompensationExerciseCommand: (
        params: import('./functions').CreateEquityCompensationExerciseParams
      ) => CommandWithDisclosedContracts;
      buildArchiveEquityCompensationExerciseByIssuerCommand: (params: { contractId: string }) => Command;
      getEquityCompensationExerciseEventAsOcf: (
        params: GetEquityCompensationExerciseEventAsOcfParams
      ) => Promise<import('./functions').GetEquityCompensationExerciseEventAsOcfResult>;
    };
    warrantIssuance: {
      buildCreateWarrantIssuanceCommand: (
        params: import('./functions').CreateWarrantIssuanceParams
      ) => CommandWithDisclosedContracts;
      buildArchiveWarrantIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
      getWarrantIssuanceAsOcf: (
        params: GetWarrantIssuanceAsOcfParams
      ) => Promise<import('./functions').GetWarrantIssuanceAsOcfResult>;
    };
    convertibleIssuance: {
      buildCreateConvertibleIssuanceCommand: (
        params: import('./functions').CreateConvertibleIssuanceParams
      ) => CommandWithDisclosedContracts;
      buildArchiveConvertibleIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
      getConvertibleIssuanceAsOcf: (
        params: GetConvertibleIssuanceAsOcfParams
      ) => Promise<import('./functions').GetConvertibleIssuanceAsOcfResult>;
    };
    stockCancellation: {
      buildCreateStockCancellationCommand: (
        params: import('./functions').CreateStockCancellationParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockCancellationByIssuerCommand: (params: { contractId: string }) => Command;
      getStockCancellationEventAsOcf: (
        params: GetStockCancellationEventAsOcfParams
      ) => Promise<import('./functions').GetStockCancellationEventAsOcfResult>;
    };
    issuerAuthorizedSharesAdjustment: {
      buildCreateIssuerAuthorizedSharesAdjustmentCommand: (
        params: import('./functions').CreateIssuerAuthorizedSharesAdjustmentParams
      ) => CommandWithDisclosedContracts;
      buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: (
        params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
    };
    stockClassAuthorizedSharesAdjustment: {
      buildCreateStockClassAuthorizedSharesAdjustmentCommand: (
        params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: (
        params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
    };
    stockPlanPoolAdjustment: {
      buildCreateStockPlanPoolAdjustmentCommand: (
        params: import('./functions').CreateStockPlanPoolAdjustmentParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
      getStockPlanPoolAdjustmentEventAsOcf: (
        params: GetStockPlanPoolAdjustmentEventAsOcfParams
      ) => Promise<import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult>;
    };
    stockIssuance: {
      buildCreateStockIssuanceCommand: (
        params: import('./functions').CreateStockIssuanceParams
      ) => CommandWithDisclosedContracts;
      buildArchiveStockIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
      getStockIssuanceAsOcf: (
        params: GetStockIssuanceAsOcfParams
      ) => Promise<import('./functions').GetStockIssuanceAsOcfResult>;
    };
    document: {
      buildCreateDocumentCommand: (params: import('./functions').CreateDocumentParams) => CommandWithDisclosedContracts;
      buildArchiveDocumentByIssuerCommand: (params: { contractId: string }) => Command;
      getDocumentAsOcf: (params: GetDocumentAsOcfParams) => Promise<import('./functions').GetDocumentAsOcfResult>;
    };
    issuerAuthorization: {
      authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
      withdrawAuthorization: (params: WithdrawAuthorizationParams) => Promise<WithdrawAuthorizationResult>;
    };
  };

  public OpenCapTableReports: {
    companyValuationReport: {
      addObserversToCompanyValuationReport: (params: {
        companyValuationReportContractId: string;
        added: string[];
      }) => Promise<{
        contractId: string;
        updateId: string;
      }>;
      createCompanyValuationReport: (
        params: CreateCompanyValuationReportParams
      ) => Promise<CreateCompanyValuationReportResult>;
      updateCompanyValuationReport: (params: UpdateCompanyValuationParams) => Promise<UpdateCompanyValuationResult>;
      buildCreateCompanyValuationReportCommand: (
        params: CreateCompanyValuationReportParams
      ) => CommandWithDisclosedContracts;
    };
  };

  public Subscriptions: {
    subscriptionFactory: {
      buildCreateSubscriptionProposalCommand: (
        params: import('./functions').CreateSubscriptionProposalParams
      ) => CommandWithDisclosedContracts;
    };
    subscriptionProposal: {
      buildProcessorApproveCommand: (params: import('./functions').ProcessorApproveParams) => Command;
      buildProcessorRejectCommand: (params: import('./functions').ProcessorRejectParams) => Command;
      buildSubscriberWithdrawCommand: (params: import('./functions').SubscriberWithdrawParams) => Command;
      buildRecipientRejectCommand: (params: import('./functions').RecipientRejectParams) => Command;
    };
    processorApprovedSubscriptionProposal: {
      buildRecipientAcceptCommand: (params: import('./functions').ProcessorApprovedRecipientAcceptParams) => Command;
      buildRecipientRejectCommand: (params: import('./functions').ProcessorApprovedRecipientRejectParams) => Command;
      buildSubscriberWithdrawCommand: (
        params: import('./functions').ProcessorApprovedSubscriberWithdrawParams
      ) => Command;
    };
    subscription: {
      buildProcessPaymentCommand: (params: import('./functions').ProcessPaymentParams) => Command;
      buildProcessFreeTrialCommand: (params: import('./functions').ProcessFreeTrialParams) => Command;
      buildCancelBySubscriberCommand: (params: import('./functions').CancelBySubscriberParams) => Command;
      buildCancelByRecipientCommand: (params: import('./functions').CancelByRecipientParams) => Command;
    };
  };

  public buildCreateOcfObjectCommand: (params: CreateOcfObjectParams) => CommandWithDisclosedContracts[];

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    // OpenCapTable namespace
    this.OpenCapTable = {
      issuer: {
        buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
        buildArchiveIssuerByIssuerCommand: (params) => buildArchiveIssuerByIssuerCommand(params),
        getIssuerAsOcf: async (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params),
      },
      stockClass: {
        buildCreateStockClassCommand: (params: CreateStockClassParams) => buildCreateStockClassCommand(params),
        buildArchiveStockClassByIssuerCommand: (params) => buildArchiveStockClassByIssuerCommand(params),
        getStockClassAsOcf: async (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params),
      },
      stakeholder: {
        buildCreateStakeholderCommand: (params) => buildCreateStakeholderCommand(params),
        buildArchiveStakeholderByIssuerCommand: (params) => buildArchiveStakeholderByIssuerCommand(params),
        getStakeholderAsOcf: async (params) => getStakeholderAsOcf(this.client, params),
      },
      stockLegendTemplate: {
        buildCreateStockLegendTemplateCommand: (params) => buildCreateStockLegendTemplateCommand(params),
        buildArchiveStockLegendTemplateByIssuerCommand: (params) =>
          buildArchiveStockLegendTemplateByIssuerCommand(params),
        getStockLegendTemplateAsOcf: async (params) => getStockLegendTemplateAsOcf(this.client, params),
      },
      vestingTerms: {
        buildCreateVestingTermsCommand: (params) => buildCreateVestingTermsCommand(params),
        buildArchiveVestingTermsByIssuerCommand: (params) => buildArchiveVestingTermsByIssuerCommand(params),
        getVestingTermsAsOcf: async (params) => getVestingTermsAsOcf(this.client, params),
      },
      stockPlan: {
        buildCreateStockPlanCommand: (params) => buildCreateStockPlanCommand(params),
        buildArchiveStockPlanByIssuerCommand: (params) => buildArchiveStockPlanByIssuerCommand(params),
        getStockPlanAsOcf: async (params) => getStockPlanAsOcf(this.client, params),
      },
      equityCompensationIssuance: {
        buildCreateEquityCompensationIssuanceCommand: (params) => buildCreateEquityCompensationIssuanceCommand(params),
        buildArchiveEquityCompensationIssuanceByIssuerCommand: (params) =>
          buildArchiveEquityCompensationIssuanceByIssuerCommand(params),
        getEquityCompensationIssuanceEventAsOcf: async (params) =>
          getEquityCompensationIssuanceEventAsOcf(this.client, params),
      },
      equityCompensationExercise: {
        buildCreateEquityCompensationExerciseCommand: (params) => buildCreateEquityCompensationExerciseCommand(params),
        buildArchiveEquityCompensationExerciseByIssuerCommand: (params) =>
          buildArchiveEquityCompensationExerciseByIssuerCommand(params),
        getEquityCompensationExerciseEventAsOcf: async (params) =>
          getEquityCompensationExerciseEventAsOcf(this.client, params),
      },
      warrantIssuance: {
        buildCreateWarrantIssuanceCommand: (params) => buildCreateWarrantIssuanceCommand(params),
        buildArchiveWarrantIssuanceByIssuerCommand: (params) => buildArchiveWarrantIssuanceByIssuerCommand(params),
        getWarrantIssuanceAsOcf: async (params) => getWarrantIssuanceAsOcf(this.client, params),
      },
      convertibleIssuance: {
        buildCreateConvertibleIssuanceCommand: (params) => buildCreateConvertibleIssuanceCommand(params),
        buildArchiveConvertibleIssuanceByIssuerCommand: (params) =>
          buildArchiveConvertibleIssuanceByIssuerCommand(params),
        getConvertibleIssuanceAsOcf: async (params) => getConvertibleIssuanceAsOcf(this.client, params),
      },
      stockCancellation: {
        buildCreateStockCancellationCommand: (params) => buildCreateStockCancellationCommand(params),
        buildArchiveStockCancellationByIssuerCommand: (params) => buildArchiveStockCancellationByIssuerCommand(params),
        getStockCancellationEventAsOcf: async (params) => getStockCancellationEventAsOcf(this.client, params),
      },
      issuerAuthorizedSharesAdjustment: {
        buildCreateIssuerAuthorizedSharesAdjustmentCommand: (params) =>
          buildCreateIssuerAuthorizedSharesAdjustmentCommand(params),
        buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
          buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params),
        getIssuerAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
          getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      },
      stockClassAuthorizedSharesAdjustment: {
        buildCreateStockClassAuthorizedSharesAdjustmentCommand: (params) =>
          buildCreateStockClassAuthorizedSharesAdjustmentCommand(params),
        buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
          buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(params),
        getStockClassAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
          getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      },
      stockPlanPoolAdjustment: {
        buildCreateStockPlanPoolAdjustmentCommand: (params) => buildCreateStockPlanPoolAdjustmentCommand(params),
        buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params) =>
          buildArchiveStockPlanPoolAdjustmentByIssuerCommand(params),
        getStockPlanPoolAdjustmentEventAsOcf: async (params) =>
          getStockPlanPoolAdjustmentEventAsOcf(this.client, params),
      },
      document: {
        buildCreateDocumentCommand: (params) => buildCreateDocumentCommand(params),
        buildArchiveDocumentByIssuerCommand: (params) => buildArchiveDocumentByIssuerCommand(params),
        getDocumentAsOcf: async (params) => getDocumentAsOcf(this.client, params),
      },
      stockIssuance: {
        buildCreateStockIssuanceCommand: (params) => buildCreateStockIssuanceCommand(params),
        buildArchiveStockIssuanceByIssuerCommand: (params) => buildArchiveStockIssuanceByIssuerCommand(params),
        getStockIssuanceAsOcf: async (params) => getStockIssuanceAsOcf(this.client, params),
      },
      issuerAuthorization: {
        authorizeIssuer: async (params) => authorizeIssuer(this.client, params),
        withdrawAuthorization: async (params) => withdrawAuthorization(this.client, params),
      },
    };

    // OpenCapTableReports namespace
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

    // Subscriptions namespace
    this.Subscriptions = {
      subscriptionFactory: {
        buildCreateSubscriptionProposalCommand: (params) => buildCreateSubscriptionProposalCommand(params),
      },
      subscriptionProposal: {
        buildProcessorApproveCommand: (params) => buildProcessorApproveCommand(params),
        buildProcessorRejectCommand: (params) => buildProcessorRejectCommand(params),
        buildSubscriberWithdrawCommand: (params) => buildSubscriberWithdrawCommand(params),
        buildRecipientRejectCommand: (params) => buildRecipientRejectCommand(params),
      },
      processorApprovedSubscriptionProposal: {
        buildRecipientAcceptCommand: (params) => buildProcessorApprovedRecipientAcceptCommand(params),
        buildRecipientRejectCommand: (params) => buildProcessorApprovedRecipientRejectCommand(params),
        buildSubscriberWithdrawCommand: (params) => buildProcessorApprovedSubscriberWithdrawCommand(params),
      },
      subscription: {
        buildProcessPaymentCommand: (params) => buildProcessPaymentCommand(params),
        buildProcessFreeTrialCommand: (params) => buildProcessFreeTrialCommand(params),
        buildCancelBySubscriberCommand: (params) => buildCancelBySubscriberCommand(params),
        buildCancelByRecipientCommand: (params) => buildCancelByRecipientCommand(params),
      },
    };

    this.buildCreateOcfObjectCommand = buildCreateOcfObjectCommandFactory(this);
  }

  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
