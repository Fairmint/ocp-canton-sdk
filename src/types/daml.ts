/**
 * Re-exports of DAML-generated types from @fairmint/open-captable-protocol-daml-js.
 *
 * This module provides a clean interface to the DAML types used in the SDK,
 * avoiding deep imports and providing better discoverability.
 *
 * These types represent the DAML contract structures on the Canton ledger.
 * They differ from the native OCF types in native.ts which are the clean
 * TypeScript representations used in the SDK's public API.
 *
 * NOTE: Some names may overlap with manually-defined SDK interfaces. Use the
 * `Pkg*` aliases from this module when you need the exact DAML package types.
 *
 * @module
 */

import type { Fairmint as DamlFairmint } from '@fairmint/open-captable-protocol-daml-js';

// ===== DAML Package Types =====
// These are prefixed with "Pkg" to avoid conflicts with existing SDK interfaces.
// They represent the exact types from the DAML-generated package: one `<Name>OcfData` payload per OCF record kind.

/** DAML package type for ConvertibleAcceptance entity data */
export type PkgConvertibleAcceptanceOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleAcceptance.ConvertibleAcceptanceOcfData;

/** DAML package type for ConvertibleCancellation entity data */
export type PkgConvertibleCancellationOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleCancellation.ConvertibleCancellationOcfData;

/** DAML package type for ConvertibleConversion entity data */
export type PkgConvertibleConversionOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleConversion.ConvertibleConversionOcfData;

/** DAML package type for ConvertibleIssuance entity data */
export type PkgConvertibleIssuanceOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleIssuance.ConvertibleIssuanceOcfData;

/** DAML package type for ConvertibleRetraction entity data */
export type PkgConvertibleRetractionOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleRetraction.ConvertibleRetractionOcfData;

/** DAML package type for ConvertibleTransfer entity data */
export type PkgConvertibleTransferOcfData =
  DamlFairmint.OpenCapTable.OCF.ConvertibleTransfer.ConvertibleTransferOcfData;

/** DAML package type for Document entity data */
export type PkgDocumentOcfData = DamlFairmint.OpenCapTable.OCF.Document.DocumentOcfData;

/** DAML package type for EquityCompensationAcceptance entity data */
export type PkgEquityCompensationAcceptanceOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationAcceptance.EquityCompensationAcceptanceOcfData;

/** DAML package type for EquityCompensationCancellation entity data */
export type PkgEquityCompensationCancellationOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationCancellation.EquityCompensationCancellationOcfData;

/** DAML package type for EquityCompensationExercise entity data */
export type PkgEquityCompensationExerciseOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationExercise.EquityCompensationExerciseOcfData;

/** DAML package type for EquityCompensationIssuance entity data */
export type PkgEquityCompensationIssuanceOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationIssuance.EquityCompensationIssuanceOcfData;

/** DAML package type for EquityCompensationRelease entity data */
export type PkgEquityCompensationReleaseOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationRelease.EquityCompensationReleaseOcfData;

/** DAML package type for EquityCompensationRepricing entity data */
export type PkgEquityCompensationRepricingOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationRepricing.EquityCompensationRepricingOcfData;

/** DAML package type for EquityCompensationRetraction entity data */
export type PkgEquityCompensationRetractionOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationRetraction.EquityCompensationRetractionOcfData;

/** DAML package type for EquityCompensationTransfer entity data */
export type PkgEquityCompensationTransferOcfData =
  DamlFairmint.OpenCapTable.OCF.EquityCompensationTransfer.EquityCompensationTransferOcfData;

/** DAML package type for Financing entity data */
export type PkgFinancingOcfData = DamlFairmint.OpenCapTable.OCF.Financing.FinancingOcfData;

/** DAML package type for Issuer entity data */
export type PkgIssuerOcfData = DamlFairmint.OpenCapTable.OCF.Issuer.IssuerOcfData;

