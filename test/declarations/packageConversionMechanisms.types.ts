/** Conversion contracts resolved through the package's published entry point. */

import type {
  NoteConversionMechanism,
  OcfWarrantIssuance,
  OcfWritableDataTypeFor,
  PersistedWarrantConversionMechanism,
  PersistedWarrantConversionRight,
  PersistedWarrantValuationBasedConversionMechanism,
  ValuationBasedConversionMechanism,
  WarrantConversionMechanism,
  WarrantConversionRight,
} from '@open-captable-protocol/canton';
import type {
  ConversionMechanismContract,
  ConversionMechanismContractTypes,
} from '../typeContracts/conversionMechanisms';
import type { Assert } from '../typeContracts/typeAssertions';

interface PackageConversionTypes extends ConversionMechanismContractTypes {
  valuation: ValuationBasedConversionMechanism;
  persistedValuation: PersistedWarrantValuationBasedConversionMechanism;
  note: NoteConversionMechanism;
  warrantMechanism: WarrantConversionMechanism;
  persistedWarrantMechanism: PersistedWarrantConversionMechanism;
  warrantRight: WarrantConversionRight;
  persistedWarrantRight: PersistedWarrantConversionRight;
}

const packageConversionTypesAreExact: Assert<ConversionMechanismContract<PackageConversionTypes>> = true;

const schemaActualWithoutAmount: ValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};
const schemaNoteWithoutInterestRates: NoteConversionMechanism = {
  type: 'CONVERTIBLE_NOTE_CONVERSION',
  interest_rates: [],
  day_count_convention: 'ACTUAL_365',
  interest_payout: 'DEFERRED',
  interest_accrual_period: 'ANNUAL',
  compounding_type: 'SIMPLE',
};

// @ts-expect-error the v34 warrant validator rejects a missing ACTUAL amount
const persistedActualWithoutAmount: PersistedWarrantValuationBasedConversionMechanism = {
  type: 'VALUATION_BASED_CONVERSION',
  valuation_type: 'ACTUAL',
};

const canonicalDeferredActualIssuance = {
  object_type: 'TX_WARRANT_ISSUANCE',
  id: 'deferred-actual',
  date: '2026-01-01',
  security_id: 'warrant-security',
  custom_id: 'W-ACTUAL',
  stakeholder_id: 'stakeholder',
  security_law_exemptions: [],
  purchase_price: { amount: '1', currency: 'USD' },
  exercise_triggers: [
    {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'actual-trigger',
      conversion_right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'VALUATION_BASED_CONVERSION',
          valuation_type: 'ACTUAL',
        },
      },
    },
  ],
} satisfies OcfWarrantIssuance;

// @ts-expect-error published batch writes require the deferred ACTUAL amount to be resolved
const unwritableDeferredActualIssuance: OcfWritableDataTypeFor<'warrantIssuance'> = canonicalDeferredActualIssuance;

void packageConversionTypesAreExact;
void schemaActualWithoutAmount;
void schemaNoteWithoutInterestRates;
void persistedActualWithoutAmount;
void unwritableDeferredActualIssuance;
