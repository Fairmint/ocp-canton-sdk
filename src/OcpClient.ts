import { LedgerJsonApiClient, TransactionBatch } from '@fairmint/canton-node-sdk';
import {
  addObserversToCompanyValuationReport,
  buildArchiveIssuerByIssuerCommand,
  buildArchiveStockClassByIssuerCommand,
  buildCreateCompanyValuationReportCommand,
  buildCreateEquityCompensationExerciseCommand,
  buildCreateEquityCompensationIssuanceCommand,
  buildCreateIssuerCommand,
  buildCreateStockClassCommand,
  createCompanyValuationReport,
  getEquityCompensationExerciseEventAsOcf,
  getEquityCompensationIssuanceEventAsOcf,
  getIssuerAsOcf,
  getStockClassAsOcf,
  updateCompanyValuationReport,
} from './functions';
import {
  buildArchiveConvertibleIssuanceByIssuerCommand,
  buildCreateConvertibleIssuanceCommand,
  getConvertibleIssuanceAsOcf,
} from './functions/convertibleIssuance';
import {
  buildArchiveDocumentByIssuerCommand,
  buildCreateDocumentCommand,
  getDocumentAsOcf,
} from './functions/document';
import { authorizeIssuer, withdrawAuthorization } from './functions/issuerAuthorization';
import {
  buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand,
  buildCreateIssuerAuthorizedSharesAdjustmentCommand,
  getIssuerAuthorizedSharesAdjustmentEventAsOcf,
} from './functions/issuerAuthorizedSharesAdjustment';
import {
  buildArchiveStakeholderByIssuerCommand,
  buildCreateStakeholderCommand,
  getStakeholderAsOcf,
} from './functions/stakeholder';
import {
  buildArchiveStockCancellationByIssuerCommand,
  buildCreateStockCancellationCommand,
  getStockCancellationEventAsOcf,
} from './functions/stockCancellation';
import {
  buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand,
  buildCreateStockClassAuthorizedSharesAdjustmentCommand,
  getStockClassAuthorizedSharesAdjustmentEventAsOcf,
} from './functions/stockClassAuthorizedSharesAdjustment';
import type {
  CreateCompanyValuationReportParams,
  CreateCompanyValuationReportResult,
  CreateIssuerParams,
  CreateStockClassParams,
  GetEquityCompensationExerciseEventAsOcfParams,
  GetEquityCompensationIssuanceEventAsOcfParams,
  GetIssuerAsOcfParams,
  GetIssuerAsOcfResult,
  GetStockClassAsOcfParams,
  GetStockClassAsOcfResult,
  UpdateCompanyValuationParams,
  UpdateCompanyValuationResult,
} from './functions';
import type { GetConvertibleIssuanceAsOcfParams } from './functions/convertibleIssuance';
import type { GetDocumentAsOcfParams } from './functions/document';
import type {
  AuthorizeIssuerParams,
  AuthorizeIssuerResult,
  WithdrawAuthorizationParams,
  WithdrawAuthorizationResult,
} from './functions/issuerAuthorization';
import type { GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams } from './functions/issuerAuthorizedSharesAdjustment';
import type { GetStakeholderAsOcfParams } from './functions/stakeholder';
import type { GetStockCancellationEventAsOcfParams } from './functions/stockCancellation';
import type { GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams } from './functions/stockClassAuthorizedSharesAdjustment';
import type { GetStockIssuanceAsOcfParams } from './functions/stockIssuance';
import {
  buildArchiveStockIssuanceByIssuerCommand,
  buildCreateStockIssuanceCommand,
  getStockIssuanceAsOcf,
} from './functions/stockIssuance';
import type { GetStockLegendTemplateAsOcfParams } from './functions/stockLegendTemplate';
import {
  buildArchiveStockLegendTemplateByIssuerCommand,
  buildCreateStockLegendTemplateCommand,
  getStockLegendTemplateAsOcf,
} from './functions/stockLegendTemplate';
import type { GetStockPlanAsOcfParams } from './functions/stockPlan';
import {
  buildArchiveStockPlanByIssuerCommand,
  buildCreateStockPlanCommand,
  getStockPlanAsOcf,
} from './functions/stockPlan';
import type { GetStockPlanPoolAdjustmentEventAsOcfParams } from './functions/stockPlanPoolAdjustment';
import {
  buildArchiveStockPlanPoolAdjustmentByIssuerCommand,
  buildCreateStockPlanPoolAdjustmentCommand,
  getStockPlanPoolAdjustmentEventAsOcf,
} from './functions/stockPlanPoolAdjustment';
import type { GetVestingTermsAsOcfParams } from './functions/vestingTerms';
import {
  buildArchiveVestingTermsByIssuerCommand,
  buildCreateVestingTermsCommand,
  getVestingTermsAsOcf,
} from './functions/vestingTerms';
import type { GetWarrantIssuanceAsOcfParams } from './functions/warrantIssuance';
import {
  buildArchiveWarrantIssuanceByIssuerCommand,
  buildCreateWarrantIssuanceCommand,
  getWarrantIssuanceAsOcf,
} from './functions/warrantIssuance';
import type { CommandWithDisclosedContracts } from './types';
import type { CreateOcfObjectParams } from './utils/createOcfObject';
import { buildCreateOcfObjectCommandFactory } from './utils/createOcfObject';
import type { ClientConfig } from '@fairmint/canton-node-sdk';
import type { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';

export class OcpClient {
  public readonly client: LedgerJsonApiClient;

  public issuer: {
    buildCreateIssuerCommand: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
    buildArchiveIssuerByIssuerCommand: (params: { contractId: string }) => Command;
    getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
  };

  public stockClass: {
    buildCreateStockClassCommand: (params: CreateStockClassParams) => CommandWithDisclosedContracts;
    buildArchiveStockClassByIssuerCommand: (params: { contractId: string }) => Command;
    getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
  };

  public companyValuationReport: {
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

  public stakeholder: {
    buildCreateStakeholderCommand: (
      params: import('./functions').CreateStakeholderParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStakeholderByIssuerCommand: (params: { contractId: string }) => Command;
    getStakeholderAsOcf: (
      params: GetStakeholderAsOcfParams
    ) => Promise<import('./functions').GetStakeholderAsOcfResult>;
  };

  public stockLegendTemplate: {
    buildCreateStockLegendTemplateCommand: (
      params: import('./functions').CreateStockLegendTemplateParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockLegendTemplateByIssuerCommand: (params: { contractId: string }) => Command;
    getStockLegendTemplateAsOcf: (
      params: GetStockLegendTemplateAsOcfParams
    ) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
  };

  public vestingTerms: {
    buildCreateVestingTermsCommand: (
      params: import('./functions').CreateVestingTermsParams
    ) => CommandWithDisclosedContracts;
    buildArchiveVestingTermsByIssuerCommand: (params: { contractId: string }) => Command;
    getVestingTermsAsOcf: (
      params: GetVestingTermsAsOcfParams
    ) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
  };

  public stockPlan: {
    buildCreateStockPlanCommand: (params: import('./functions').CreateStockPlanParams) => CommandWithDisclosedContracts;
    buildArchiveStockPlanByIssuerCommand: (params: { contractId: string }) => Command;
    buildCreateEquityCompensationIssuanceCommand: (
      params: import('./functions').CreateEquityCompensationIssuanceParams
    ) => CommandWithDisclosedContracts;
    buildCreateEquityCompensationExerciseCommand: (
      params: import('./functions').CreateEquityCompensationExerciseParams
    ) => CommandWithDisclosedContracts;
    getStockPlanAsOcf: (params: GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    getEquityCompensationIssuanceEventAsOcf: (
      params: GetEquityCompensationIssuanceEventAsOcfParams
    ) => Promise<import('./functions').GetEquityCompensationIssuanceEventAsOcfResult>;
    getEquityCompensationExerciseEventAsOcf: (
      params: GetEquityCompensationExerciseEventAsOcfParams
    ) => Promise<import('./functions').GetEquityCompensationExerciseEventAsOcfResult>;
  };

  public warrantIssuance: {
    buildCreateWarrantIssuanceCommand: (
      params: import('./functions').CreateWarrantIssuanceParams
    ) => CommandWithDisclosedContracts;
    buildArchiveWarrantIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
    getWarrantIssuanceAsOcf: (
      params: GetWarrantIssuanceAsOcfParams
    ) => Promise<import('./functions').GetWarrantIssuanceAsOcfResult>;
  };

  public convertibleIssuance: {
    buildCreateConvertibleIssuanceCommand: (
      params: import('./functions').CreateConvertibleIssuanceParams
    ) => CommandWithDisclosedContracts;
    buildArchiveConvertibleIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
    getConvertibleIssuanceAsOcf: (
      params: GetConvertibleIssuanceAsOcfParams
    ) => Promise<import('./functions').GetConvertibleIssuanceAsOcfResult>;
  };

  public stockCancellation: {
    buildCreateStockCancellationCommand: (
      params: import('./functions').CreateStockCancellationParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockCancellationByIssuerCommand: (params: { contractId: string }) => Command;
    getStockCancellationEventAsOcf: (
      params: GetStockCancellationEventAsOcfParams
    ) => Promise<import('./functions').GetStockCancellationEventAsOcfResult>;
  };

  public issuerAuthorizedSharesAdjustment: {
    buildCreateIssuerAuthorizedSharesAdjustmentCommand: (
      params: import('./functions').CreateIssuerAuthorizedSharesAdjustmentParams
    ) => CommandWithDisclosedContracts;
    buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
    getIssuerAuthorizedSharesAdjustmentEventAsOcf: (
      params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
    ) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
  };

  public stockClassAuthorizedSharesAdjustment: {
    buildCreateStockClassAuthorizedSharesAdjustmentCommand: (
      params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
    getStockClassAuthorizedSharesAdjustmentEventAsOcf: (
      params: GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams
    ) => Promise<import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
  };

  public stockPlanPoolAdjustment: {
    buildCreateStockPlanPoolAdjustmentCommand: (
      params: import('./functions').CreateStockPlanPoolAdjustmentParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
    getStockPlanPoolAdjustmentEventAsOcf: (
      params: GetStockPlanPoolAdjustmentEventAsOcfParams
    ) => Promise<import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult>;
  };

  public stockIssuance: {
    buildCreateStockIssuanceCommand: (
      params: import('./functions').CreateStockIssuanceParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
    getStockIssuanceAsOcf: (
      params: GetStockIssuanceAsOcfParams
    ) => Promise<import('./functions').GetStockIssuanceAsOcfResult>;
  };

  public document: {
    buildCreateDocumentCommand: (params: import('./functions').CreateDocumentParams) => CommandWithDisclosedContracts;
    buildArchiveDocumentByIssuerCommand: (params: { contractId: string }) => Command;
    getDocumentAsOcf: (params: GetDocumentAsOcfParams) => Promise<import('./functions').GetDocumentAsOcfResult>;
  };

  public issuerAuthorization: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    withdrawAuthorization: (params: WithdrawAuthorizationParams) => Promise<WithdrawAuthorizationResult>;
  };

  public buildCreateOcfObjectCommand: (params: CreateOcfObjectParams) => CommandWithDisclosedContracts[];

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
      buildArchiveIssuerByIssuerCommand: (params) => buildArchiveIssuerByIssuerCommand(params),
      getIssuerAsOcf: async (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params),
    };

    this.stockClass = {
      buildCreateStockClassCommand: (params: CreateStockClassParams) => buildCreateStockClassCommand(params),
      buildArchiveStockClassByIssuerCommand: (params) => buildArchiveStockClassByIssuerCommand(params),
      getStockClassAsOcf: async (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params),
    };

    this.companyValuationReport = {
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
    };

    this.stakeholder = {
      buildCreateStakeholderCommand: (params) => buildCreateStakeholderCommand(params),
      buildArchiveStakeholderByIssuerCommand: (params) => buildArchiveStakeholderByIssuerCommand(params),
      getStakeholderAsOcf: async (params) => getStakeholderAsOcf(this.client, params),
    };

    this.stockLegendTemplate = {
      buildCreateStockLegendTemplateCommand: (params) => buildCreateStockLegendTemplateCommand(params),
      buildArchiveStockLegendTemplateByIssuerCommand: (params) =>
        buildArchiveStockLegendTemplateByIssuerCommand(params),
      getStockLegendTemplateAsOcf: async (params) => getStockLegendTemplateAsOcf(this.client, params),
    };

    this.vestingTerms = {
      buildCreateVestingTermsCommand: (params) => buildCreateVestingTermsCommand(params),
      buildArchiveVestingTermsByIssuerCommand: (params) => buildArchiveVestingTermsByIssuerCommand(params),
      getVestingTermsAsOcf: async (params) => getVestingTermsAsOcf(this.client, params),
    };

    this.stockPlan = {
      buildCreateStockPlanCommand: (params) => buildCreateStockPlanCommand(params),
      buildArchiveStockPlanByIssuerCommand: (params) => buildArchiveStockPlanByIssuerCommand(params),
      buildCreateEquityCompensationIssuanceCommand: (params) => buildCreateEquityCompensationIssuanceCommand(params),
      buildCreateEquityCompensationExerciseCommand: (params) => buildCreateEquityCompensationExerciseCommand(params),
      getStockPlanAsOcf: async (params) => getStockPlanAsOcf(this.client, params),
      getEquityCompensationIssuanceEventAsOcf: async (params) =>
        getEquityCompensationIssuanceEventAsOcf(this.client, params),
      getEquityCompensationExerciseEventAsOcf: async (params) =>
        getEquityCompensationExerciseEventAsOcf(this.client, params),
    };

    this.warrantIssuance = {
      buildCreateWarrantIssuanceCommand: (params) => buildCreateWarrantIssuanceCommand(params),
      buildArchiveWarrantIssuanceByIssuerCommand: (params) => buildArchiveWarrantIssuanceByIssuerCommand(params),
      getWarrantIssuanceAsOcf: async (params) => getWarrantIssuanceAsOcf(this.client, params),
    };

    this.convertibleIssuance = {
      buildCreateConvertibleIssuanceCommand: (params) => buildCreateConvertibleIssuanceCommand(params),
      buildArchiveConvertibleIssuanceByIssuerCommand: (params) =>
        buildArchiveConvertibleIssuanceByIssuerCommand(params),
      getConvertibleIssuanceAsOcf: async (params) => getConvertibleIssuanceAsOcf(this.client, params),
    };

    this.stockCancellation = {
      buildCreateStockCancellationCommand: (params) => buildCreateStockCancellationCommand(params),
      buildArchiveStockCancellationByIssuerCommand: (params) => buildArchiveStockCancellationByIssuerCommand(params),
      getStockCancellationEventAsOcf: async (params) => getStockCancellationEventAsOcf(this.client, params),
    };

    this.issuerAuthorizedSharesAdjustment = {
      buildCreateIssuerAuthorizedSharesAdjustmentCommand: (params) =>
        buildCreateIssuerAuthorizedSharesAdjustmentCommand(params),
      buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
        buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params),
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
        getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
    };

    this.stockClassAuthorizedSharesAdjustment = {
      buildCreateStockClassAuthorizedSharesAdjustmentCommand: (params) =>
        buildCreateStockClassAuthorizedSharesAdjustmentCommand(params),
      buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
        buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(params),
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: async (params) =>
        getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
    };

    this.stockPlanPoolAdjustment = {
      buildCreateStockPlanPoolAdjustmentCommand: (params) => buildCreateStockPlanPoolAdjustmentCommand(params),
      buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params) =>
        buildArchiveStockPlanPoolAdjustmentByIssuerCommand(params),
      getStockPlanPoolAdjustmentEventAsOcf: async (params) => getStockPlanPoolAdjustmentEventAsOcf(this.client, params),
    };

    this.document = {
      buildCreateDocumentCommand: (params) => buildCreateDocumentCommand(params),
      buildArchiveDocumentByIssuerCommand: (params) => buildArchiveDocumentByIssuerCommand(params),
      getDocumentAsOcf: async (params) => getDocumentAsOcf(this.client, params),
    };

    this.stockIssuance = {
      buildCreateStockIssuanceCommand: (params) => buildCreateStockIssuanceCommand(params),
      buildArchiveStockIssuanceByIssuerCommand: (params) => buildArchiveStockIssuanceByIssuerCommand(params),
      getStockIssuanceAsOcf: async (params) => getStockIssuanceAsOcf(this.client, params),
    };

    this.issuerAuthorization = {
      authorizeIssuer: async (params) => authorizeIssuer(this.client, params),
      withdrawAuthorization: async (params) => withdrawAuthorization(this.client, params),
    };

    this.buildCreateOcfObjectCommand = buildCreateOcfObjectCommandFactory(this);
  }

  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
