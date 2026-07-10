/** Compile-time proof that canonical source DTOs exclude non-schema fields. */

import type {
  OcfEquityCompensationRelease,
  OcfEquityCompensationRepricing,
  OcfStakeholder,
  OcfStakeholderStatusChangeEvent,
  OcfStockClassConversionRatioAdjustment,
  OcfStockClassSplit,
  OcfStockConsolidation,
  OcfStockConversion,
} from '../../src';

declare const stakeholder: OcfStakeholder;
// @ts-expect-error canonical Stakeholder uses current_relationships
stakeholder.current_relationship;

declare const stockConversion: OcfStockConversion;
// @ts-expect-error canonical StockConversion uses quantity_converted
stockConversion.quantity;

declare const equityCompensationRelease: OcfEquityCompensationRelease;
// @ts-expect-error balance_security_id is not in the canonical release schema
equityCompensationRelease.balance_security_id;

declare const stockClassSplit: OcfStockClassSplit;
// @ts-expect-error canonical split ratios are nested
stockClassSplit.split_ratio_numerator;
// @ts-expect-error canonical split ratios are nested
stockClassSplit.split_ratio_denominator;
// @ts-expect-error split approval dates are not schema fields
stockClassSplit.board_approval_date;
// @ts-expect-error split approval dates are not schema fields
stockClassSplit.stockholder_approval_date;

declare const ratioAdjustment: OcfStockClassConversionRatioAdjustment;
// @ts-expect-error ratio-adjustment approval dates are not schema fields
ratioAdjustment.board_approval_date;
// @ts-expect-error ratio-adjustment approval dates are not schema fields
ratioAdjustment.stockholder_approval_date;

declare const stockConsolidation: OcfStockConsolidation;
// @ts-expect-error canonical StockConsolidation uses resulting_security_id
stockConsolidation.resulting_security_ids;

declare const equityCompensationRepricing: OcfEquityCompensationRepricing;
// @ts-expect-error repricing does not create replacement securities
equityCompensationRepricing.resulting_security_ids;

declare const stakeholderStatusChange: OcfStakeholderStatusChangeEvent;
// @ts-expect-error canonical status changes use comments for free-form text
stakeholderStatusChange.reason_text;