/** DAML package type for IssuerAuthorizedSharesAdjustment entity data */
export type PkgIssuerAuthorizedSharesAdjustmentOcfData =
  DamlFairmint.OpenCapTable.OCF.IssuerAuthorizedSharesAdjustment.IssuerAuthorizedSharesAdjustmentOcfData;

/** DAML package type for Stakeholder entity data */
export type PkgStakeholderOcfData = DamlFairmint.OpenCapTable.OCF.Stakeholder.StakeholderOcfData;

/** DAML package type for StakeholderRelationshipChangeEvent entity data */
export type PkgStakeholderRelationshipChangeEventOcfData =
  DamlFairmint.OpenCapTable.OCF.StakeholderRelationshipChangeEvent.StakeholderRelationshipChangeEventOcfData;

/** DAML package type for StakeholderStatusChangeEvent entity data */
export type PkgStakeholderStatusChangeEventOcfData =
  DamlFairmint.OpenCapTable.OCF.StakeholderStatusChangeEvent.StakeholderStatusChangeEventOcfData;

/** DAML package type for StockAcceptance entity data */
export type PkgStockAcceptanceOcfData = DamlFairmint.OpenCapTable.OCF.StockAcceptance.StockAcceptanceOcfData;

/** DAML package type for StockCancellation entity data */
export type PkgStockCancellationOcfData = DamlFairmint.OpenCapTable.OCF.StockCancellation.StockCancellationOcfData;

/** DAML package type for StockClass entity data */
export type PkgStockClassOcfData = DamlFairmint.OpenCapTable.OCF.StockClass.StockClassOcfData;

/** DAML package type for StockClassAuthorizedSharesAdjustment entity data */
export type PkgStockClassAuthorizedSharesAdjustmentOcfData =
  DamlFairmint.OpenCapTable.OCF.StockClassAuthorizedSharesAdjustment.StockClassAuthorizedSharesAdjustmentOcfData;

/** DAML package type for StockClassConversionRatioAdjustment entity data */
export type PkgStockClassConversionRatioAdjustmentOcfData =
  DamlFairmint.OpenCapTable.OCF.StockClassConversionRatioAdjustment.StockClassConversionRatioAdjustmentOcfData;

/** DAML package type for StockClassSplit entity data */
export type PkgStockClassSplitOcfData = DamlFairmint.OpenCapTable.OCF.StockClassSplit.StockClassSplitOcfData;

/** DAML package type for StockConsolidation entity data */
export type PkgStockConsolidationOcfData = DamlFairmint.OpenCapTable.OCF.StockConsolidation.StockConsolidationOcfData;

/** DAML package type for StockConversion entity data */
export type PkgStockConversionOcfData = DamlFairmint.OpenCapTable.OCF.StockConversion.StockConversionOcfData;

/** DAML package type for StockHold entity data */
export type PkgStockHoldOcfData = DamlFairmint.OpenCapTable.OCF.StockHold.StockHoldOcfData;

/** DAML package type for StockHoldCancellation entity data */
export type PkgStockHoldCancellationOcfData =
  DamlFairmint.OpenCapTable.OCF.StockHoldCancellation.StockHoldCancellationOcfData;

/** DAML package type for StockIssuance entity data */
export type PkgStockIssuanceOcfData = DamlFairmint.OpenCapTable.OCF.StockIssuance.StockIssuanceOcfData;

/** DAML package type for StockLegendTemplate entity data */
export type PkgStockLegendTemplateOcfData =
  DamlFairmint.OpenCapTable.OCF.StockLegendTemplate.StockLegendTemplateOcfData;

/** DAML package type for StockPlan entity data */
export type PkgStockPlanOcfData = DamlFairmint.OpenCapTable.OCF.StockPlan.StockPlanOcfData;

/** DAML package type for StockPlanPoolAdjustment entity data */
export type PkgStockPlanPoolAdjustmentOcfData =
  DamlFairmint.OpenCapTable.OCF.StockPlanPoolAdjustment.StockPlanPoolAdjustmentOcfData;

