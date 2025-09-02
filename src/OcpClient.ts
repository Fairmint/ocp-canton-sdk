import { ClientConfig, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import {
  authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult,
  createIssuer, CreateIssuerParams, CreateIssuerResult,
  updateIssuerData, UpdateIssuerDataParams, UpdateIssuerDataResult,
  getIssuerAsOcf, GetIssuerAsOcfParams, GetIssuerAsOcfResult,
  createStockClass, CreateStockClassParams, CreateStockClassResult,
  updateStockClass, UpdateStockClassParams, UpdateStockClassResult,
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
    updateIssuerData: (params: UpdateIssuerDataParams) => Promise<UpdateIssuerDataResult>;
    getIssuerAsOcf: (params: GetIssuerAsOcfParams) => Promise<GetIssuerAsOcfResult>;
  };

  public stockClass: {
    createStockClass: (params: CreateStockClassParams) => Promise<CreateStockClassResult>;
    updateStockClass: (params: UpdateStockClassParams) => Promise<UpdateStockClassResult>;
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
    updateStakeholderData: (params: import('./functions').UpdateStakeholderDataParams) => Promise<import('./functions').UpdateStakeholderDataResult>;
    getStakeholderAsOcf: (params: import('./functions').GetStakeholderAsOcfParams) => Promise<import('./functions').GetStakeholderAsOcfResult>;
  };

  public stockLegendTemplate: {
    createStockLegendTemplate: (params: import('./functions').CreateStockLegendTemplateParams) => Promise<import('./functions').CreateStockLegendTemplateResult>;
    updateStockLegendTemplate: (params: import('./functions').UpdateStockLegendTemplateParams) => Promise<import('./functions').UpdateStockLegendTemplateResult>;
    getStockLegendTemplateAsOcf: (params: import('./functions').GetStockLegendTemplateAsOcfParams) => Promise<import('./functions').GetStockLegendTemplateAsOcfResult>;
  };

  public valuation: {
    createValuation: (params: import('./functions').CreateValuationParams) => Promise<import('./functions').CreateValuationResult>;
    updateValuationData: (params: import('./functions').UpdateValuationDataParams) => Promise<import('./functions').UpdateValuationDataResult>;
    getValuationAsOcf: (params: import('./functions').GetValuationAsOcfParams) => Promise<import('./functions').GetValuationAsOcfResult>;
  };

  public vestingTerms: {
    createVestingTerms: (params: import('./functions').CreateVestingTermsParams) => Promise<import('./functions').CreateVestingTermsResult>;
    updateVestingTerms: (params: import('./functions').UpdateVestingTermsParams) => Promise<import('./functions').UpdateVestingTermsResult>;
    getVestingTermsAsOcf: (params: import('./functions').GetVestingTermsAsOcfParams) => Promise<import('./functions').GetVestingTermsAsOcfResult>;
  };

  public stockPlan: {
    createStockPlan: (params: import('./functions').CreateStockPlanParams) => Promise<import('./functions').CreateStockPlanResult>;
    updateStockPlan: (params: import('./functions').UpdateStockPlanParams) => Promise<import('./functions').UpdateStockPlanResult>;
    getStockPlanAsOcf: (params: import('./functions').GetStockPlanAsOcfParams) => Promise<import('./functions').GetStockPlanAsOcfResult>;
    issuePlanSecurity: (params: import('./functions').IssuePlanSecurityParams) => Promise<import('./functions').IssuePlanSecurityResult>;
    acceptGrant: (params: import('./functions').AcceptGrantParams) => Promise<import('./functions').AcceptGrantResult>;
    cancelGrant: (params: import('./functions').CancelGrantParams) => Promise<import('./functions').CancelGrantResult>;
    releaseGrant: (params: import('./functions').ReleaseGrantParams) => Promise<import('./functions').ReleaseGrantResult>;
    retractGrant: (params: import('./functions').RetractGrantParams) => Promise<import('./functions').RetractGrantResult>;
    startVesting: (params: import('./functions').StartVestingParams) => Promise<import('./functions').StartVestingResult>;
    exerciseGrant: (params: import('./functions').ExerciseGrantParams) => Promise<import('./functions').ExerciseGrantResult>;
  };

  public stockPosition: {
    proposeTransfer: (params: import('./functions').ProposeTransferParams) => Promise<import('./functions').ProposeTransferResult>;
    acceptTransfer: (params: import('./functions').AcceptTransferParams) => Promise<import('./functions').AcceptTransferResult>;
    retractTransfer: (params: import('./functions').RetractTransferParams) => Promise<import('./functions').RetractTransferResult>;
    reduceQuantity: (params: import('./functions').ReduceQuantityParams) => Promise<import('./functions').ReduceQuantityResult>;
  };

  public convertible: {
    issueConvertible: (params: import('./functions').IssueConvertibleParams) => Promise<import('./functions').IssueConvertibleResult>;
    convertConvertible: (params: import('./functions').ConvertConvertibleParams) => Promise<import('./functions').ConvertConvertibleResult>;
    getConvertibleConversionEventAsOcf: (params: import('./functions').GetConvertibleConversionEventAsOcfParams) => Promise<import('./functions').GetConvertibleConversionEventAsOcfResult>;
    getConvertibleAsOcf: (params: import('./functions').GetConvertibleAsOcfParams) => Promise<import('./functions').GetConvertibleAsOcfResult>;
  };

  public warrant: {
    issueWarrant: (params: import('./functions').IssueWarrantParams) => Promise<import('./functions').IssueWarrantResult>;
    exerciseWarrant: (params: import('./functions').ExerciseWarrantParams) => Promise<import('./functions').ExerciseWarrantResult>;
    getWarrantExerciseEventAsOcf: (params: import('./functions').GetWarrantExerciseEventAsOcfParams) => Promise<import('./functions').GetWarrantExerciseEventAsOcfResult>;
    getWarrantAsOcf: (params: import('./functions').GetWarrantAsOcfParams) => Promise<import('./functions').GetWarrantAsOcfResult>;
  };

  public issuerAuthorization: {
    withdrawAuthorization: (params: import('./functions').WithdrawAuthorizationParams) => Promise<import('./functions').WithdrawAuthorizationResult>;
  };

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      authorizeIssuer: (params: AuthorizeIssuerParams) => authorizeIssuer(this.client, params),
      createIssuer: (params: CreateIssuerParams) => createIssuer(this.client, params),
      updateIssuerData: (params: UpdateIssuerDataParams) => updateIssuerData(this.client, params),
      getIssuerAsOcf: (params: GetIssuerAsOcfParams) => getIssuerAsOcf(this.client, params)
    };

    this.stockClass = {
      createStockClass: (params: CreateStockClassParams) => createStockClass(this.client, params),
      updateStockClass: (params: UpdateStockClassParams) => updateStockClass(this.client, params),
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
      updateStakeholderData: (params) => {
        const { updateStakeholderData } = require('./functions/stakeholder');
        return updateStakeholderData(this.client, params);
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
      updateStockLegendTemplate: (params) => {
        const { updateStockLegendTemplate } = require('./functions/stockLegendTemplate');
        return updateStockLegendTemplate(this.client, params);
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
      updateValuationData: (params) => {
        const { updateValuationData } = require('./functions/valuation');
        return updateValuationData(this.client, params);
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
      updateVestingTerms: (params) => {
        const { updateVestingTerms } = require('./functions/vestingTerms');
        return updateVestingTerms(this.client, params);
      },
      getVestingTermsAsOcf: (params) => {
        const { getVestingTermsAsOcf } = require('./functions/vestingTerms');
        return getVestingTermsAsOcf(this.client, params);
      }
    };

    this.stockPlan = {
      createStockPlan: (params) => { const { createStockPlan } = require('./functions/stockPlan'); return createStockPlan(this.client, params); },
      updateStockPlan: (params) => { const { updateStockPlan } = require('./functions/stockPlan'); return updateStockPlan(this.client, params); },
      getStockPlanAsOcf: (params) => { const { getStockPlanAsOcf } = require('./functions/stockPlan'); return getStockPlanAsOcf(this.client, params); },
      issuePlanSecurity: (params) => { const { issuePlanSecurity } = require('./functions/stockPlan'); return issuePlanSecurity(this.client, params); },
      acceptGrant: (params) => { const { acceptGrant } = require('./functions/stockPlan'); return acceptGrant(this.client, params); },
      cancelGrant: (params) => { const { cancelGrant } = require('./functions/stockPlan'); return cancelGrant(this.client, params); },
      releaseGrant: (params) => { const { releaseGrant } = require('./functions/stockPlan'); return releaseGrant(this.client, params); },
      retractGrant: (params) => { const { retractGrant } = require('./functions/stockPlan'); return retractGrant(this.client, params); },
      startVesting: (params) => { const { startVesting } = require('./functions/stockPlan'); return startVesting(this.client, params); },
      exerciseGrant: (params) => { const { exerciseGrant } = require('./functions/stockPlan'); return exerciseGrant(this.client, params); }
    };

    this.stockPosition = {
      proposeTransfer: (params) => { const { proposeTransfer } = require('./functions/stockPosition'); return proposeTransfer(this.client, params); },
      acceptTransfer: (params) => { const { acceptTransfer } = require('./functions/stockPosition'); return acceptTransfer(this.client, params); },
      retractTransfer: (params) => { const { retractTransfer } = require('./functions/stockPosition'); return retractTransfer(this.client, params); },
      reduceQuantity: (params) => { const { reduceQuantity } = require('./functions/stockPosition'); return reduceQuantity(this.client, params); }
    };

    this.convertible = {
      issueConvertible: (params) => { const { issueConvertible } = require('./functions/convertible'); return issueConvertible(this.client, params); },
      convertConvertible: (params) => { const { convertConvertible } = require('./functions/convertible'); return convertConvertible(this.client, params); },
      getConvertibleConversionEventAsOcf: (params) => { const { getConvertibleConversionEventAsOcf } = require('./functions/convertible'); return getConvertibleConversionEventAsOcf(this.client, params); },
      getConvertibleAsOcf: (params) => { const { getConvertibleAsOcf } = require('./functions/convertible'); return getConvertibleAsOcf(this.client, params); }
    };

    this.warrant = {
      issueWarrant: (params) => { const { issueWarrant } = require('./functions/warrant'); return issueWarrant(this.client, params); },
      exerciseWarrant: (params) => { const { exerciseWarrant } = require('./functions/warrant'); return exerciseWarrant(this.client, params); },
      getWarrantExerciseEventAsOcf: (params) => { const { getWarrantExerciseEventAsOcf } = require('./functions/warrant'); return getWarrantExerciseEventAsOcf(this.client, params); },
      getWarrantAsOcf: (params) => { const { getWarrantAsOcf } = require('./functions/warrant'); return getWarrantAsOcf(this.client, params); }
    };

    this.issuerAuthorization = {
      withdrawAuthorization: (params) => { const { withdrawAuthorization } = require('./functions/issuerAuthorization'); return withdrawAuthorization(this.client, params); }
    };
  }
}
