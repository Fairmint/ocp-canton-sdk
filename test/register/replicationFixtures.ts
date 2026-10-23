/**
 * Books for the replication tests: one assembled from the anonymized production fixtures (every definition, stock with
 * a 10:1 split, the three equity-compensation grants with a vesting start and an exercise, a warrant, two
 * convertibles, the class, issuer and plan adjustments, a valuation, a document, a financing and a stock transfer with
 * two resulting securities and a balance), its references and quantities made consistent; and a small one for the
 * correction cases.
 */

import { type RegisterIndex } from '../../src/register/registerIndex';
import type { OcfIssuer } from '../../src/types/native';
import type { OcfManifest } from '../../src/utils/cantonOcfExtractor';
import { loadFixture } from '../utils/productionFixtures';
import { manifestOf, type OcfJson } from './replayFixtures';
import type { SimulatedLedger } from './simulatedLedger';

export const COMMON = 'test-stock-class-common-001';
export const INDIVIDUAL = 'test-stakeholder-individual-001';
export const INSTITUTION = 'test-stakeholder-institution-001';
export const FOUNDERS = 'test-security-founders-001';
export const FOUNDERS_ISSUANCE = 'test-stock-issuance-founders-001';
export const SPLIT_ID = 'test-stock-class-split-001';

function fixture(path: string, overrides: OcfJson = {}): OcfJson {
  return { ...loadFixture<OcfJson>(`production/${path}`), ...overrides };
}

/** The issuer the cap table is created with, its authorized shares above the book's stock. */
export function productionIssuer(): OcfIssuer {
  return fixture('issuer/with-full-details.json', { initial_shares_authorized: '100000000' }) as unknown as OcfIssuer;
}

/** An output issuance of the transfer, dated on it. */
function transferOutput(n: string, securityId: string, stakeholderId: string, quantity: string): OcfJson {
  const {
    cost_basis: _basis,
    consideration_text: _text,
    issuance_type: _type,
    ...founders
  } = fixture('stockIssuance/founders-stock.json');
  return {
    ...founders,
    id: `test-stock-issuance-transfer-${n}`,
    date: '2025-03-15',
    security_id: securityId,
    custom_id: `CS-1${n}`,
    stakeholder_id: stakeholderId,
    quantity,
  };
}

/** The production book's records, in no particular order. */
export function productionRecords(): OcfJson[] {
  return [
    productionIssuer(),
    fixture('stakeholder/individual.json'),
    fixture('stakeholder/institution.json'),
    fixture('stockClass/common.json'),
    fixture('stockClass/preferred.json'),
    fixture('stockLegendTemplate/rule-144.json'),
    fixture('vestingTerms/time-based-cliff.json'),
    fixture('stockPlan/basic.json'),
    fixture('valuation/409a.json'),
    fixture('document/basic.json'),
    fixture('stockIssuance/founders-stock.json', {
      quantity: '1000000',
      cost_basis: { amount: '100', currency: 'USD' },
    }),
    fixture('stockIssuance/with-vesting.json'),
    fixture('stockClassSplit.json'),
    fixture('convertibleIssuance/convertible-note.json'),
    fixture('convertibleIssuance/safe-post-money.json'),
    fixture('equityCompensationIssuance/option-iso.json'),
    fixture('vestingStart.json'),
    fixture('equityCompensationIssuance/option-nso.json'),
    fixture('equityCompensationIssuance/rsu.json'),
    fixture('warrantIssuance.json'),
    fixture('stockClassAuthorizedSharesAdjustment.json'),
    fixture('issuerAuthorizedSharesAdjustment.json'),
    fixture('stockPlanPoolAdjustment.json'),
    fixture('equityCompensationExercise.json'),
    {
      ...transferOutput('exercised', 'test-security-exercised-shares-001', INDIVIDUAL, '10000'),
      id: 'test-stock-issuance-exercised-001',
      custom_id: 'CS-201',
      date: '2025-03-01',
    },
    fixture('stockTransfer.json', { security_id: FOUNDERS }),
    transferOutput('result-001', 'test-security-transfer-result-001', INSTITUTION, '30000'),
    transferOutput('result-002', 'test-security-transfer-result-002', INSTITUTION, '20000'),
    transferOutput('balance-001', 'test-security-transfer-balance-001', INDIVIDUAL, '9950000'),
    fixture('financing/basic.json', { issuance_ids: [FOUNDERS_ISSUANCE, 'test-convertible-safe-001'] }),
  ];
}

/** The production book as a source manifest. */
export function productionBook(): OcfManifest {
  return manifestOf(productionRecords());
}

/** A writer's index brought current from the simulated ledger. */
export async function currentIndex(ledger: SimulatedLedger): Promise<RegisterIndex> {
  const writer = ledger.writer();
  await writer.refresh();
  return writer.index;
}
