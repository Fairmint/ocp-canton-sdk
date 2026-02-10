/**
 * OCF output types with `object_type` discriminant.
 *
 * These types extend the base OCF types from `native.ts` with a readonly `object_type`
 * field, enabling TypeScript discriminated unions. All `get()` operations return
 * these output types.
 *
 * @example Discriminated union pattern
 * ```typescript
 * function handleEntity(entity: OcfObject) {
 *   switch (entity.object_type) {
 *     case 'ISSUER':
 *       console.log(entity.legal_name); // TypeScript knows this is OcfIssuerOutput
 *       break;
 *     case 'STAKEHOLDER':
 *       console.log(entity.name.legal_name); // TypeScript knows this is OcfStakeholderOutput
 *       break;
 *   }
 * }
 * ```
 *
 * @module
 */

import type { WithObjectType } from './common';
import type {
  OcfConvertibleAcceptance,
  OcfConvertibleCancellation,
  OcfConvertibleConversion,
  OcfConvertibleIssuance,
  OcfConvertibleTransfer,
  OcfDocument,
  OcfEquityCompensationAcceptance,
  OcfEquityCompensationCancellation,
  OcfEquityCompensationExercise,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationTransfer,
  OcfIssuer,
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStakeholder,
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  OcfStockAcceptance,
  OcfStockCancellation,
  OcfStockClass,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
  OcfStockIssuance,
  OcfStockLegendTemplate,
  OcfStockPlan,
  OcfStockPlanPoolAdjustment,
  OcfStockReissuance,
  OcfStockRepurchase,
  OcfStockTransfer,
  OcfValuation,
  OcfVestingAcceleration,
  OcfVestingEvent,
  OcfVestingStart,
  OcfVestingTerms,
  OcfWarrantAcceptance,
  OcfWarrantCancellation,
  OcfWarrantExercise,
  OcfWarrantIssuance,
  OcfWarrantTransfer,
} from './native';

// ===== Object Types (entities) =====

/** Issuer output with `object_type: 'ISSUER'` discriminant */
export type OcfIssuerOutput = WithObjectType<OcfIssuer, 'ISSUER'>;

/** Stakeholder output with `object_type: 'STAKEHOLDER'` discriminant */
export type OcfStakeholderOutput = WithObjectType<OcfStakeholder, 'STAKEHOLDER'>;

/** Stock Class output with `object_type: 'STOCK_CLASS'` discriminant */
export type OcfStockClassOutput = WithObjectType<OcfStockClass, 'STOCK_CLASS'>;

/** Stock Legend Template output with `object_type: 'STOCK_LEGEND_TEMPLATE'` discriminant */
export type OcfStockLegendTemplateOutput = WithObjectType<OcfStockLegendTemplate, 'STOCK_LEGEND_TEMPLATE'>;

/** Stock Plan output with `object_type: 'STOCK_PLAN'` discriminant */
export type OcfStockPlanOutput = WithObjectType<OcfStockPlan, 'STOCK_PLAN'>;

/** Vesting Terms output with `object_type: 'VESTING_TERMS'` discriminant */
export type OcfVestingTermsOutput = WithObjectType<OcfVestingTerms, 'VESTING_TERMS'>;

/** Valuation output with `object_type: 'VALUATION'` discriminant */
export type OcfValuationOutput = WithObjectType<OcfValuation, 'VALUATION'>;

/** Document output with `object_type: 'DOCUMENT'` discriminant */
export type OcfDocumentOutput = WithObjectType<OcfDocument, 'DOCUMENT'>;

// ===== Transaction Types (issuances) =====

/** Stock Issuance output with `object_type: 'TX_STOCK_ISSUANCE'` discriminant */
export type OcfStockIssuanceOutput = WithObjectType<OcfStockIssuance, 'TX_STOCK_ISSUANCE'>;

/** Equity Compensation Issuance output */
export type OcfEquityCompensationIssuanceOutput = WithObjectType<
  OcfEquityCompensationIssuance,
  'TX_EQUITY_COMPENSATION_ISSUANCE'
>;

/** Warrant Issuance output */
export type OcfWarrantIssuanceOutput = WithObjectType<OcfWarrantIssuance, 'TX_WARRANT_ISSUANCE'>;

/** Convertible Issuance output */
export type OcfConvertibleIssuanceOutput = WithObjectType<OcfConvertibleIssuance, 'TX_CONVERTIBLE_ISSUANCE'>;

