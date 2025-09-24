// Minimal shape of DAML templateId constants needed by functions
export const Fairmint = {
  OpenCapTable: {
    OcpFactory: { OcpFactory: { templateId: 'pkg:Fairmint.OpenCapTable.OcpFactory.OcpFactory' } },
    ReportsFactory: { ReportsFactory: { templateId: 'pkg:Fairmint.OpenCapTable.ReportsFactory.ReportsFactory' } },
    IssuerAuthorization: {
      IssuerAuthorization: { templateId: 'pkg:Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization' },
      CreateIssuer: {} as any,
    },
    Issuer: { Issuer: { templateId: 'pkg:Fairmint.OpenCapTable.Issuer.Issuer' } },
    StockClass: { StockClass: { templateId: 'pkg:Fairmint.OpenCapTable.StockClass.StockClass' } },
    Valuation: { Valuation: { templateId: 'pkg:Fairmint.OpenCapTable.Valuation.Valuation' } },
    Stakeholder: { Stakeholder: { templateId: 'pkg:Fairmint.OpenCapTable.Stakeholder.Stakeholder' } },
    Document: { Document: { templateId: 'pkg:Fairmint.OpenCapTable.Document.Document' } },
    StockLegendTemplate: { StockLegendTemplate: { templateId: 'pkg:Fairmint.OpenCapTable.StockLegendTemplate.StockLegendTemplate' } },
    StockIssuance: { StockIssuance: { templateId: 'pkg:Fairmint.OpenCapTable.StockIssuance.StockIssuance' } },
    StockPlan: { StockPlan: { templateId: 'pkg:Fairmint.OpenCapTable.StockPlan.StockPlan' } },
    VestingTerms: { VestingTerms: { templateId: 'pkg:Fairmint.OpenCapTable.VestingTerms.VestingTerms' } },
    StockCancellation: { StockCancellation: { templateId: 'pkg:Fairmint.OpenCapTable.StockCancellation.StockCancellation' } },
    IssuerAuthorizedSharesAdjustment: { IssuerAuthorizedSharesAdjustment: { templateId: 'pkg:Fairmint.OpenCapTable.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment' } },
    StockClassAuthorizedSharesAdjustment: { StockClassAuthorizedSharesAdjustment: { templateId: 'pkg:Fairmint.OpenCapTable.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment' } },
    CompanyValuationReport: { CompanyValuationReport: { templateId: 'pkg:Fairmint.OpenCapTableReports.CompanyValuationReport.CompanyValuationReport' } },
    Reports: {},
    Types: {},
  }
} as any;

export default Fairmint;


