import { ClientConfig, LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { authorizeIssuer, AuthorizeIssuerParams, AuthorizeIssuerResult } from './functions/issuer/authorizeIssuer';
import { createIssuer, CreateIssuerParams, CreateIssuerResult } from './functions/issuer/createIssuer';
import { updateIssuerData, UpdateIssuerDataParams, UpdateIssuerDataResult } from './functions/issuer/updateIssuerData';
import { createCompanyValuationReport, CreateCompanyValuationReportParams, CreateCompanyValuationReportResult } from './functions/companyValuationReport/createCompanyValuationReport';
import { updateCompanyValuation, UpdateCompanyValuationParams, UpdateCompanyValuationResult } from './functions/companyValuationReport/updateCompanyValuation';
import { confirmCurrentCompanyValuationReport, ConfirmCurrentCompanyValuationReportParams, ConfirmCurrentCompanyValuationReportResult } from './functions/companyValuationReport/confirmCurrentCompanyValuationReport';
import { addObserversToCompanyValuationReport, AddObserversToCompanyValuationReportParams, AddObserversToCompanyValuationReportResult } from './functions/companyValuationReport/addObserversToCompanyValuationReport';

export class OcpClient {
  private client: LedgerJsonApiClient;

  public issuer: {
    authorizeIssuer: (params: AuthorizeIssuerParams) => Promise<AuthorizeIssuerResult>;
    createIssuer: (params: CreateIssuerParams) => Promise<CreateIssuerResult>;
    updateIssuerData: (params: UpdateIssuerDataParams) => Promise<UpdateIssuerDataResult>;
  };

  public companyValuationReport: {
    createCompanyValuationReport: (
      params: CreateCompanyValuationReportParams
    ) => Promise<CreateCompanyValuationReportResult>;
    updateCompanyValuation: (
      params: UpdateCompanyValuationParams
    ) => Promise<UpdateCompanyValuationResult>;
    confirmCurrentCompanyValuationReport: (
      params: ConfirmCurrentCompanyValuationReportParams
    ) => Promise<ConfirmCurrentCompanyValuationReportResult>;
    addObserversToCompanyValuationReport: (
      params: AddObserversToCompanyValuationReportParams
    ) => Promise<AddObserversToCompanyValuationReportResult>;
  };

  constructor(config?: ClientConfig) {
    this.client = new LedgerJsonApiClient(config);

    this.issuer = {
      authorizeIssuer: (params: AuthorizeIssuerParams) => authorizeIssuer(this.client, params),
      createIssuer: (params: CreateIssuerParams) => createIssuer(this.client, params),
      updateIssuerData: (params: UpdateIssuerDataParams) => updateIssuerData(this.client, params)
    };

    this.companyValuationReport = {
      createCompanyValuationReport: (params: CreateCompanyValuationReportParams) =>
        createCompanyValuationReport(this.client, params),
      updateCompanyValuation: (params: UpdateCompanyValuationParams) =>
        updateCompanyValuation(this.client, params),
      confirmCurrentCompanyValuationReport: (
        params: ConfirmCurrentCompanyValuationReportParams
      ) => confirmCurrentCompanyValuationReport(this.client, params),
      addObserversToCompanyValuationReport: (
        params: AddObserversToCompanyValuationReportParams
      ) => addObserversToCompanyValuationReport(this.client, params)
    };
  }
} 