// ===== Transaction Types (transfers) =====

/** Stock Transfer output */
export type OcfStockTransferOutput = WithObjectType<OcfStockTransfer, 'TX_STOCK_TRANSFER'>;

/** Warrant Transfer output */
export type OcfWarrantTransferOutput = WithObjectType<OcfWarrantTransfer, 'TX_WARRANT_TRANSFER'>;

/** Convertible Transfer output */
export type OcfConvertibleTransferOutput = WithObjectType<OcfConvertibleTransfer, 'TX_CONVERTIBLE_TRANSFER'>;

/** Equity Compensation Transfer output */
export type OcfEquityCompensationTransferOutput = WithObjectType<
  OcfEquityCompensationTransfer,
  'TX_EQUITY_COMPENSATION_TRANSFER'
>;

// ===== Transaction Types (cancellations) =====

/** Stock Cancellation output */
export type OcfStockCancellationOutput = WithObjectType<OcfStockCancellation, 'TX_STOCK_CANCELLATION'>;

/** Warrant Cancellation output */
export type OcfWarrantCancellationOutput = WithObjectType<OcfWarrantCancellation, 'TX_WARRANT_CANCELLATION'>;

/** Convertible Cancellation output */
export type OcfConvertibleCancellationOutput = WithObjectType<
  OcfConvertibleCancellation,
  'TX_CONVERTIBLE_CANCELLATION'
>;

/** Equity Compensation Cancellation output */
export type OcfEquityCompensationCancellationOutput = WithObjectType<
  OcfEquityCompensationCancellation,
  'TX_EQUITY_COMPENSATION_CANCELLATION'
>;

// ===== Transaction Types (exercises) =====

/** Equity Compensation Exercise output */
export type OcfEquityCompensationExerciseOutput = WithObjectType<
  OcfEquityCompensationExercise,
  'TX_EQUITY_COMPENSATION_EXERCISE'
>;

/** Warrant Exercise output */
export type OcfWarrantExerciseOutput = WithObjectType<OcfWarrantExercise, 'TX_WARRANT_EXERCISE'>;

// ===== Transaction Types (conversions) =====

/** Stock Conversion output */
export type OcfStockConversionOutput = WithObjectType<OcfStockConversion, 'TX_STOCK_CONVERSION'>;

/** Convertible Conversion output */
export type OcfConvertibleConversionOutput = WithObjectType<OcfConvertibleConversion, 'TX_CONVERTIBLE_CONVERSION'>;

// ===== Transaction Types (acceptances) =====

/** Stock Acceptance output */
export type OcfStockAcceptanceOutput = WithObjectType<OcfStockAcceptance, 'TX_STOCK_ACCEPTANCE'>;

/** Warrant Acceptance output */
export type OcfWarrantAcceptanceOutput = WithObjectType<OcfWarrantAcceptance, 'TX_WARRANT_ACCEPTANCE'>;

/** Convertible Acceptance output */
export type OcfConvertibleAcceptanceOutput = WithObjectType<OcfConvertibleAcceptance, 'TX_CONVERTIBLE_ACCEPTANCE'>;

/** Equity Compensation Acceptance output */
export type OcfEquityCompensationAcceptanceOutput = WithObjectType<
  OcfEquityCompensationAcceptance,
  'TX_EQUITY_COMPENSATION_ACCEPTANCE'
>;

// ===== Transaction Types (adjustments) =====

/** Issuer Authorized Shares Adjustment output */
export type OcfIssuerAuthorizedSharesAdjustmentOutput = WithObjectType<
  OcfIssuerAuthorizedSharesAdjustment,
  'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'
>;

/** Stock Class Authorized Shares Adjustment output */
export type OcfStockClassAuthorizedSharesAdjustmentOutput = WithObjectType<
  OcfStockClassAuthorizedSharesAdjustment,
  'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT'
>;

/** Stock Class Conversion Ratio Adjustment output */
export type OcfStockClassConversionRatioAdjustmentOutput = WithObjectType<
  OcfStockClassConversionRatioAdjustment,
  'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT'
>;

/** Stock Class Split output */
export type OcfStockClassSplitOutput = WithObjectType<OcfStockClassSplit, 'TX_STOCK_CLASS_SPLIT'>;

/** Stock Plan Pool Adjustment output */
export type OcfStockPlanPoolAdjustmentOutput = WithObjectType<
  OcfStockPlanPoolAdjustment,
  'TX_STOCK_PLAN_POOL_ADJUSTMENT'
