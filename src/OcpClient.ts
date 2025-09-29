import { ClientConfig, LedgerJsonApiClient, TransactionBatch } from '@fairmint/canton-node-sdk';
import {
  authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult,
  createIssuer, CreateIssuerParams, CreateIssuerResult,
  getIssuerAsOcf, GetIssuerAsOcfParams, GetIssuerAsOcfResult,
  createStockClass, CreateStockClassParams, CreateStockClassResult,
  getStockClassAsOcf, GetStockClassAsOcfParams, GetStockClassAsOcfResult,
  createCompanyValuationReport, CreateCompanyValuationReportParams, CreateCompanyValuationReportResult,
  updateCompanyValuation, UpdateCompanyValuationParams, UpdateCompanyValuationResult,
  addObserversToCompanyValuationReport, AddObserversToCompanyValuationReportParams, AddObserversToCompanyValuationReportResult
} from './functions';

export class OcpClient {
  private client: LedgerJsonApiClient;

  public issuer: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    createIssuer: (params: CreateIssuerParams) => Promise<CreateIssuerResult>;
    getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
  };

  public stockClass: {
    createStockClass: (params: CreateStockClassParams) => Promise<CreateStockClassResult>;
    getStockClassAsOcf: (params: GetStockClassAsOcfParams) => Promise<GetStockClassAsOcfResult>;
    archiveStockClassByIssuer: (params: import('./functions').ArchiveStockClassByIssuerParams) => Promise<import('./functions').ArchiveStockClassByIssuerResult>;
  };

  public companyValuationReport: {
    createCompanyValuationReport: (
      params: CreateCompanyValuationReportParams
    ) => Promise<CreateCompanyValuationReportResult>;
    updateCompanyValuation: (
      params: UpdateCompanyValuationParams
    ) => Promise<UpdateCompanyValuationResult>;
    addObserversToCompanyValuationReport: (
      params: AddObserversToCompanyValuationReportParams
    ) => Promise<AddObserversToCompanyValuationReportResult>;
  };

  public stakeholder: {
    createStakeholder: (params: import('./functions').CreateStakeholderParams) => Promise<import('./functions').CreateStakeholderResult>;
    getStakeholderAsOcf: (params: import('./functions').GetStakeholderAsOcfParams) => Promise<import('./functions').GetStakeholderAsOcfResult>;
    archiveStakeholderByIssuer: (params: import('./functions').ArchiveStakeholderByIssuerParams) => Promise<import('./functions').ArchiveStakeholderByIssuerResult>;
  };

  public stockLegendTemplate: {
    createStockLegendTemplate: (params: import('./functions').CreateStockLegendTemplateParams) => Promise<import('./functions').CreateStockLegendTemplateResult>;
    getStockLegendTemplateAsOcf: (params: import('./functions').GetStockLegendTemplateAsOcfParams) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
    archiveStockLegendTemplateByIssuer: (params: import('./functions').ArchiveStockLegendTemplateByIssuerParams) => Promise<import('./functions').ArchiveStockLegendTemplateByIssuerResult>;
  };

  public valuation: {
    createValuation: (params: import('./functions').CreateValuationParams) => Promise<import('./functions').CreateValuationResult>;
    getValuationAsOcf: (params: import('./functions').GetValuationAsOcfParams) => Promise<import('./functions').GetValuationAsOcfResult>;
    archiveValuationByIssuer: (params: import('./functions').ArchiveValuationByIssuerParams) => Promise<import('./functions').ArchiveValuationByIssuerResult>;
  };

  public vestingTerms: {
    createVestingTerms: (params: import('./functions').CreateVestingTermsParams) => Promise<import('./functions').CreateVestingTermsResult>;
    getVestingTermsAsOcf: (params: import('./functions').GetVestingTermsAsOcfParams) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
    archiveVestingTermsByIssuer: (params: import('./functions').ArchiveVestingTermsByIssuerParams) => Promise<import('./functions').ArchiveVestingTermsByIssuerResult>;
  };

  public stockPlan: {
    createStockPlan: (params: import('./functions').CreateStockPlanParams) => Promise<import('./functions').CreateStockPlanResult>;
    getStockPlanAsOcf: (params: import('./functions').GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    archiveStockPlanByIssuer: (params: import('./functions').ArchiveStockPlanByIssuerParams) => Promise<import('./functions').ArchiveStockPlanByIssuerResult>;
    getEquityCompensationIssuanceEventAsOcf: (params: import('./functions').GetEquityCompensationIssuanceEventAsOcfParams) => Promise<import('./functions').GetEquityCompensationIssuanceEventAsOcfResult>;
    getEquityCompensationExerciseEventAsOcf: (params: import('./functions').GetEquityCompensationExerciseEventAsOcfParams) => Promise<import('./functions').GetEquityCompensationExerciseEventAsOcfResult>;
    createEquityCompensationIssuance: (params: import('./functions').CreateEquityCompensationIssuanceParams) => Promise<import('./functions').CreateEquityCompensationIssuanceResult>;
    createEquityCompensationExercise: (params: import('./functions').CreateEquityCompensationExerciseParams) => Promise<import('./functions').CreateEquityCompensationExerciseResult>;
  };

  public warrantIssuance: {
    createWarrantIssuance: (params: import('./functions').CreateWarrantIssuanceParams) => Promise<import('./functions').CreateWarrantIssuanceResult>;
    getWarrantIssuanceAsOcf: (params: import('./functions').GetWarrantIssuanceAsOcfParams) => Promise<import('./functions').GetWarrantIssuanceAsOcfResult>;
    archiveWarrantIssuanceByIssuer: (params: import('./functions').ArchiveWarrantIssuanceByIssuerParams) => Promise<import('./functions').ArchiveWarrantIssuanceByIssuerResult>;
  };

  public convertibleIssuance: {
    createConvertibleIssuance: (params: import('./functions').CreateConvertibleIssuanceParams) => Promise<import('./functions').CreateConvertibleIssuanceResult>;
    getConvertibleIssuanceAsOcf: (params: import('./functions').GetConvertibleIssuanceAsOcfParams) => Promise<import('./functions').GetConvertibleIssuanceAsOcfResult>;
    archiveConvertibleIssuanceByIssuer: (params: import('./functions').ArchiveConvertibleIssuanceByIssuerParams) => Promise<import('./functions').ArchiveConvertibleIssuanceByIssuerResult>;
  };

  public stockCancellation: {
    createStockCancellation: (params: import('./functions').CreateStockCancellationParams) => Promise<import('./functions').CreateStockCancellationResult>;
    getStockCancellationEventAsOcf: (params: import('./functions').GetStockCancellationEventAsOcfParams) => Promise<import('./functions').GetStockCancellationEventAsOcfResult>;
    archiveStockCancellationByIssuer: (params: import('./functions').ArchiveStockCancellationByIssuerParams) => Promise<import('./functions').ArchiveStockCancellationByIssuerResult>;
  };

  public issuerAuthorizedSharesAdjustment: {
    createIssuerAuthorizedSharesAdjustment: (params: import('./functions').CreateIssuerAuthorizedSharesAdjustmentParams) => Promise<import('./functions').CreateIssuerAuthorizedSharesAdjustmentResult>;
    getIssuerAuthorizedSharesAdjustmentEventAsOcf: (params: import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfParams) => Promise<import('./functions').GetIssuerAuthorizedSharesAdjustmentEventAsOcfResult>;
    archiveIssuerAuthorizedSharesAdjustmentByIssuer: (params: import('./functions').ArchiveIssuerAuthorizedSharesAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveIssuerAuthorizedSharesAdjustmentByIssuerResult>;
  };

  public stockClassAuthorizedSharesAdjustment: {
    createStockClassAuthorizedSharesAdjustment: (params: import('./functions').CreateStockClassAuthorizedSharesAdjustmentParams) => Promise<import('./functions').CreateStockClassAuthorizedSharesAdjustmentResult>;
    getStockClassAuthorizedSharesAdjustmentEventAsOcf: (params: import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfParams) => Promise<import('./functions').GetStockClassAuthorizedSharesAdjustmentEventAsOcfResult>;
    archiveStockClassAuthorizedSharesAdjustmentByIssuer: (params: import('./functions').ArchiveStockClassAuthorizedSharesAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveStockClassAuthorizedSharesAdjustmentByIssuerResult>;
  };

  public stockPlanPoolAdjustment: {
    createStockPlanPoolAdjustment: (params: import('./functions').CreateStockPlanPoolAdjustmentParams) => Promise<import('./functions').CreateStockPlanPoolAdjustmentResult>;
    getStockPlanPoolAdjustmentEventAsOcf: (params: import('./functions').GetStockPlanPoolAdjustmentEventAsOcfParams) => Promise<import('./functions').GetStockPlanPoolAdjustmentEventAsOcfResult>;
    archiveStockPlanPoolAdjustmentByIssuer: (params: import('./functions').ArchiveStockPlanPoolAdjustmentByIssuerParams) => Promise<import('./functions').ArchiveStockPlanPoolAdjustmentByIssuerResult>;
  };

  public stockIssuance: {
    createStockIssuance: (params: import('./functions').CreateStockIssuanceParams) => Promise<import('./functions').CreateStockIssuanceResult>;
    getStockIssuanceAsOcf: (params: import('./functions').GetStockIssuanceAsOcfParams) => Promise<import('./functions').GetStockIssuanceAsOcfResult>;
    archiveStockIssuanceByIssuer: (params: import('./functions').ArchiveStockIssuanceByIssuerParams) => Promise<import('./functions').ArchiveStockIssuanceByIssuerResult>;
  };

  public document: {
    createDocument: (params: import('./functions').CreateDocumentParams) => Promise<import('./functions').CreateDocumentResult>;
    getDocumentAsOcf: (params: import('./functions').GetDocumentAsOcfParams) => Promise<import('./functions').GetDocumentAsOcfResult>;
    archiveDocumentByIssuer: (params: import('./functions').ArchiveDocumentByIssuerParams) => Promise<import('./functions').ArchiveDocumentByIssuerResult>;
  };

  public issuerAuthorization: {
    withdrawAuthorization: (params: import('./functions').WithdrawAuthorizationParams) => Promise<import('./functions').WithdrawAuthorizationResult>;
  };

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      authorizeIssuer: (params: AuthorizeIssuerParams) => authorizeIssuer(this.client, params),
      createIssuer: (params: CreateIssuerParams) => createIssuer(this.client, params),
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params)
    };

    this.stockClass = {
      createStockClass: (params: CreateStockClassParams) => createStockClass(this.client, params),
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params),
      archiveStockClassByIssuer: (params) => { const { archiveStockClassByIssuer } = require('./functions/stockClass'); return archiveStockClassByIssuer(this.client, params); }
    };

    this.companyValuationReport = {
      createCompanyValuationReport: (params: CreateCompanyValuationReportParams) =>
        createCompanyValuationReport(this.client, params),
      updateCompanyValuation: (params: UpdateCompanyValuationParams) =>
        updateCompanyValuation(this.client, params),
      addObserversToCompanyValuationReport: (
        params: AddObserversToCompanyValuationReportParams
      ) => addObserversToCompanyValuationReport(this.client, params)
    };

    this.stakeholder = {
      createStakeholder: (params) => {
        const { createStakeholder } = require('./functions/stakeholder');
        return createStakeholder(this.client, params);
      },
      getStakeholderAsOcf: (params) => {
        const { getStakeholderAsOcf } = require('./functions/stakeholder');
        return getStakeholderAsOcf(this.client, params);
      },
      archiveStakeholderByIssuer: (params) => {
        const { archiveStakeholderByIssuer } = require('./functions/stakeholder');
        return archiveStakeholderByIssuer(this.client, params);
      }
    };

    this.stockLegendTemplate = {
      createStockLegendTemplate: (params) => {
        const { createStockLegendTemplate } = require('./functions/stockLegendTemplate');
        return createStockLegendTemplate(this.client, params);
      },
      getStockLegendTemplateAsOcf: (params) => {
        const { getStockLegendTemplateAsOcf } = require('./functions/stockLegendTemplate');
        return getStockLegendTemplateAsOcf(this.client, params);
      },
      archiveStockLegendTemplateByIssuer: (params) => {
        const { archiveStockLegendTemplateByIssuer } = require('./functions/stockLegendTemplate');
        return archiveStockLegendTemplateByIssuer(this.client, params);
      }
    };

    this.valuation = {
      createValuation: (params) => {
        const { createValuation } = require('./functions/issuer');
        return createValuation(this.client, params);
      },
      getValuationAsOcf: (params) => {
        const { getValuationAsOcf } = require('./functions/valuation');
        return getValuationAsOcf(this.client, params);
      },
      archiveValuationByIssuer: (params) => {
        const { archiveValuationByIssuer } = require('./functions/valuation');
        return archiveValuationByIssuer(this.client, params);
      }
    };

    this.vestingTerms = {
      createVestingTerms: (params) => {
        const { createVestingTerms } = require('./functions/vestingTerms');
        return createVestingTerms(this.client, params);
      },
      getVestingTermsAsOcf: (params) => {
        const { getVestingTermsAsOcf } = require('./functions/vestingTerms');
        return getVestingTermsAsOcf(this.client, params);
      },
      archiveVestingTermsByIssuer: (params) => {
        const { archiveVestingTermsByIssuer } = require('./functions/vestingTerms');
        return archiveVestingTermsByIssuer(this.client, params);
      }
    };

    this.stockPlan = {
      createStockPlan: (params) => { const { createStockPlan } = require('./functions/stockPlan'); return createStockPlan(this.client, params); },
      getStockPlanAsOcf: (params) => { const { getStockPlanAsOcf } = require('./functions/stockPlan'); return getStockPlanAsOcf(this.client, params); },
      archiveStockPlanByIssuer: (params) => { const { archiveStockPlanByIssuer } = require('./functions/stockPlan'); return archiveStockPlanByIssuer(this.client, params); },
      getEquityCompensationIssuanceEventAsOcf: (params) => { const { getEquityCompensationIssuanceEventAsOcf } = require('./functions/stockPlan'); return getEquityCompensationIssuanceEventAsOcf(this.client, params); },
      getEquityCompensationExerciseEventAsOcf: (params) => { const { getEquityCompensationExerciseEventAsOcf } = require('./functions/stockPlan'); return getEquityCompensationExerciseEventAsOcf(this.client, params); },
      createEquityCompensationIssuance: (params) => { const { createEquityCompensationIssuance } = require('./functions/stockPlan'); return createEquityCompensationIssuance(this.client, params); },
      createEquityCompensationExercise: (params) => { const { createEquityCompensationExercise } = require('./functions/stockPlan'); return createEquityCompensationExercise(this.client, params); }
    };

    this.warrantIssuance = {
      createWarrantIssuance: (params) => { const { createWarrantIssuance } = require('./functions/warrantIssuance'); return createWarrantIssuance(this.client, params); },
      getWarrantIssuanceAsOcf: (params) => { const { getWarrantIssuanceAsOcf } = require('./functions/warrantIssuance'); return getWarrantIssuanceAsOcf(this.client, params); },
      archiveWarrantIssuanceByIssuer: (params) => { const { archiveWarrantIssuanceByIssuer } = require('./functions/warrantIssuance'); return archiveWarrantIssuanceByIssuer(this.client, params); }
    };

    this.convertibleIssuance = {
      createConvertibleIssuance: (params) => { const { createConvertibleIssuance } = require('./functions/convertibleIssuance'); return createConvertibleIssuance(this.client, params); },
      getConvertibleIssuanceAsOcf: (params) => { const { getConvertibleIssuanceAsOcf } = require('./functions/convertibleIssuance'); return getConvertibleIssuanceAsOcf(this.client, params); },
      archiveConvertibleIssuanceByIssuer: (params) => { const { archiveConvertibleIssuanceByIssuer } = require('./functions/convertibleIssuance'); return archiveConvertibleIssuanceByIssuer(this.client, params); }
    };

    this.stockCancellation = {
      createStockCancellation: (params) => { const { createStockCancellation } = require('./functions/stockCancellation'); return createStockCancellation(this.client, params); },
      getStockCancellationEventAsOcf: (params) => { const { getStockCancellationEventAsOcf } = require('./functions/stockCancellation'); return getStockCancellationEventAsOcf(this.client, params); },
      archiveStockCancellationByIssuer: (params) => { const { archiveStockCancellationByIssuer } = require('./functions/stockCancellation'); return archiveStockCancellationByIssuer(this.client, params); }
    };

    this.issuerAuthorizedSharesAdjustment = {
      createIssuerAuthorizedSharesAdjustment: (params) => { const { createIssuerAuthorizedSharesAdjustment } = require('./functions/issuerAuthorizedSharesAdjustment'); return createIssuerAuthorizedSharesAdjustment(this.client, params); },
      getIssuerAuthorizedSharesAdjustmentEventAsOcf: (params) => { const { getIssuerAuthorizedSharesAdjustmentEventAsOcf } = require('./functions/issuerAuthorizedSharesAdjustment'); return getIssuerAuthorizedSharesAdjustmentEventAsOcf(this.client, params); },
      archiveIssuerAuthorizedSharesAdjustmentByIssuer: (params) => { const { archiveIssuerAuthorizedSharesAdjustmentByIssuer } = require('./functions/issuerAuthorizedSharesAdjustment'); return archiveIssuerAuthorizedSharesAdjustmentByIssuer(this.client, params); }
    };

    this.stockClassAuthorizedSharesAdjustment = {
      createStockClassAuthorizedSharesAdjustment: (params) => { const { createStockClassAuthorizedSharesAdjustment } = require('./functions/stockClassAuthorizedSharesAdjustment'); return createStockClassAuthorizedSharesAdjustment(this.client, params); },
      getStockClassAuthorizedSharesAdjustmentEventAsOcf: (params) => { const { getStockClassAuthorizedSharesAdjustmentEventAsOcf } = require('./functions/stockClassAuthorizedSharesAdjustment'); return getStockClassAuthorizedSharesAdjustmentEventAsOcf(this.client, params); },
      archiveStockClassAuthorizedSharesAdjustmentByIssuer: (params) => { const { archiveStockClassAuthorizedSharesAdjustmentByIssuer } = require('./functions/stockClassAuthorizedSharesAdjustment'); return archiveStockClassAuthorizedSharesAdjustmentByIssuer(this.client, params); }
    };

    this.stockPlanPoolAdjustment = {
      createStockPlanPoolAdjustment: (params) => { const { createStockPlanPoolAdjustment } = require('./functions/stockPlanPoolAdjustment'); return createStockPlanPoolAdjustment(this.client, params); },
      getStockPlanPoolAdjustmentEventAsOcf: (params) => { const { getStockPlanPoolAdjustmentEventAsOcf } = require('./functions/stockPlanPoolAdjustment'); return getStockPlanPoolAdjustmentEventAsOcf(this.client, params); },
      archiveStockPlanPoolAdjustmentByIssuer: (params) => { const { archiveStockPlanPoolAdjustmentByIssuer } = require('./functions/stockPlanPoolAdjustment'); return archiveStockPlanPoolAdjustmentByIssuer(this.client, params); }
    };

    this.document = {
      createDocument: (params) => { const { createDocument } = require('./functions/document'); return createDocument(this.client, params); },
      getDocumentAsOcf: (params) => { const { getDocumentAsOcf } = require('./functions/document'); return getDocumentAsOcf(this.client, params); },
      archiveDocumentByIssuer: (params) => { const { archiveDocumentByIssuer } = require('./functions/document'); return archiveDocumentByIssuer(this.client, params); }
    };

    this.issuerAuthorization = {
      withdrawAuthorization: (params) => { const { withdrawAuthorization } = require('./functions/issuerAuthorization'); return withdrawAuthorization(this.client, params); }
    };

    this.stockIssuance = {
      createStockIssuance: (params) => { const { createStockIssuance } = require('./functions/stockIssuance'); return createStockIssuance(this.client, params); },
      getStockIssuanceAsOcf: (params) => { const { getStockIssuanceAsOcf } = require('./functions/stockIssuance'); return getStockIssuanceAsOcf(this.client, params); },
      archiveStockIssuanceByIssuer: (params) => { const { archiveStockIssuanceByIssuer } = require('./functions/stockIssuance'); return archiveStockIssuanceByIssuer(this.client, params); }
    };
  }

  public createBatch(params: { actAs: string[]; readAs?: string[] }): TransactionBatch {
    return new TransactionBatch(this.client, params.actAs, params.readAs);
  }
}