/** DAML package type for StockPlanReturnToPool entity data */
export type PkgStockPlanReturnToPoolOcfData =
  DamlFairmint.OpenCapTable.OCF.StockPlanReturnToPool.StockPlanReturnToPoolOcfData;

/** DAML package type for StockReissuance entity data */
export type PkgStockReissuanceOcfData = DamlFairmint.OpenCapTable.OCF.StockReissuance.StockReissuanceOcfData;

/** DAML package type for StockRepurchase entity data */
export type PkgStockRepurchaseOcfData = DamlFairmint.OpenCapTable.OCF.StockRepurchase.StockRepurchaseOcfData;

/** DAML package type for StockRetraction entity data */
export type PkgStockRetractionOcfData = DamlFairmint.OpenCapTable.OCF.StockRetraction.StockRetractionOcfData;

/** DAML package type for StockTransfer entity data */
export type PkgStockTransferOcfData = DamlFairmint.OpenCapTable.OCF.StockTransfer.StockTransferOcfData;

/** DAML package type for Valuation entity data */
export type PkgValuationOcfData = DamlFairmint.OpenCapTable.OCF.Valuation.ValuationOcfData;

/** DAML package type for VestingAcceleration entity data */
export type PkgVestingAccelerationOcfData =
  DamlFairmint.OpenCapTable.OCF.VestingAcceleration.VestingAccelerationOcfData;

/** DAML package type for VestingEvent entity data */
export type PkgVestingEventOcfData = DamlFairmint.OpenCapTable.OCF.VestingEvent.VestingEventOcfData;

/** DAML package type for VestingStart entity data */
export type PkgVestingStartOcfData = DamlFairmint.OpenCapTable.OCF.VestingStart.VestingStartOcfData;

/** DAML package type for VestingTerms entity data */
export type PkgVestingTermsOcfData = DamlFairmint.OpenCapTable.OCF.VestingTerms.VestingTermsOcfData;

/** DAML package type for WarrantAcceptance entity data */
export type PkgWarrantAcceptanceOcfData = DamlFairmint.OpenCapTable.OCF.WarrantAcceptance.WarrantAcceptanceOcfData;

/** DAML package type for WarrantCancellation entity data */
export type PkgWarrantCancellationOcfData =
  DamlFairmint.OpenCapTable.OCF.WarrantCancellation.WarrantCancellationOcfData;

/** DAML package type for WarrantExercise entity data */
export type PkgWarrantExerciseOcfData = DamlFairmint.OpenCapTable.OCF.WarrantExercise.WarrantExerciseOcfData;

/** DAML package type for WarrantIssuance entity data */
export type PkgWarrantIssuanceOcfData = DamlFairmint.OpenCapTable.OCF.WarrantIssuance.WarrantIssuanceOcfData;

/** DAML package type for WarrantRetraction entity data */
export type PkgWarrantRetractionOcfData = DamlFairmint.OpenCapTable.OCF.WarrantRetraction.WarrantRetractionOcfData;

/** DAML package type for WarrantTransfer entity data */
export type PkgWarrantTransferOcfData = DamlFairmint.OpenCapTable.OCF.WarrantTransfer.WarrantTransferOcfData;

/** DAML enum type for StockIssuance issuance type */
export type PkgStockIssuanceType = DamlFairmint.OpenCapTable.OCF.StockIssuance.OcfStockIssuanceType;

// ===== DAML Primitive Types =====

/** DAML Monetary type */
export type DamlMonetary = DamlFairmint.OpenCapTable.Types.Monetary.OcfMonetary;

/** DAML Contact (Email, Phone) types */
export type DamlEmail = DamlFairmint.OpenCapTable.Types.Contact.OcfEmail;
export type DamlPhone = DamlFairmint.OpenCapTable.Types.Contact.OcfPhone;
export type DamlEmailType = DamlFairmint.OpenCapTable.Types.Contact.OcfEmailType;
export type DamlPhoneType = DamlFairmint.OpenCapTable.Types.Contact.OcfPhoneType;
