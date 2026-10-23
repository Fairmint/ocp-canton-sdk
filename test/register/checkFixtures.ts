/**
 * Books and records for the off-ledger checks tests: the `TestBook` of the inputs tests with class CLS-A capped at 100
 * shares and S-A1 holding 90 of them, plus builders for the class-, issuer- and plan-level records and the warrant and
 * equity-compensation lifecycle the checks read.
 */

import type {
  Monetary,
  OcfEquityCompensationCancellation,
  OcfEquityCompensationExercise,
  OcfEquityCompensationIssuance,
  OcfEquityCompensationRepricing,
  OcfIssuer,
  OcfIssuerAuthorizedSharesAdjustment,
  OcfStockClassAuthorizedSharesAdjustment,
  OcfStockIssuance,
  OcfStockPlanPoolAdjustment,
  OcfStockPlanReturnToPool,
  OcfWarrantExercise,
  OcfWarrantIssuance,
} from '../../src/types/native';
import type { RegisterCheckViolation } from '../../src/types/register';
import { stakeholder, stockClass, stockIssuance, stockState, TestBook, warrantIssuance } from './bookFixtures';

/** The ledger date of every check test. */
export const TODAY = '2026-10-23';
export const CHECKS = { today: TODAY } as const;

export const usd = (amount: string): Monetary => ({ amount, currency: 'USD' });

/** Stakeholders SH-A and SH-B, class CLS-A with `authorized` shares (100), and S-A1 holding `quantity` (90) of them. */
export function ceilingBook(options: { authorized?: string; quantity?: string } = {}): TestBook {
  const quantity = options.quantity ?? '90';
  return new TestBook()
    .record('stakeholder', stakeholder('SH-A'))
    .record('stakeholder', stakeholder('SH-B'))
    .record('stockClass', { ...stockClass('CLS-A'), initial_shares_authorized: options.authorized ?? '100' })
    .epoch('CLS-A')
    .record('stockIssuance', stockIssuance({ quantity }))
    .state(stockState({ quantity }));
}

/** A primary issuance of `securityId` to SH-A in CLS-A. */
export function issue(
  securityId: string,
  quantity: string,
  date = TODAY,
  overrides: Partial<OcfStockIssuance> = {}
): OcfStockIssuance {
  return stockIssuance({
    id: `ISS-${securityId}`,
    security_id: securityId,
    custom_id: `CS-${securityId}`,
    quantity,
    date,
    ...overrides,
  });
}

export function classAdjustment(
  id: string,
  stockClassId: string,
  shares: string,
  date: string
): OcfStockClassAuthorizedSharesAdjustment {
  return {
    object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
    id,
    date,
    stock_class_id: stockClassId,
    new_shares_authorized: shares,
  };
}

export function issuerRecord(authorized?: string): OcfIssuer {
  return {
    object_type: 'ISSUER',
    id: 'ISSUER-1',
    legal_name: 'Test Issuer Inc.',
    formation_date: '2020-01-15',
    country_of_formation: 'US',
    ...(authorized === undefined ? {} : { initial_shares_authorized: authorized }),
  };
}

export function issuerAdjustment(id: string, shares: string, date: string): OcfIssuerAuthorizedSharesAdjustment {
  return {
    object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
    id,
    date,
    issuer_id: 'ISSUER-1',
    new_shares_authorized: shares,
  };
}

export function poolAdjustment(id: string, planId: string, shares: string, date: string): OcfStockPlanPoolAdjustment {
  return { object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT', id, date, stock_plan_id: planId, shares_reserved: shares };
}

export function returnToPool(
  id: string,
  securityId: string,
  planId: string,
  quantity: string,
  date: string
): OcfStockPlanReturnToPool {
  return {
    object_type: 'TX_STOCK_PLAN_RETURN_TO_POOL',
    id,
    date,
    security_id: securityId,
    stock_plan_id: planId,
    quantity,
    reason_text: 'Forfeited on termination',
  };
}

/** An option grant to SH-A in class CLS-A. */
export function option(
  securityId: string,
  quantity: string,
  overrides: Partial<OcfEquityCompensationIssuance> = {}
): OcfEquityCompensationIssuance {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: `ECI-${securityId}`,
    date: '2024-02-01',
    security_id: securityId,
    custom_id: `OPT-${securityId}`,
    stakeholder_id: 'SH-A',
    stock_class_id: 'CLS-A',
    compensation_type: 'OPTION_NSO',
    quantity,
    exercise_price: usd('1'),
    expiration_date: '2030-01-01',
    termination_exercise_windows: [],
    security_law_exemptions: [],
    ...overrides,
  };
}

export function optionExercise(
  id: string,
  securityId: string,
  quantity: string,
  date: string,
  resulting: string[] = []
): OcfEquityCompensationExercise {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_EXERCISE',
    id,
    date,
    security_id: securityId,
    quantity,
    resulting_security_ids: resulting,
  };
}

export function optionCancellation(
  id: string,
  securityId: string,
  quantity: string,
  date: string
): OcfEquityCompensationCancellation {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    id,
    date,
    security_id: securityId,
    quantity,
    reason_text: 'Terminated',
  };
}

export function repricing(id: string, securityId: string, date: string): OcfEquityCompensationRepricing {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_REPRICING',
    id,
    date,
    security_id: securityId,
    new_exercise_price: usd('0.5'),
  };
}

/** A warrant to SH-A exercisable through trigger T-1, expiring on 2030-01-01. */
export function warrant(securityId: string, overrides: Partial<OcfWarrantIssuance> = {}): OcfWarrantIssuance {
  return warrantIssuance(`WI-${securityId}`, securityId, {
    warrant_expiration_date: '2030-01-01',
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL',
        trigger_id: 'T-1',
        conversion_right: {
          type: 'WARRANT_CONVERSION_RIGHT',
          conversion_mechanism: {
            type: 'CUSTOM_CONVERSION',
            custom_conversion_description: 'Exercisable for the shares the board determines',
          },
        },
      },
    ],
    ...overrides,
  });
}

export function warrantExercise(id: string, securityId: string, date: string, resulting: string[]): OcfWarrantExercise {
  return {
    object_type: 'TX_WARRANT_EXERCISE',
    id,
    date,
    security_id: securityId,
    trigger_id: 'T-1',
    resulting_security_ids: resulting,
  };
}

/** The rules of a list of violations, in order. */
export function rulesOf(violations: readonly RegisterCheckViolation[]): string[] {
  return violations.map((violation) => violation.rule);
}