>;

// ===== Transaction Types (other) =====

/** Stock Repurchase output */
export type OcfStockRepurchaseOutput = WithObjectType<OcfStockRepurchase, 'TX_STOCK_REPURCHASE'>;

/** Stock Consolidation output */
export type OcfStockConsolidationOutput = WithObjectType<OcfStockConsolidation, 'TX_STOCK_CONSOLIDATION'>;

/** Stock Reissuance output */
export type OcfStockReissuanceOutput = WithObjectType<OcfStockReissuance, 'TX_STOCK_REISSUANCE'>;

// ===== Transaction Types (vesting) =====

/** Vesting Start output */
export type OcfVestingStartOutput = WithObjectType<OcfVestingStart, 'TX_VESTING_START'>;

/** Vesting Event output */
export type OcfVestingEventOutput = WithObjectType<OcfVestingEvent, 'TX_VESTING_EVENT'>;

/** Vesting Acceleration output */
export type OcfVestingAccelerationOutput = WithObjectType<OcfVestingAcceleration, 'TX_VESTING_ACCELERATION'>;

// ===== Transaction Types (stakeholder events) =====

/** Stakeholder Relationship Change Event output */
export type OcfStakeholderRelationshipChangeEventOutput = WithObjectType<
  OcfStakeholderRelationshipChangeEvent,
  'CE_STAKEHOLDER_RELATIONSHIP'
>;

/** Stakeholder Status Change Event output */
export type OcfStakeholderStatusChangeEventOutput = WithObjectType<
  OcfStakeholderStatusChangeEvent,
  'CE_STAKEHOLDER_STATUS'
>;

// ===== Discriminated Union =====

/**
 * Union of all OCF output types.
 *
 * Discriminated by the `object_type` field, enabling exhaustive pattern matching.
 *
 * @example
 * ```typescript
 * function processEntity(entity: OcfObject) {
 *   switch (entity.object_type) {
 *     case 'ISSUER':
 *       return entity.legal_name;
 *     case 'STAKEHOLDER':
 *       return entity.name.legal_name;
 *     case 'TX_STOCK_ISSUANCE':
 *       return entity.quantity;
 *     // ... TypeScript will warn about unhandled cases
 *   }
 * }
 * ```
 */
export type OcfObject =
  // Objects
  | OcfIssuerOutput
  | OcfStakeholderOutput
  | OcfStockClassOutput
  | OcfStockLegendTemplateOutput
  | OcfStockPlanOutput
  | OcfVestingTermsOutput
  | OcfValuationOutput
  | OcfDocumentOutput
  // Issuances
  | OcfStockIssuanceOutput
  | OcfEquityCompensationIssuanceOutput
  | OcfWarrantIssuanceOutput
  | OcfConvertibleIssuanceOutput
  // Transfers
  | OcfStockTransferOutput
  | OcfWarrantTransferOutput
  | OcfConvertibleTransferOutput
  | OcfEquityCompensationTransferOutput
  // Cancellations
  | OcfStockCancellationOutput
  | OcfWarrantCancellationOutput
  | OcfConvertibleCancellationOutput
  | OcfEquityCompensationCancellationOutput
  // Exercises
  | OcfEquityCompensationExerciseOutput
  | OcfWarrantExerciseOutput
  // Conversions
  | OcfStockConversionOutput
  | OcfConvertibleConversionOutput
  // Acceptances
  | OcfStockAcceptanceOutput
  | OcfWarrantAcceptanceOutput
  | OcfConvertibleAcceptanceOutput
  | OcfEquityCompensationAcceptanceOutput
  // Adjustments
  | OcfIssuerAuthorizedSharesAdjustmentOutput
  | OcfStockClassAuthorizedSharesAdjustmentOutput
  | OcfStockClassConversionRatioAdjustmentOutput
  | OcfStockClassSplitOutput
  | OcfStockPlanPoolAdjustmentOutput
  // Other
  | OcfStockRepurchaseOutput
  | OcfStockConsolidationOutput
  | OcfStockReissuanceOutput
  // Vesting
  | OcfVestingStartOutput
  | OcfVestingEventOutput
  | OcfVestingAccelerationOutput
  // Stakeholder Events
  | OcfStakeholderRelationshipChangeEventOutput
  | OcfStakeholderStatusChangeEventOutput;
