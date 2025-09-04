import { ClientConfig, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
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
  };

  public stockLegendTemplate: {
    createStockLegendTemplate: (params: import('./functions').CreateStockLegendTemplateParams) => Promise<import('./functions').CreateStockLegendTemplateResult>;
    getStockLegendTemplateAsOcf: (params: import('./functions').GetStockLegendTemplateAsOcfParams) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
  };

  public valuation: {
    createValuation: (params: import('./functions').CreateValuationParams) => Promise<import('./functions').CreateValuationResult>;
    getValuationAsOcf: (params: import('./functions').GetValuationAsOcfParams) => Promise<import('./functions').GetValuationAsOcfResult>;
  };

  public vestingTerms: {
    createVestingTerms: (params: import('./functions').CreateVestingTermsParams) => Promise<import('./functions').CreateVestingTermsResult>;
    getVestingTermsAsOcf: (params: import('./functions').GetVestingTermsAsOcfParams) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
  };

  public stockPlan: {
    createStockPlan: (params: import('./functions').CreateStockPlanParams) => Promise<import('./functions').CreateStockPlanResult>;
    getStockPlanAsOcf: (params: import('./functions').GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
  };

  public stockPosition: {};

  public convertible: {};

  public warrant: {};

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
      getStockClassAsOcf: (params: GetStockClassAsOcfParams) => getStockClassAsOcf(this.client, params)
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
      }
    };

    this.stockPlan = {
      createStockPlan: (params) => { const { createStockPlan } = require('./functions/stockPlan'); return createStockPlan(this.client, params); },
      getStockPlanAsOcf: (params) => { const { getStockPlanAsOcf } = require('./functions/stockPlan'); return getStockPlanAsOcf(this.client, params); }
    };

    this.stockPosition = {};

    this.convertible = {};

    this.warrant = {};

    this.issuerAuthorization = {
      withdrawAuthorization: (params) => { const { withdrawAuthorization } = require('./functions/issuerAuthorization'); return withdrawAuthorization(this.client, params); }
    };
  }
}
