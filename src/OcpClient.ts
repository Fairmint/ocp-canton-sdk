import { LedgerJsonApiClient, TransactionBatch } from '@fairmint/canton-node-sdk';
import {
  buildCreateIssuerCommand,
  getIssuerAsOcf,
  buildArchiveIssuerByIssuerCommand,
  buildCreateStockClassCommand,
  getStockClassAsOcf,
  buildArchiveStockClassByIssuerCommand,
  buildCreateCompanyValuationReportCommand,
  buildCreateEquityCompensationExerciseCommand,
  buildCreateEquityCompensationIssuanceCommand,
  getEquityCompensationExerciseEventAsOcf,
  getEquityCompensationIssuanceEventAsOcf,
  addObserversToCompanyValuationReport,
  createCompanyValuationReport,
  updateCompanyValuationReport,
} from './functions';
import {
  buildCreateConvertibleIssuanceCommand,
  getConvertibleIssuanceAsOcf,
  buildArchiveConvertibleIssuanceByIssuerCommand,
} from './functions/convertibleIssuance';
import {
  buildCreateDocumentCommand,
  getDocumentAsOcf,
  buildArchiveDocumentByIssuerCommand,
} from './functions/document';
import { authorizeIssuer, withdrawAuthorization } from './functions/issuerAuthorization';
import {
  buildCreateIssuerAuthorizedSharesAdjustmentCommand,
  getIssuerAuthorizedSharesAdjustmentEventAsOcf,
  buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand,
} from './functions/issuerAuthorizedSharesAdjustment';
import {
  buildCreateStakeholderCommand,
  getStakeholderAsOcf,
  buildArchiveStakeholderByIssuerCommand,
} from './functions/stakeholder';
import {
  buildCreateStockCancellationCommand,
  getStockCancellationEventAsOcf,
  buildArchiveStockCancellationByIssuerCommand,
} from './functions/stockCancellation';
import {
  buildCreateStockClassAuthorizedSharesAdjustmentCommand,
  getStockClassAuthorizedSharesAdjustmentEventAsOcf,
  buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand,
} from './functions/stockClassAuthorizedSharesAdjustment';
import {
  buildCreateStockIssuanceCommand,
  getStockIssuanceAsOcf,
  buildArchiveStockIssuanceByIssuerCommand,
} from './functions/stockIssuance';
import {
  buildCreateStockLegendTemplateCommand,
  getStockLegendTemplateAsOcf,
  buildArchiveStockLegendTemplateByIssuerCommand,
} from './functions/stockLegendTemplate';
import {
  buildCreateStockPlanCommand,
  getStockPlanAsOcf,
  buildArchiveStockPlanByIssuerCommand,
} from './functions/stockPlan';
import {
  buildCreateStockPlanPoolAdjustmentCommand,
  getStockPlanPoolAdjustmentEventAsOcf,
  buildArchiveStockPlanPoolAdjustmentByIssuerCommand,
} from './functions/stockPlanPoolAdjustment';
import {
  buildCreateVestingTermsCommand,
  getVestingTermsAsOcf,
  buildArchiveVestingTermsByIssuerCommand,
} from './functions/vestingTerms';
import {
  buildCreateWarrantIssuanceCommand,
  getWarrantIssuanceAsOcf,
  buildArchiveWarrantIssuanceByIssuerCommand,
} from './functions/warrantIssuance';
import { buildCreateOcfObjectCommandFactory } from './utils/createOcfObject';
import type {
  CreateIssuerParams,
  GetIssuerAsOcfParams,
  GetIssuerAsOcfResult,
  CreateStockClassParams,
  GetStockClassAsOcfParams,
  GetStockClassAsOcfResult,
  CreateCompanyValuationReportParams,
  GetEquityCompensationExerciseEventAsOcfParams,
  GetEquityCompensationIssuanceEventAsOcfParams,
  UpdateCompanyValuationParams,
  CreateCompanyValuationReportResult,
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
import type { GetStockLegendTemplateAsOcfParams } from './functions/stockLegendTemplate';
import type { GetStockPlanAsOcfParams } from './functions/stockPlan';
import type { GetStockPlanPoolAdjustmentEventAsOcfParams } from './functions/stockPlanPoolAdjustment';
import type { GetVestingTermsAsOcfParams } from './functions/vestingTerms';
import type { GetWarrantIssuanceAsOcfParams } from './functions/warrantIssuance';
import type { CommandWithDisclosedContracts } from './types';
import type { CreateOcfObjectParams } from './utils/createOcfObject';
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
    updateCompanyValuationReport: (
      params: UpdateCompanyValuationParams
    ) => Promise<UpdateCompanyValuationResult>;
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
    buildCreateStockPlanCommand: (
      params: import('./functions').CreateStockPlanParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockPlanByIssuerCommand: (params: { contractId: string }) => Command;
    buildCreateEquityCompensationIssuanceCommand: (
      params: import('./functions').CreateEquityCompensationIssuanceParams
    ) => CommandWithDisclosedContracts;
    buildCreateEquityCompensationExerciseCommand: (
      params: import('./functions').CreateEquityCompensationExerciseParams
    ) => CommandWithDisclosedContracts;
    getStockPlanAsOcf: (
      params: GetStockPlanAsOcfParams
    ) => Promise<import('./functions').GetStockPlanAsOcfResult>;
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
    buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params: {
      contractId: string;
    }) => Command;
    getIssuerAuthorizedSharesAdjustmentEventAsOcf: (
      params: GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams
    ) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
  };

  public stockClassAuthorizedSharesAdjustment: {
    buildCreateStockClassAuthorizedSharesAdjustmentCommand: (
      params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams
    ) => CommandWithDisclosedContracts;
    buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params: {
      contractId: string;
    }) => Command;
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
    buildCreateDocumentCommand: (
      params: import('./functions').CreateDocumentParams
    ) => CommandWithDisclosedContracts;
    buildArchiveDocumentByIssuerCommand: (params: { contractId: string }) => Command;
    getDocumentAsOcf: (
      params: GetDocumentAsOcfParams
    ) => Promise<import('./functions').GetDocumentAsOcfResult>;
  };

  public issuerAuthorization: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    withdrawAuthorization: (
      params: WithdrawAuthorizationParams
    ) => Promise<WithdrawAuthorizationResult>;
  };

  public buildCreateOcfObjectCommand: (
    params: CreateOcfObjectParams
  ) => CommandWithDisclosedContracts[];

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
      buildArchiveIssuerByIssuerCommand: (params) => buildArchiveIssuerByIssuerCommand(params),
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params),
    };

    this.stockClass = {
      buildCreateStockClassCommand: (params: CreateStockClassParams) =>
        buildCreateStockClassCommand(params),
      buildArchiveStockClassByIssuerCommand: (params) =>
        buildArchiveStockClassByIssuerCommand(params),
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) =>
        getStockClassAsOcf(this.client, params),
    };

    this.companyValuationReport = {
      buildCreateCompanyValuationReportCommand: (params: CreateCompanyValuationReportParams) =>
        buildCreateCompanyValuationReportCommand(this.client, params),
      addObserversToCompanyValuationReport: (params: {
        companyValuationReportContractId: string;
        added: string[];
      }) => addObserversToCompanyValuationReport(this.client, params),
      createCompanyValuationReport: (params: CreateCompanyValuationReportParams) =>
        createCompanyValuationReport(this.client, params),
      updateCompanyValuationReport: (params: UpdateCompanyValuationParams) =>
        updateCompanyValuationReport(this.client, params),
    };

    this.stakeholder = {
      buildCreateStakeholderCommand: (params) => buildCreateStakeholderCommand(params),
      buildArchiveStakeholderByIssuerCommand: (params) =>
        buildArchiveStakeholderByIssuerCommand(params),
      getStakeholderAsOcf: (params) => getStakeholderAsOcf(this.client, params),
    };

    this.stockLegendTemplate = {
      buildCreateStockLegendTemplateCommand: (params) =>
        buildCreateStockLegendTemplateCommand(params),
      buildArchiveStockLegendTemplateByIssuerCommand: (params) =>
        buildArchiveStockLegendTemplateByIssuerCommand(params),
      getStockLegendTemplateAsOcf: (params) => getStockLegendTemplateAsOcf(this.client, params),
    };

    this.vestingTerms = {
      buildCreateVestingTermsCommand: (params) => buildCreateVestingTermsCommand(params),
      buildArchiveVestingTermsByIssuerCommand: (params) =>
        buildArchiveVestingTermsByIssuerCommand(params),
      getVestingTermsAsOcf: (params) => getVestingTermsAsOcf(this.client, params),
    };

    this.stockPlan = {
      buildCreateStockPlanCommand: (params) => buildCreateStockPlanCommand(params),
      buildArchiveStockPlanByIssuerCommand: (params) =>
        buildArchiveStockPlanByIssuerCommand(params),
      buildCreateEquityCompensationIssuanceCommand: (params) =>
        buildCreateEquityCompensationIssuanceCommand(params),
      buildCreateEquityCompensationExerciseCommand: (params) =>
        buildCreateEquityCompensationExerciseCommand(params),
      getStockPlanAsOcf: (params) => getStockPlanAsOcf(this.client, params),
      getEquityCompensationIssuanceEventAsOcf: (params) =>
        getEquityCompensationIssuanceEventAsOcf(this.client, params),
      getEquityCompensationExerciseEventAsOcf: (params) =>
        getEquityCompensationExerciseEventAsOcf(this.client, params),
    };

    this.warrantIssuance = {
      buildCreateWarrantIssuanceCommand: (params) => buildCreateWarrantIssuanceCommand(params),
      buildArchiveWarrantIssuanceByIssuerCommand: (params) =>
        buildArchiveWarrantIssuanceByIssuerCommand(params),
      getWarrantIssuanceAsOcf: (params) => getWarrantIssuanceAsOcf(this.client, params),
    };

    this.convertibleIssuance = {
      buildCreateConvertibleIssuanceCommand: (params) =>
        buildCreateConvertibleIssuanceCommand(params),
      buildArchiveConvertibleIssuanceByIssuerCommand: (params) =>
        buildArchiveConvertibleIssuanceByIssuerCommand(params),
      getConvertibleIssuanceAsOcf: (params) => getConvertibleIssuanceAsOcf(this.client, params),
    };

    this.stockCancellation = {
      buildCreateStockCancellationCommand: (params) => buildCreateStockCancellationCommand(params),
      buildArchiveStockCancellationByIssuerCommand: (params) =>
        buildArchiveStockCancellationByIssuerCommand(params),
      getStockCancellationEventAsOcf: (params) =>
        getStockCancellationEventAsOcf(this.client, params),
    };

    this.issuerAuthorizedSharesAdjustment = {
      buildCreateIssuerAuthorizedSharesAdjustmentCommand: (params) =>
        buildCreateIssuerAuthorizedSharesAdjustmentCommand(params),
      buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
        buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params),
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: (params) =>
        getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
    };

    this.stockClassAuthorizedSharesAdjustment = {
      buildCreateStockClassAuthorizedSharesAdjustmentCommand: (params) =>
        buildCreateStockClassAuthorizedSharesAdjustmentCommand(params),
      buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params) =>
        buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(params),
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: (params) =>
        getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
    };

    this.stockPlanPoolAdjustment = {
      buildCreateStockPlanPoolAdjustmentCommand: (params) =>
        buildCreateStockPlanPoolAdjustmentCommand(params),
      buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params) =>
        buildArchiveStockPlanPoolAdjustmentByIssuerCommand(params),
      getStockPlanPoolAdjustmentEventAsOcf: (params) =>
        getStockPlanPoolAdjustmentEventAsOcf(this.client, params),
    };

    this.document = {
      buildCreateDocumentCommand: (params) => buildCreateDocumentCommand(params),
      buildArchiveDocumentByIssuerCommand: (params) => buildArchiveDocumentByIssuerCommand(params),
      getDocumentAsOcf: (params) => getDocumentAsOcf(this.client, params),
    };

    this.stockIssuance = {
      buildCreateStockIssuanceCommand: (params) => buildCreateStockIssuanceCommand(params),
      buildArchiveStockIssuanceByIssuerCommand: (params) =>
        buildArchiveStockIssuanceByIssuerCommand(params),
      getStockIssuanceAsOcf: (params) => getStockIssuanceAsOcf(this.client, params),
    };

    this.issuerAuthorization = {
      authorizeIssuer: (params) => authorizeIssuer(this.client, params),
      withdrawAuthorization: (params) => withdrawAuthorization(this.client, params),
    };

    this.buildCreateOcfObjectCommand = buildCreateOcfObjectCommandFactory(this);
  }

  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
