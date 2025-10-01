import { ClientConfig, LedgerJsonApiClient, TransactionBatch } from '@fairmint/canton-node-sdk';
import { Command } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import {
  authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult,
  createIssuer, CreateIssuerParams, CreateIssuerResult, buildCreateIssuerCommand,
  getIssuerAsOcf, GetIssuerAsOcfParams, GetIssuerAsOcfResult,
  createValuation, buildCreateValuationCommand,
  createStockClass, CreateStockClassParams, CreateStockClassResult, buildCreateStockClassCommand,
  getStockClassAsOcf, GetStockClassAsOcfParams, GetStockClassAsOcfResult,
  archiveStockClassByIssuer, buildArchiveStockClassByIssuerCommand,
  createCompanyValuationReport, CreateCompanyValuationReportParams, CreateCompanyValuationReportResult, buildCreateCompanyValuationReportCommand,
  updateCompanyValuation, UpdateCompanyValuationParams, UpdateCompanyValuationResult,
  addObserversToCompanyValuationReport, AddObserversToCompanyValuationReportParams, AddObserversToCompanyValuationReportResult
} from './functions';
import { createStakeholder, buildCreateStakeholderCommand, getStakeholderAsOcf, archiveStakeholderByIssuer, buildArchiveStakeholderByIssuerCommand } from './functions/stakeholder';
import { createStockLegendTemplate, buildCreateStockLegendTemplateCommand, getStockLegendTemplateAsOcf, archiveStockLegendTemplateByIssuer, buildArchiveStockLegendTemplateByIssuerCommand } from './functions/stockLegendTemplate';
import { getValuationAsOcf, archiveValuationByIssuer, buildArchiveValuationByIssuerCommand } from './functions/valuation';
import { createVestingTerms, buildCreateVestingTermsCommand, getVestingTermsAsOcf, archiveVestingTermsByIssuer, buildArchiveVestingTermsByIssuerCommand } from './functions/vestingTerms';
import { createStockPlan, buildCreateStockPlanCommand, getStockPlanAsOcf, archiveStockPlanByIssuer, buildArchiveStockPlanByIssuerCommand, getEquityCompensationIssuanceEventAsOcf, getEquityCompensationExerciseEventAsOcf, createEquityCompensationIssuance, buildCreateEquityCompensationIssuanceCommand, createEquityCompensationExercise, buildCreateEquityCompensationExerciseCommand } from './functions/stockPlan';
import { createWarrantIssuance, buildCreateWarrantIssuanceCommand, getWarrantIssuanceAsOcf, archiveWarrantIssuanceByIssuer, buildArchiveWarrantIssuanceByIssuerCommand } from './functions/warrantIssuance';
import { createConvertibleIssuance, buildCreateConvertibleIssuanceCommand, getConvertibleIssuanceAsOcf, archiveConvertibleIssuanceByIssuer, buildArchiveConvertibleIssuanceByIssuerCommand } from './functions/convertibleIssuance';
import { createStockCancellation, buildCreateStockCancellationCommand, getStockCancellationEventAsOcf, archiveStockCancellationByIssuer, buildArchiveStockCancellationByIssuerCommand } from './functions/stockCancellation';
import { createIssuerAuthorizedSharesAdjustment, buildCreateIssuerAuthorizedSharesAdjustmentCommand, getIssuerAuthorizedSharesAdjustmentEventAsOcf, archiveIssuerAuthorizedSharesAdjustmentByIssuer, buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand } from './functions/issuerAuthorizedSharesAdjustment';
import { createStockClassAuthorizedSharesAdjustment, buildCreateStockClassAuthorizedSharesAdjustmentCommand, getStockClassAuthorizedSharesAdjustmentEventAsOcf, archiveStockClassAuthorizedSharesAdjustmentByIssuer, buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand } from './functions/stockClassAuthorizedSharesAdjustment';
import { createStockPlanPoolAdjustment, buildCreateStockPlanPoolAdjustmentCommand, getStockPlanPoolAdjustmentEventAsOcf, archiveStockPlanPoolAdjustmentByIssuer, buildArchiveStockPlanPoolAdjustmentByIssuerCommand } from './functions/stockPlanPoolAdjustment';
import { createDocument, buildCreateDocumentCommand, getDocumentAsOcf, archiveDocumentByIssuer, buildArchiveDocumentByIssuerCommand } from './functions/document';
import { withdrawAuthorization } from './functions/issuerAuthorization';
import { createStockIssuance, buildCreateStockIssuanceCommand, getStockIssuanceAsOcf, archiveStockIssuanceByIssuer, buildArchiveStockIssuanceByIssuerCommand } from './functions/stockIssuance';
import { CommandWithDisclosedContracts } from './types';
import { 
  createOcfObjectFactory, 
  buildCreateOcfObjectCommandFactory,
  CreateOcfObjectParams, 
  CreateOcfObjectResult 
} from './utils/createOcfObject';

