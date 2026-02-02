import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import type { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../../errors';
import type { OcfDocument, OcfObjectReference } from '../../../types/native';

function objectTypeToNative(t: Fairmint.OpenCapTable.OCF.Document.OcfObjectType): OcfObjectReference['object_type'] {
  switch (t) {
    case 'OcfObjIssuer':
      return 'ISSUER';
    case 'OcfObjStakeholder':
      return 'STAKEHOLDER';
    case 'OcfObjStockClass':
      return 'STOCK_CLASS';
    case 'OcfObjStockLegendTemplate':
      return 'STOCK_LEGEND_TEMPLATE';
    case 'OcfObjStockPlan':
      return 'STOCK_PLAN';
    case 'OcfObjValuation':
      return 'VALUATION';
    case 'OcfObjVestingTerms':
      return 'VESTING_TERMS';
    case 'OcfObjFinancing':
      return 'FINANCING';
    case 'OcfObjDocument':
      return 'DOCUMENT';
    case 'OcfObjCeStakeholderRelationship':
      return 'CE_STAKEHOLDER_RELATIONSHIP';
    case 'OcfObjCeStakeholderStatus':
      return 'CE_STAKEHOLDER_STATUS';
    case 'OcfObjTxIssuerAuthorizedSharesAdjustment':
      return 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT';
    case 'OcfObjTxStockClassConversionRatioAdjustment':
      return 'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT';
    case 'OcfObjTxStockClassAuthorizedSharesAdjustment':
      return 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT';
    case 'OcfObjTxStockClassSplit':
      return 'TX_STOCK_CLASS_SPLIT';
    case 'OcfObjTxStockPlanPoolAdjustment':
      return 'TX_STOCK_PLAN_POOL_ADJUSTMENT';
    case 'OcfObjTxStockPlanReturnToPool':
      return 'TX_STOCK_PLAN_RETURN_TO_POOL';
    case 'OcfObjTxConvertibleAcceptance':
      return 'TX_CONVERTIBLE_ACCEPTANCE';
    case 'OcfObjTxConvertibleCancellation':
      return 'TX_CONVERTIBLE_CANCELLATION';
    case 'OcfObjTxConvertibleConversion':
      return 'TX_CONVERTIBLE_CONVERSION';
    case 'OcfObjTxConvertibleIssuance':
      return 'TX_CONVERTIBLE_ISSUANCE';
    case 'OcfObjTxConvertibleRetraction':
      return 'TX_CONVERTIBLE_RETRACTION';
    case 'OcfObjTxConvertibleTransfer':
      return 'TX_CONVERTIBLE_TRANSFER';
    case 'OcfObjTxEquityCompensationAcceptance':
      return 'TX_EQUITY_COMPENSATION_ACCEPTANCE';
    case 'OcfObjTxEquityCompensationCancellation':
      return 'TX_EQUITY_COMPENSATION_CANCELLATION';
    case 'OcfObjTxEquityCompensationExercise':
      return 'TX_EQUITY_COMPENSATION_EXERCISE';
    case 'OcfObjTxEquityCompensationIssuance':
      return 'TX_EQUITY_COMPENSATION_ISSUANCE';
    case 'OcfObjTxEquityCompensationRelease':
      return 'TX_EQUITY_COMPENSATION_RELEASE';
    case 'OcfObjTxEquityCompensationRetraction':
      return 'TX_EQUITY_COMPENSATION_RETRACTION';
    case 'OcfObjTxEquityCompensationTransfer':
      return 'TX_EQUITY_COMPENSATION_TRANSFER';
    case 'OcfObjTxEquityCompensationRepricing':
      return 'TX_EQUITY_COMPENSATION_REPRICING';
    case 'OcfObjTxPlanSecurityAcceptance':
      return 'TX_PLAN_SECURITY_ACCEPTANCE';
    case 'OcfObjTxPlanSecurityCancellation':
      return 'TX_PLAN_SECURITY_CANCELLATION';
    case 'OcfObjTxPlanSecurityExercise':
      return 'TX_PLAN_SECURITY_EXERCISE';
    case 'OcfObjTxPlanSecurityIssuance':
      return 'TX_PLAN_SECURITY_ISSUANCE';
    case 'OcfObjTxPlanSecurityRelease':
      return 'TX_PLAN_SECURITY_RELEASE';
    case 'OcfObjTxPlanSecurityRetraction':
      return 'TX_PLAN_SECURITY_RETRACTION';
    case 'OcfObjTxPlanSecurityTransfer':
      return 'TX_PLAN_SECURITY_TRANSFER';
    case 'OcfObjTxStockAcceptance':
      return 'TX_STOCK_ACCEPTANCE';
    case 'OcfObjTxStockCancellation':
      return 'TX_STOCK_CANCELLATION';
    case 'OcfObjTxStockConversion':
      return 'TX_STOCK_CONVERSION';
    case 'OcfObjTxStockIssuance':
      return 'TX_STOCK_ISSUANCE';
    case 'OcfObjTxStockReissuance':
      return 'TX_STOCK_REISSUANCE';
    case 'OcfObjTxStockConsolidation':
      return 'TX_STOCK_CONSOLIDATION';
    case 'OcfObjTxStockRepurchase':
      return 'TX_STOCK_REPURCHASE';
    case 'OcfObjTxStockRetraction':
      return 'TX_STOCK_RETRACTION';
    case 'OcfObjTxStockTransfer':
      return 'TX_STOCK_TRANSFER';
    case 'OcfObjTxWarrantAcceptance':
      return 'TX_WARRANT_ACCEPTANCE';
    case 'OcfObjTxWarrantCancellation':
      return 'TX_WARRANT_CANCELLATION';
    case 'OcfObjTxWarrantExercise':
      return 'TX_WARRANT_EXERCISE';
    case 'OcfObjTxWarrantIssuance':
      return 'TX_WARRANT_ISSUANCE';
    case 'OcfObjTxWarrantRetraction':
      return 'TX_WARRANT_RETRACTION';
    case 'OcfObjTxWarrantTransfer':
      return 'TX_WARRANT_TRANSFER';
    case 'OcfObjTxVestingAcceleration':
      return 'TX_VESTING_ACCELERATION';
    case 'OcfObjTxVestingStart':
      return 'TX_VESTING_START';
    case 'OcfObjTxVestingEvent':
      return 'TX_VESTING_EVENT';
    default: {
      const exhaustiveCheck: never = t;
      throw new OcpParseError(`Unknown DAML object reference type: ${exhaustiveCheck as string}`, {
        source: 'objectReference.object_type',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      });
    }
  }
}

function damlDocumentDataToNative(d: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData): OcfDocument {
  const docWithId = d as unknown as { id?: string };
  return {
    id: docWithId.id ?? '',
    ...(d.path ? { path: d.path } : {}),
    ...(d.uri ? { uri: d.uri } : {}),
    md5: d.md5,
    related_objects: d.related_objects.map((r) => ({
      object_type: objectTypeToNative(r.object_type),
      object_id: r.object_id,
    })),
    comments: Array.isArray((d as unknown as { comments?: unknown }).comments)
      ? (d as unknown as { comments: string[] }).comments
      : [],
  };
}

export interface GetDocumentAsOcfParams {
  contractId: string;
}

export interface GetDocumentAsOcfResult {
  document: OcfDocument & { object_type: 'DOCUMENT'; id?: string };
  contractId: string;
}

export async function getDocumentAsOcf(
  client: LedgerJsonApiClient,
  params: GetDocumentAsOcfParams
): Promise<GetDocumentAsOcfResult> {
  const eventsResponse = await client.getEventsByContractId({ contractId: params.contractId });
  if (!eventsResponse.created?.createdEvent.createArgument) {
    throw new OcpContractError('No createArgument found for contract', {
      contractId: params.contractId,
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  }

  const { createArgument } = eventsResponse.created.createdEvent;

  function hasDocumentData(arg: unknown): arg is { document_data: Fairmint.OpenCapTable.OCF.Document.DocumentOcfData } {
    const record = arg as Record<string, unknown>;
    return (
      typeof arg === 'object' && arg !== null && 'document_data' in record && typeof record.document_data === 'object'
    );
  }

  if (!hasDocumentData(createArgument)) {
    throw new OcpParseError('Unexpected createArgument shape for Document', {
      source: 'Document.createArgument',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
    });
  }

  const native = damlDocumentDataToNative(createArgument.document_data);
  const { id, ...rest } = native;
  const ocf = {
    object_type: 'DOCUMENT' as const,
    id,
    ...rest,
  };
  return { document: ocf, contractId: params.contractId };
}
