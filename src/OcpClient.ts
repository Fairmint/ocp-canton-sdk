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
  }
} 