export class OcpClient {
  public readonly client: LedgerJsonApiClient;

  public issuer: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    createIssuer: (params: CreateIssuerParams) => Promise<CreateIssuerResult>;
    buildCreateIssuerCommand: (params: CreateIssuerParams) => CommandWithDisclosedContracts;
    getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
  };

  public stockClass: {
    createStockClass: (params: CreateStockClassParams) => Promise<CreateStockClassResult>;
    buildCreateStockClassCommand: (params: CreateStockClassParams) => CommandWithDisclosedContracts;
    getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
    archiveStockClassByIssuer: (params: import('./functions').ArchiveStockClassByIssuerParams) => Promise<import('./functions').ArchiveStockClassByIssuerResult>;
    buildArchiveStockClassByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public companyValuationReport: {
    createCompanyValuationReport: (
      params: CreateCompanyValuationReportParams
    ) => Promise<CreateCompanyValuationReportResult>;
    buildCreateCompanyValuationReportCommand: (
      params: CreateCompanyValuationReportParams
    ) => CommandWithDisclosedContracts;
    updateCompanyValuation: (
      params: UpdateCompanyValuationParams
    ) => Promise<UpdateCompanyValuationResult>;
    addObserversToCompanyValuationReport: (
      params: AddObserversToCompanyValuationReportParams
    ) => Promise<AddObserversToCompanyValuationReportResult>;
  };

  public stakeholder: {
    createStakeholder: (params: import('./functions').CreateStakeholderParams) => Promise<import('./functions').CreateStakeholderResult>;
    buildCreateStakeholderCommand: (params: import('./functions').CreateStakeholderParams) => CommandWithDisclosedContracts;
    getStakeholderAsOcf: (params: import('./functions').GetStakeholderAsOcfParams) => Promise<import('./functions').GetStakeholderAsOcfResult>;
    archiveStakeholderByIssuer: (params: import('./functions').ArchiveStakeholderByIssuerParams) => Promise<import('./functions').ArchiveStakeholderByIssuerResult>;
    buildArchiveStakeholderByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockLegendTemplate: {
    createStockLegendTemplate: (params: import('./functions').CreateStockLegendTemplateParams) => Promise<import('./functions').CreateStockLegendTemplateResult>;
    buildCreateStockLegendTemplateCommand: (params: import('./functions').CreateStockLegendTemplateParams) => CommandWithDisclosedContracts;
    getStockLegendTemplateAsOcf: (params: import('./functions').GetStockLegendTemplateAsOcfParams) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
    archiveStockLegendTemplateByIssuer: (params: import('./functions').ArchiveStockLegendTemplateByIssuerParams) => Promise<import('./functions').ArchiveStockLegendTemplateByIssuerResult>;
    buildArchiveStockLegendTemplateByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public valuation: {
    createValuation: (params: import('./functions').CreateValuationParams) => Promise<import('./functions').CreateValuationResult>;
    buildCreateValuationCommand: (params: import('./functions').CreateValuationParams) => CommandWithDisclosedContracts;
    getValuationAsOcf: (params: import('./functions').GetValuationAsOcfParams) => Promise<import('./functions').GetValuationAsOcfResult>;
    archiveValuationByIssuer: (params: import('./functions').ArchiveValuationByIssuerParams) => Promise<import('./functions').ArchiveValuationByIssuerResult>;
    buildArchiveValuationByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public vestingTerms: {
    createVestingTerms: (params: import('./functions').CreateVestingTermsParams) => Promise<import('./functions').CreateVestingTermsResult>;
    buildCreateVestingTermsCommand: (params: import('./functions').CreateVestingTermsParams) => CommandWithDisclosedContracts;
    getVestingTermsAsOcf: (params: import('./functions').GetVestingTermsAsOcfParams) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
    archiveVestingTermsByIssuer: (params: import('./functions').ArchiveVestingTermsByIssuerParams) => Promise<import('./functions').ArchiveVestingTermsByIssuerResult>;
    buildArchiveVestingTermsByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockPlan: {
    createStockPlan: (params: import('./functions').CreateStockPlanParams) => Promise<import('./functions').CreateStockPlanResult>;
    buildCreateStockPlanCommand: (params: import('./functions').CreateStockPlanParams) => CommandWithDisclosedContracts;
    getStockPlanAsOcf: (params: import('./functions').GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    archiveStockPlanByIssuer: (params: import('./functions').ArchiveStockPlanByIssuerParams) => Promise<import('./functions').ArchiveStockPlanByIssuerResult>;
    buildArchiveStockPlanByIssuerCommand: (params: { contractId: string }) => Command;
    getEquityCompensationIssuanceEventAsOcf: (params: import('./functions').GetEquityCompensationIssuanceEventAsOcfParams) => Promise<import('./functions').GetEquityCompensationIssuanceEventAsOcfResult>;
    getEquityCompensationExerciseEventAsOcf: (params: import('./functions').GetEquityCompensationExerciseEventAsOcfParams) => Promise<import('./functions').GetEquityCompensationExerciseEventAsOcfResult>;
    createEquityCompensationIssuance: (params: import('./functions').CreateEquityCompensationIssuanceParams) => Promise<import('./functions').CreateEquityCompensationIssuanceResult>;
    buildCreateEquityCompensationIssuanceCommand: (params: import('./functions').CreateEquityCompensationIssuanceParams) => CommandWithDisclosedContracts;
    createEquityCompensationExercise: (params: import('./functions').CreateEquityCompensationExerciseParams) => Promise<import('./functions').CreateEquityCompensationExerciseResult>;
    buildCreateEquityCompensationExerciseCommand: (params: import('./functions').CreateEquityCompensationExerciseParams) => CommandWithDisclosedContracts;
  };

  public warrantIssuance: {
    createWarrantIssuance: (params: import('./functions').CreateWarrantIssuanceParams) => Promise<import('./functions').CreateWarrantIssuanceResult>;
    buildCreateWarrantIssuanceCommand: (params: import('./functions').CreateWarrantIssuanceParams) => CommandWithDisclosedContracts;
    getWarrantIssuanceAsOcf: (params: import('./functions').GetWarrantIssuanceAsOcfParams) => Promise<import('./functions').GetWarrantIssuanceAsOcfResult>;
    archiveWarrantIssuanceByIssuer: (params: import('./functions').ArchiveWarrantIssuanceByIssuerParams) => Promise<import('./functions').ArchiveWarrantIssuanceByIssuerResult>;
    buildArchiveWarrantIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public convertibleIssuance: {
    createConvertibleIssuance: (params: import('./functions').CreateConvertibleIssuanceParams) => Promise<import('./functions').CreateConvertibleIssuanceResult>;
    buildCreateConvertibleIssuanceCommand: (params: import('./functions').CreateConvertibleIssuanceParams) => CommandWithDisclosedContracts;
    getConvertibleIssuanceAsOcf: (params: import('./functions').GetConvertibleIssuanceAsOcfParams) => Promise<import('./functions').GetConvertibleIssuanceAsOcfResult>;
    archiveConvertibleIssuanceByIssuer: (params: import('./functions').ArchiveConvertibleIssuanceByIssuerParams) => Promise<import('./functions').ArchiveConvertibleIssuanceByIssuerResult>;
    buildArchiveConvertibleIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockCancellation: {
    createStockCancellation: (params: import('./functions').CreateStockCancellationParams) => Promise<import('./functions').CreateStockCancellationResult>;
    buildCreateStockCancellationCommand: (params: import('./functions').CreateStockCancellationParams) => CommandWithDisclosedContracts;
    getStockCancellationEventAsOcf: (params: import('./functions').GetStockCancellationEventAsOcfParams) => Promise<import('./functions').GetStockCancellationEventAsOcfResult>;
    archiveStockCancellationByIssuer: (params: import('./functions').ArchiveStockCancellationByIssuerParams) => Promise<import('./functions').ArchiveStockCancellationByIssuerResult>;
    buildArchiveStockCancellationByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public issuerAuthorizedSharesAdjustment: {
    createIssuerAuthorizedSharesAdjustment: (params: import('./functions').CreateIssuerAuthorizedSharesAdjustmentParams) => Promise<import('./functions').CreateIssuerAuthorizedSharesAdjustmentResult>;
    buildCreateIssuerAuthorizedSharesAdjustmentCommand: (params: import('./functions').CreateIssuerAuthorizedSharesAdjustmentParams) => CommandWithDisclosedContracts;
    getIssuerAuthorizedSharesAdjustmentEventAsOcf: (params: import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
    archiveIssuerAuthorizedSharesAdjustmentByIssuer: (params: import('./functions').ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveIssuerAuthorizedSharesAdjustmentByIssuerResult>;
    buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockClassAuthorizedSharesAdjustment: {
    createStockClassAuthorizedSharesAdjustment: (params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams) => Promise<import('./functions').CreateStockClassAuthorizedSharesAdjustmentResult>;
    buildCreateStockClassAuthorizedSharesAdjustmentCommand: (params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams) => CommandWithDisclosedContracts;
    getStockClassAuthorizedSharesAdjustmentEventAsOcf: (params: import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams) => Promise<import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
    archiveStockClassAuthorizedSharesAdjustmentByIssuer: (params: import('./functions').ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult>;
    buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockPlanPoolAdjustment: {
    createStockPlanPoolAdjustment: (params: import('./functions').CreateStockPlanPoolAdjustmentParams) => Promise<import('./functions').CreateStockPlanPoolAdjustmentResult>;
    buildCreateStockPlanPoolAdjustmentCommand: (params: import('./functions').CreateStockPlanPoolAdjustmentParams) => CommandWithDisclosedContracts;
    getStockPlanPoolAdjustmentEventAsOcf: (params: import('./functions').GetStockPlanPoolAdjustmentEventAsOcfParams) => Promise<import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult>;
    archiveStockPlanPoolAdjustmentByIssuer: (params: import('./functions').ArchiveStockPlanPoolAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveStockPlanPoolAdjustmentByIssuerResult>;
    buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public stockIssuance: {
    createStockIssuance: (params: import('./functions').CreateStockIssuanceParams) => Promise<import('./functions').CreateStockIssuanceResult>;
    buildCreateStockIssuanceCommand: (params: import('./functions').CreateStockIssuanceParams) => CommandWithDisclosedContracts;
    getStockIssuanceAsOcf: (params: import('./functions').GetStockIssuanceAsOcfParams) => Promise<import('./functions').GetStockIssuanceAsOcfResult>;
    archiveStockIssuanceByIssuer: (params: import('./functions').ArchiveStockIssuanceByIssuerParams) => Promise<import('./functions').ArchiveStockIssuanceByIssuerResult>;
    buildArchiveStockIssuanceByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public document: {
    createDocument: (params: import('./functions').CreateDocumentParams) => Promise<import('./functions').CreateDocumentResult>;
    buildCreateDocumentCommand: (params: import('./functions').CreateDocumentParams) => CommandWithDisclosedContracts;
    getDocumentAsOcf: (params: import('./functions').GetDocumentAsOcfParams) => Promise<import('./functions').GetDocumentAsOcfResult>;
    archiveDocumentByIssuer: (params: import('./functions').ArchiveDocumentByIssuerParams) => Promise<import('./functions').ArchiveDocumentByIssuerResult>;
    buildArchiveDocumentByIssuerCommand: (params: { contractId: string }) => Command;
  };

  public issuerAuthorization: {
    withdrawAuthorization: (params: import('./functions').WithdrawAuthorizationParams) => Promise<import('./functions').WithdrawAuthorizationResult>;
  };

  public buildCreateOcfObjectCommand: (params: CreateOcfObjectParams) => CommandWithDisclosedContracts[];
  public createOcfObject: (params: CreateOcfObjectParams) => Promise<CreateOcfObjectResult>;

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      authorizeIssuer: (params: AuthorizeIssuerParams) => authorizeIssuer(this.client, params),
      createIssuer: (params: CreateIssuerParams) => createIssuer(this.client, params),
      buildCreateIssuerCommand: (params: CreateIssuerParams) => buildCreateIssuerCommand(params),
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params)
    };

    this.stockClass = {
      createStockClass: (params: CreateStockClassParams) => createStockClass(this.client, params),
      buildCreateStockClassCommand: (params: CreateStockClassParams) => buildCreateStockClassCommand(params),
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params),
      archiveStockClassByIssuer: (params) => archiveStockClassByIssuer(this.client, params),
      buildArchiveStockClassByIssuerCommand: (params) => buildArchiveStockClassByIssuerCommand(params)
    };

    this.companyValuationReport = {
      createCompanyValuationReport: (params: CreateCompanyValuationReportParams) =>
        createCompanyValuationReport(this.client, params),
      buildCreateCompanyValuationReportCommand: (params: CreateCompanyValuationReportParams) =>
        buildCreateCompanyValuationReportCommand(this.client, params),
      updateCompanyValuation: (params: UpdateCompanyValuationParams) =>
        updateCompanyValuation(this.client, params),
      addObserversToCompanyValuationReport: (
        params: AddObserversToCompanyValuationReportParams
      ) => addObserversToCompanyValuationReport(this.client, params)
    };

    this.stakeholder = {
      createStakeholder: (params) => createStakeholder(this.client, params),
      buildCreateStakeholderCommand: (params) => buildCreateStakeholderCommand(params),
      getStakeholderAsOcf: (params) => getStakeholderAsOcf(this.client, params),
      archiveStakeholderByIssuer: (params) => archiveStakeholderByIssuer(this.client, params),
      buildArchiveStakeholderByIssuerCommand: (params) => buildArchiveStakeholderByIssuerCommand(params)
    };

    this.stockLegendTemplate = {
      createStockLegendTemplate: (params) => createStockLegendTemplate(this.client, params),
      buildCreateStockLegendTemplateCommand: (params) => buildCreateStockLegendTemplateCommand(params),
      getStockLegendTemplateAsOcf: (params) => getStockLegendTemplateAsOcf(this.client, params),
      archiveStockLegendTemplateByIssuer: (params) => archiveStockLegendTemplateByIssuer(this.client, params),
      buildArchiveStockLegendTemplateByIssuerCommand: (params) => buildArchiveStockLegendTemplateByIssuerCommand(params)
    };

    this.valuation = {
      createValuation: (params) => createValuation(this.client, params),
      buildCreateValuationCommand: (params) => buildCreateValuationCommand(params),
      getValuationAsOcf: (params) => getValuationAsOcf(this.client, params),
      archiveValuationByIssuer: (params) => archiveValuationByIssuer(this.client, params),
      buildArchiveValuationByIssuerCommand: (params) => buildArchiveValuationByIssuerCommand(params)
    };

    this.vestingTerms = {
      createVestingTerms: (params) => createVestingTerms(this.client, params),
      buildCreateVestingTermsCommand: (params) => buildCreateVestingTermsCommand(params),
      getVestingTermsAsOcf: (params) => getVestingTermsAsOcf(this.client, params),
      archiveVestingTermsByIssuer: (params) => archiveVestingTermsByIssuer(this.client, params),
      buildArchiveVestingTermsByIssuerCommand: (params) => buildArchiveVestingTermsByIssuerCommand(params)
    };

    this.stockPlan = {
      createStockPlan: (params) => createStockPlan(this.client, params),
      buildCreateStockPlanCommand: (params) => buildCreateStockPlanCommand(params),
      getStockPlanAsOcf: (params) => getStockPlanAsOcf(this.client, params),
      archiveStockPlanByIssuer: (params) => archiveStockPlanByIssuer(this.client, params),
      buildArchiveStockPlanByIssuerCommand: (params) => buildArchiveStockPlanByIssuerCommand(params),
      getEquityCompensationIssuanceEventAsOcf: (params) => getEquityCompensationIssuanceEventAsOcf(this.client, params),
      getEquityCompensationExerciseEventAsOcf: (params) => getEquityCompensationExerciseEventAsOcf(this.client, params),
      createEquityCompensationIssuance: (params) => createEquityCompensationIssuance(this.client, params),
      buildCreateEquityCompensationIssuanceCommand: (params) => buildCreateEquityCompensationIssuanceCommand(params),
      createEquityCompensationExercise: (params) => createEquityCompensationExercise(this.client, params),
      buildCreateEquityCompensationExerciseCommand: (params) => buildCreateEquityCompensationExerciseCommand(params)
    };

    this.warrantIssuance = {
      createWarrantIssuance: (params) => createWarrantIssuance(this.client, params),
      buildCreateWarrantIssuanceCommand: (params) => buildCreateWarrantIssuanceCommand(params),
      getWarrantIssuanceAsOcf: (params) => getWarrantIssuanceAsOcf(this.client, params),
      archiveWarrantIssuanceByIssuer: (params) => archiveWarrantIssuanceByIssuer(this.client, params),
      buildArchiveWarrantIssuanceByIssuerCommand: (params) => buildArchiveWarrantIssuanceByIssuerCommand(params)
    };

    this.convertibleIssuance = {
      createConvertibleIssuance: (params) => createConvertibleIssuance(this.client, params),
      buildCreateConvertibleIssuanceCommand: (params) => buildCreateConvertibleIssuanceCommand(params),
      getConvertibleIssuanceAsOcf: (params) => getConvertibleIssuanceAsOcf(this.client, params),
      archiveConvertibleIssuanceByIssuer: (params) => archiveConvertibleIssuanceByIssuer(this.client, params),
      buildArchiveConvertibleIssuanceByIssuerCommand: (params) => buildArchiveConvertibleIssuanceByIssuerCommand(params)
    };

    this.stockCancellation = {
      createStockCancellation: (params) => createStockCancellation(this.client, params),
      buildCreateStockCancellationCommand: (params) => buildCreateStockCancellationCommand(params),
      getStockCancellationEventAsOcf: (params) => getStockCancellationEventAsOcf(this.client, params),
      archiveStockCancellationByIssuer: (params) => archiveStockCancellationByIssuer(this.client, params),
      buildArchiveStockCancellationByIssuerCommand: (params) => buildArchiveStockCancellationByIssuerCommand(params)
    };

    this.issuerAuthorizedSharesAdjustment = {
      createIssuerAuthorizedSharesAdjustment: (params) => createIssuerAuthorizedSharesAdjustment(this.client, params),
      buildCreateIssuerAuthorizedSharesAdjustmentCommand: (params) => buildCreateIssuerAuthorizedSharesAdjustmentCommand(params),
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: (params) => getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      archiveIssuerAuthorizedSharesAdjustmentByIssuer: (params) => archiveIssuerAuthorizedSharesAdjustmentByIssuer(this.client, params),
      buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand: (params) => buildArchiveIssuerAuthorizedSharesAdjustmentByIssuerCommand(params)
    };

    this.stockClassAuthorizedSharesAdjustment = {
      createStockClassAuthorizedSharesAdjustment: (params) => createStockClassAuthorizedSharesAdjustment(this.client, params),
      buildCreateStockClassAuthorizedSharesAdjustmentCommand: (params) => buildCreateStockClassAuthorizedSharesAdjustmentCommand(params),
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: (params) => getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params),
      archiveStockClassAuthorizedSharesAdjustmentByIssuer: (params) => archiveStockClassAuthorizedSharesAdjustmentByIssuer(this.client, params),
      buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand: (params) => buildArchiveStockClassAuthorizedSharesAdjustmentByIssuerCommand(params)
    };

    this.stockPlanPoolAdjustment = {
      createStockPlanPoolAdjustment: (params) => createStockPlanPoolAdjustment(this.client, params),
      buildCreateStockPlanPoolAdjustmentCommand: (params) => buildCreateStockPlanPoolAdjustmentCommand(params),
      getStockPlanPoolAdjustmentEventAsOcf: (params) => getStockPlanPoolAdjustmentEventAsOcf(this.client, params),
      archiveStockPlanPoolAdjustmentByIssuer: (params) => archiveStockPlanPoolAdjustmentByIssuer(this.client, params),
      buildArchiveStockPlanPoolAdjustmentByIssuerCommand: (params) => buildArchiveStockPlanPoolAdjustmentByIssuerCommand(params)
    };

    this.document = {
      createDocument: (params) => createDocument(this.client, params),
      buildCreateDocumentCommand: (params) => buildCreateDocumentCommand(params),
      getDocumentAsOcf: (params) => getDocumentAsOcf(this.client, params),
      archiveDocumentByIssuer: (params) => archiveDocumentByIssuer(this.client, params),
      buildArchiveDocumentByIssuerCommand: (params) => buildArchiveDocumentByIssuerCommand(params)
    };

    this.issuerAuthorization = {
      withdrawAuthorization: (params) => withdrawAuthorization(this.client, params)
    };

    this.stockIssuance = {
      createStockIssuance: (params) => createStockIssuance(this.client, params),
      buildCreateStockIssuanceCommand: (params) => buildCreateStockIssuanceCommand(params),
      getStockIssuanceAsOcf: (params) => getStockIssuanceAsOcf(this.client, params),
      archiveStockIssuanceByIssuer: (params) => archiveStockIssuanceByIssuer(this.client, params),
      buildArchiveStockIssuanceByIssuerCommand: (params) => buildArchiveStockIssuanceByIssuerCommand(params)
    };

    this.buildCreateOcfObjectCommand = buildCreateOcfObjectCommandFactory(this);
    this.createOcfObject = createOcfObjectFactory(this);
  }

  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
