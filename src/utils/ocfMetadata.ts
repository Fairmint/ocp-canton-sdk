import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

/** OCF object types supported by the SDK */
export type OcfObjectType =
  | 'STOCK_CLASS'
  | 'STAKEHOLDER'
  | 'STOCK_PLAN'
  | 'STOCK_LEGEND_TEMPLATE'
  | 'DOCUMENT'
  | 'VESTING_TERMS'
  | 'TX_STOCK_ISSUANCE'
  | 'TX_WARRANT_ISSUANCE'
  | 'TX_CONVERTIBLE_ISSUANCE'
  | 'TX_STOCK_PLAN_POOL_ADJUSTMENT'
  | 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT'
  | 'TX_STOCK_CANCELLATION'
  | 'TX_WARRANT_CANCELLATION'
  | 'TX_CONVERTIBLE_CANCELLATION'
  | 'TX_EQUITY_COMPENSATION_CANCELLATION'
  | 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'
  | 'TX_EQUITY_COMPENSATION_ISSUANCE'
  | 'TX_EQUITY_COMPENSATION_EXERCISE';

/** Metadata about each OCF object type including template IDs and data paths */
interface OcfTypeMetadata {
  /** DAML template ID */
  templateId: string;
  /** Path to extract the OCF ID from a created contract's arguments */
  ocfIdPath: string[];
}

/** Central registry of OCF type metadata Maps each OCF object type to its DAML template ID and OCF ID extraction path */
export const OCF_METADATA: Record<OcfObjectType, OcfTypeMetadata> = {
  STOCK_CLASS: {
    templateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
    ocfIdPath: ['stock_class_data', 'id'],
  },
  STAKEHOLDER: {
    templateId: Fairmint.OpenCapTable.OCF.Stakeholder.Stakeholder.templateId,
    ocfIdPath: ['stakeholder_data', 'id'],
  },
  STOCK_PLAN: {
    templateId: Fairmint.OpenCapTable.OCF.StockPlan.StockPlan.templateId,
    ocfIdPath: ['plan_data', 'id'],
  },
  STOCK_LEGEND_TEMPLATE: {
    templateId: Fairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplate.templateId,
    ocfIdPath: ['template_data', 'id'],
  },
  DOCUMENT: {
    templateId: Fairmint.OpenCapTable.OCF.Document.Document.templateId,
    ocfIdPath: ['document_data', 'id'],
  },
  VESTING_TERMS: {
    templateId: Fairmint.OpenCapTable.OCF.VestingTerms.VestingTerms.templateId,
    ocfIdPath: ['vesting_terms_data', 'id'],
  },
  TX_STOCK_ISSUANCE: {
    templateId: Fairmint.OpenCapTable.OCF.StockIssuance.StockIssuance.templateId,
    ocfIdPath: ['issuance_data', 'id'],
  },
  TX_WARRANT_ISSUANCE: {
    templateId: Fairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuance.templateId,
    ocfIdPath: ['issuance_data', 'id'],
  },
  TX_CONVERTIBLE_ISSUANCE: {
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuance.templateId,
    ocfIdPath: ['issuance_data', 'id'],
  },
  TX_STOCK_PLAN_POOL_ADJUSTMENT: {
    templateId: Fairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustment.templateId,
    ocfIdPath: ['adjustment_data', 'id'],
  },
  TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: {
    templateId:
      Fairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustment.templateId,
    ocfIdPath: ['adjustment_data', 'id'],
  },
  TX_STOCK_CANCELLATION: {
    templateId: Fairmint.OpenCapTable.OCF.StockCancellation.StockCancellation.templateId,
    ocfIdPath: ['cancellation_data', 'id'],
  },
  TX_WARRANT_CANCELLATION: {
    templateId: Fairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellation.templateId,
    ocfIdPath: ['cancellation_data', 'id'],
  },
  TX_CONVERTIBLE_CANCELLATION: {
    templateId: Fairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellation.templateId,
    ocfIdPath: ['cancellation_data', 'id'],
  },
  TX_EQUITY_COMPENSATION_CANCELLATION: {
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellation.templateId,
    ocfIdPath: ['cancellation_data', 'id'],
  },
  TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: {
    templateId: Fairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustment.templateId,
    ocfIdPath: ['adjustment_data', 'id'],
  },
  TX_EQUITY_COMPENSATION_ISSUANCE: {
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuance.templateId,
    ocfIdPath: ['issuance_data', 'id'],
  },
  TX_EQUITY_COMPENSATION_EXERCISE: {
    templateId: Fairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExercise.templateId,
    ocfIdPath: ['exercise_data', 'id'],
  },
};

/** Get metadata for a specific OCF object type */
export function getOcfMetadata(type: OcfObjectType): OcfTypeMetadata {
  return OCF_METADATA[type];
}

/** Get all supported OCF object types */
export function getAllOcfTypes(): OcfObjectType[] {
  return Object.keys(OCF_METADATA) as OcfObjectType[];
}

/** Check if a given string is a valid OCF object type */
export function isValidOcfType(type: string): type is OcfObjectType {
  return type in OCF_METADATA;
}
