/** Compile-time proof that built declarations exclude non-schema fields. */

import type {
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfObjectType,
  OcfStakeholder,
  OcfStakeholderStatusChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfWarrantExercise,
  OcfWarrantIssuance,
} from '../../dist';

type LegacyPlanSecurityObjectType =
  | 'TX_PLAN_SECURITY_ACCEPTANCE'
  | 'TX_PLAN_SECURITY_CANCELLATION'
  | 'TX_PLAN_SECURITY_EXERCISE'
  | 'TX_PLAN_SECURITY_ISSUANCE'
  | 'TX_PLAN_SECURITY_RELEASE'
  | 'TX_PLAN_SECURITY_RETRACTION'
  | 'TX_PLAN_SECURITY_TRANSFER';
type Assert<T extends true> = T;
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const builtObjectTypeExcludesPlanSecurity: Assert<
  IsExactly<Extract<OcfObjectType, LegacyPlanSecurityObjectType>, never>
> = true;
void builtObjectTypeExcludesPlanSecurity;

// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityAcceptance = import('../../dist').OcfPlanSecurityAcceptance;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityCancellation = import('../../dist').OcfPlanSecurityCancellation;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityExercise = import('../../dist').OcfPlanSecurityExercise;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityIssuance = import('../../dist').OcfPlanSecurityIssuance;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityRelease = import('../../dist').OcfPlanSecurityRelease;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityRetraction = import('../../dist').OcfPlanSecurityRetraction;
// @ts-expect-error legacy PlanSecurity DTOs are not built exports
type RemovedPlanSecurityTransfer = import('../../dist').OcfPlanSecurityTransfer;

// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityAcceptanceOutput = import('../../dist').OcfPlanSecurityAcceptanceOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityCancellationOutput = import('../../dist').OcfPlanSecurityCancellationOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityExerciseOutput = import('../../dist').OcfPlanSecurityExerciseOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityIssuanceOutput = import('../../dist').OcfPlanSecurityIssuanceOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityReleaseOutput = import('../../dist').OcfPlanSecurityReleaseOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityRetractionOutput = import('../../dist').OcfPlanSecurityRetractionOutput;
// @ts-expect-error legacy PlanSecurity output aliases are not built exports
type RemovedPlanSecurityTransferOutput = import('../../dist').OcfPlanSecurityTransferOutput;

type RemovedPlanSecurityBuiltSurface = readonly [
  RemovedPlanSecurityAcceptance,
  RemovedPlanSecurityCancellation,
  RemovedPlanSecurityExercise,
  RemovedPlanSecurityIssuance,
  RemovedPlanSecurityRelease,
  RemovedPlanSecurityRetraction,
  RemovedPlanSecurityTransfer,
  RemovedPlanSecurityAcceptanceOutput,
  RemovedPlanSecurityCancellationOutput,
  RemovedPlanSecurityExerciseOutput,
  RemovedPlanSecurityIssuanceOutput,
  RemovedPlanSecurityReleaseOutput,
  RemovedPlanSecurityRetractionOutput,
  RemovedPlanSecurityTransferOutput,
];
declare const removedPlanSecurityBuiltSurface: RemovedPlanSecurityBuiltSurface;
void removedPlanSecurityBuiltSurface;

declare const stakeholder: OcfStakeholder;
// @ts-expect-error built Stakeholder uses current_relationships
stakeholder.current_relationship;

declare const stockConversion: OcfStockConversion;
// @ts-expect-error built StockConversion uses quantity_converted
stockConversion.quantity;

declare const equityCompensationRelease: OcfEquityCompensationRelease;
// @ts-expect-error built releases do not include balance_security_id
equityCompensationRelease.balance_security_id;

declare const stockClassSplit: OcfStockClassSplit;
// @ts-expect-error built split ratios are nested
stockClassSplit.split_ratio_numerator;
// @ts-expect-error built split ratios are nested
stockClassSplit.split_ratio_denominator;
// @ts-expect-error built splits do not include approval dates
stockClassSplit.board_approval_date;
// @ts-expect-error built splits do not include approval dates
stockClassSplit.stockholder_approval_date;

declare const ratioAdjustment: OcfStockClassConversionRatioAdjustment;
// @ts-expect-error built ratio adjustments do not include approval dates
ratioAdjustment.board_approval_date;
// @ts-expect-error built ratio adjustments do not include approval dates
ratioAdjustment.stockholder_approval_date;

declare const stockConsolidation: OcfStockConsolidation;
// @ts-expect-error built StockConsolidation uses resulting_security_id
stockConsolidation.resulting_security_ids;

declare const equityCompensationRepricing: OcfEquityCompensationRepricing;
// @ts-expect-error built repricing declarations do not include resulting IDs
equityCompensationRepricing.resulting_security_ids;

declare const stakeholderStatusChange: OcfStakeholderStatusChangeEvent;
// @ts-expect-error built status changes use comments for free-form text
stakeholderStatusChange.reason_text;

declare const warrantIssuance: OcfWarrantIssuance;
// @ts-expect-error built WarrantIssuance declarations exclude ratio_numerator
warrantIssuance.ratio_numerator;
// @ts-expect-error built WarrantIssuance declarations exclude ratio_denominator
warrantIssuance.ratio_denominator;
// @ts-expect-error built WarrantIssuance declarations exclude percent_of_outstanding
warrantIssuance.percent_of_outstanding;
// @ts-expect-error built WarrantIssuance declarations use exercise_triggers
warrantIssuance.conversion_triggers;

declare const warrantExercise: OcfWarrantExercise;
// @ts-expect-error built WarrantExercise declarations exclude ledger-only quantity
warrantExercise.quantity;
// @ts-expect-error built WarrantExercise declarations exclude balance_security_id
warrantExercise.balance_security_id;
