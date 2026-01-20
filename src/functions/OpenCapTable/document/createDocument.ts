import type { OcfDocument, OcfObjectReference } from '../../../types';
import { cleanComments, optionalString } from '../../../utils/typeConversions';

function objectTypeToDaml(t: OcfObjectReference['object_type']): string {
  switch (t) {
    case 'ISSUER':
      return 'OcfObjIssuer';
    case 'STAKEHOLDER':
      return 'OcfObjStakeholder';
    case 'STOCK_CLASS':
      return 'OcfObjStockClass';
    case 'STOCK_LEGEND_TEMPLATE':
      return 'OcfObjStockLegendTemplate';
    case 'STOCK_PLAN':
      return 'OcfObjStockPlan';
    case 'VALUATION':
      return 'OcfObjValuation';
    case 'VESTING_TERMS':
      return 'OcfObjVestingTerms';
    case 'FINANCING':
      return 'OcfObjFinancing';
    case 'DOCUMENT':
      return 'OcfObjDocument';
    case 'CE_STAKEHOLDER_RELATIONSHIP':
      return 'OcfObjCeStakeholderRelationship';
    case 'CE_STAKEHOLDER_STATUS':
      return 'OcfObjCeStakeholderStatus';
    case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
      return 'OcfObjTxIssuerAuthorizedSharesAdjustment';
    case 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT':
      return 'OcfObjTxStockClassConversionRatioAdjustment';
    case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
      return 'OcfObjTxStockClassAuthorizedSharesAdjustment';
    case 'TX_STOCK_CLASS_SPLIT':
      return 'OcfObjTxStockClassSplit';
    case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
      return 'OcfObjTxStockPlanPoolAdjustment';
    case 'TX_STOCK_PLAN_RETURN_TO_POOL':
      return 'OcfObjTxStockPlanReturnToPool';
    case 'TX_CONVERTIBLE_ACCEPTANCE':
      return 'OcfObjTxConvertibleAcceptance';
    case 'TX_CONVERTIBLE_CANCELLATION':
      return 'OcfObjTxConvertibleCancellation';
    case 'TX_CONVERTIBLE_CONVERSION':
      return 'OcfObjTxConvertibleConversion';
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 'OcfObjTxConvertibleIssuance';
    case 'TX_CONVERTIBLE_RETRACTION':
      return 'OcfObjTxConvertibleRetraction';
    case 'TX_CONVERTIBLE_TRANSFER':
      return 'OcfObjTxConvertibleTransfer';
    case 'TX_EQUITY_COMPENSATION_ACCEPTANCE':
      return 'OcfObjTxEquityCompensationAcceptance';
    case 'TX_EQUITY_COMPENSATION_CANCELLATION':
      return 'OcfObjTxEquityCompensationCancellation';
    case 'TX_EQUITY_COMPENSATION_EXERCISE':
      return 'OcfObjTxEquityCompensationExercise';
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
      return 'OcfObjTxEquityCompensationIssuance';
    case 'TX_EQUITY_COMPENSATION_RELEASE':
      return 'OcfObjTxEquityCompensationRelease';
    case 'TX_EQUITY_COMPENSATION_RETRACTION':
      return 'OcfObjTxEquityCompensationRetraction';
    case 'TX_EQUITY_COMPENSATION_TRANSFER':
      return 'OcfObjTxEquityCompensationTransfer';
    case 'TX_EQUITY_COMPENSATION_REPRICING':
      return 'OcfObjTxEquityCompensationRepricing';
    case 'TX_PLAN_SECURITY_ACCEPTANCE':
      return 'OcfObjTxPlanSecurityAcceptance';
    case 'TX_PLAN_SECURITY_CANCELLATION':
      return 'OcfObjTxPlanSecurityCancellation';
    case 'TX_PLAN_SECURITY_EXERCISE':
      return 'OcfObjTxPlanSecurityExercise';
    case 'TX_PLAN_SECURITY_ISSUANCE':
      return 'OcfObjTxPlanSecurityIssuance';
    case 'TX_PLAN_SECURITY_RELEASE':
      return 'OcfObjTxPlanSecurityRelease';
    case 'TX_PLAN_SECURITY_RETRACTION':
      return 'OcfObjTxPlanSecurityRetraction';
    case 'TX_PLAN_SECURITY_TRANSFER':
      return 'OcfObjTxPlanSecurityTransfer';
    case 'TX_STOCK_ACCEPTANCE':
      return 'OcfObjTxStockAcceptance';
    case 'TX_STOCK_CANCELLATION':
      return 'OcfObjTxStockCancellation';
    case 'TX_STOCK_CONVERSION':
      return 'OcfObjTxStockConversion';
    case 'TX_STOCK_ISSUANCE':
      return 'OcfObjTxStockIssuance';
    case 'TX_STOCK_REISSUANCE':
      return 'OcfObjTxStockReissuance';
    case 'TX_STOCK_CONSOLIDATION':
      return 'OcfObjTxStockConsolidation';
    case 'TX_STOCK_REPURCHASE':
      return 'OcfObjTxStockRepurchase';
    case 'TX_STOCK_RETRACTION':
      return 'OcfObjTxStockRetraction';
    case 'TX_STOCK_TRANSFER':
      return 'OcfObjTxStockTransfer';
    case 'TX_WARRANT_ACCEPTANCE':
      return 'OcfObjTxWarrantAcceptance';
    case 'TX_WARRANT_CANCELLATION':
      return 'OcfObjTxWarrantCancellation';
    case 'TX_WARRANT_EXERCISE':
      return 'OcfObjTxWarrantExercise';
    case 'TX_WARRANT_ISSUANCE':
      return 'OcfObjTxWarrantIssuance';
    case 'TX_WARRANT_RETRACTION':
      return 'OcfObjTxWarrantRetraction';
    case 'TX_WARRANT_TRANSFER':
      return 'OcfObjTxWarrantTransfer';
    case 'TX_VESTING_ACCELERATION':
      return 'OcfObjTxVestingAcceleration';
    case 'TX_VESTING_START':
      return 'OcfObjTxVestingStart';
    case 'TX_VESTING_EVENT':
      return 'OcfObjTxVestingEvent';
    default: {
      // This should never happen if all cases are handled
      const exhaustiveCheck: never = t;
      throw new Error(`Unsupported object reference type: ${exhaustiveCheck as string}`);
    }
  }
}

/**
 * Convert OCF document data to DAML format.
 *
 * @deprecated Use `ocp.OpenCapTable.capTable.update().create('document', data).execute()` instead.
 *   This function will be removed in a future major version.
 */
export function documentDataToDaml(d: OcfDocument): Record<string, unknown> {
  if (!d.id) throw new Error('document.id is required');
  if (!d.md5) throw new Error('document.md5 is required');
  if (!d.path && !d.uri) throw new Error('document requires path or uri');
  return {
    id: d.id,
    path: optionalString(d.path),
    uri: optionalString(d.uri),
    md5: d.md5,
    related_objects: (d.related_objects ?? []).map((r) => ({
      object_type: objectTypeToDaml(r.object_type),
      object_id: r.object_id,
    })),
    comments: cleanComments(d.comments),
  };
}
