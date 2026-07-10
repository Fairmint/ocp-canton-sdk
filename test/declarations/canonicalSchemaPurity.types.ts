/** Compile-time proof that built declarations exclude non-schema fields. */

import type {
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfStakeholder,
  OcfStakeholderStatusChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
} from '../../dist';

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
