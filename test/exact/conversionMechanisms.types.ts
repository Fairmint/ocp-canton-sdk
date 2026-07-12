/** exactOptionalPropertyTypes contracts for source and emitted conversion types. */

import type {
  PersistedWarrantValuationBasedConversionMechanism as BuiltPersistedValuation,
  ValuationBasedConversionMechanism as BuiltValuation,
} from '../../dist';
import type {
  PersistedWarrantValuationBasedConversionMechanism as SourcePersistedValuation,
  ValuationBasedConversionMechanism as SourceValuation,
} from '../../src';

const sourceActual: SourceValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
// @ts-expect-error an omitted canonical amount is distinct from explicit undefined
const sourceActualWithUndefined: SourceValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
  valuation_amount: undefined,
};
// @ts-expect-error v34 persistence requires a concrete ACTUAL amount
const sourcePersistedActual: SourcePersistedValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};

const builtActual: BuiltValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
// @ts-expect-error emitted declarations preserve omitted-versus-undefined semantics
const builtActualWithUndefined: BuiltValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
  valuation_amount: undefined,
};
// @ts-expect-error emitted v34 persistence declarations require a concrete ACTUAL amount
const builtPersistedActual: BuiltPersistedValuation = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};

void sourceActual;
void sourceActualWithUndefined;
void sourcePersistedActual;
void builtActual;
void builtActualWithUndefined;
void builtPersistedActual;
