/** Compile-time contracts for compensation-specific equity issuance pricing. */

import type { OcfEquityCompensationIssuance } from '../../src';

const commonIssuance = {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
  id: 'issuance-1',
  date: '2026-01-01',
  security_id: 'security-1',
  custom_id: 'EQ-1',
  stakeholder_id: 'stakeholder-1',
  quantity: '100',
  security_law_exemptions: [],
  expiration_date: null,
  termination_exercise_windows: [],
};

const optionIssuance: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'OPTION_ISO',
  exercise_price: { amount: '1', currency: 'USD' },
};

const sarIssuance: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'CSAR',
  base_price: { amount: '2', currency: 'USD' },
};

const rsuIssuance: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'RSU',
};

// @ts-expect-error options require an exercise price
const optionWithoutExercisePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'OPTION_NSO',
};

// @ts-expect-error SARs require a base price
const sarWithoutBasePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'SSAR',
};

// @ts-expect-error options cannot carry a SAR base price
const optionWithBasePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'OPTION',
  exercise_price: { amount: '1', currency: 'USD' },
  base_price: { amount: '2', currency: 'USD' },
};

// @ts-expect-error SARs cannot carry an option exercise price
const sarWithExercisePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'CSAR',
  base_price: { amount: '2', currency: 'USD' },
  exercise_price: { amount: '1', currency: 'USD' },
};

// @ts-expect-error RSUs cannot carry pricing fields
const rsuWithExercisePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'RSU',
  exercise_price: { amount: '1', currency: 'USD' },
};

const optionWithDeprecatedGrantType: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'OPTION_ISO',
  exercise_price: { amount: '1', currency: 'USD' },
  // @ts-expect-error canonical issuances do not expose deprecated option_grant_type
  option_grant_type: 'ISO',
};

function priceAmount(issuance: OcfEquityCompensationIssuance): string | undefined {
  switch (issuance.compensation_type) {
    case 'OPTION':
    case 'OPTION_ISO':
    case 'OPTION_NSO':
      return issuance.exercise_price.amount;
    case 'CSAR':
    case 'SSAR':
      return issuance.base_price.amount;
    case 'RSU':
      return undefined;
  }
}

void optionIssuance;
void sarIssuance;
void rsuIssuance;
void optionWithoutExercisePrice;
void sarWithoutBasePrice;
void optionWithBasePrice;
void sarWithExercisePrice;
void rsuWithExercisePrice;
void optionWithDeprecatedGrantType;
void priceAmount;
