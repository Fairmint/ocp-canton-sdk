/** Compile-time contracts for the price fields OCF requires per compensation type. */

import type { OcfEquityCompensationIssuance } from '../../dist';

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

// @ts-expect-error built declarations require option exercise prices
const optionWithoutExercisePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'OPTION_NSO',
};

// @ts-expect-error built declarations require SAR base prices
const sarWithoutBasePrice: OcfEquityCompensationIssuance = {
  ...commonIssuance,
  compensation_type: 'SSAR',
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
void priceAmount;
