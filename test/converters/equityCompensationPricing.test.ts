/**
 * OCF EquityCompensationIssuance pricing: options require `exercise_price`, SARs require `base_price`, RSUs
 * require neither, and no type forbids the other price. The same rule applies on write and on ledger read.
 */

import { OcpErrorCodes } from '../../src/errors';
import {
  compensationTypeToDaml,
  equityCompensationIssuanceDataToDaml,
} from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { damlEquityCompensationIssuanceDataToNative } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import type { CompensationType } from '../../src/types/native';

const PRICE = { amount: '1.5', currency: 'USD' };

function ledgerRecord(compensationType: CompensationType, prices: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'eci-1',
    date: '2024-01-15',
    security_id: 'security-1',
    custom_id: 'EC-1',
    stakeholder_id: 'stakeholder-1',
    compensation_type: compensationTypeToDaml(compensationType),
    quantity: '1000',
    exercise_price: null,
    base_price: null,
    expiration_date: null,
    board_approval_date: null,
    stockholder_approval_date: null,
    termination_exercise_windows: [],
    security_law_exemptions: [],
    comments: [],
    ...prices,
  };
}

function writeInput(compensationType: CompensationType, prices: Record<string, unknown>) {
  return {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    id: 'eci-1',
    date: '2024-01-15',
    security_id: 'security-1',
    custom_id: 'EC-1',
    stakeholder_id: 'stakeholder-1',
    compensation_type: compensationType,
    quantity: '1000',
    expiration_date: null,
    termination_exercise_windows: [],
    security_law_exemptions: [],
    ...prices,
  } as unknown as Parameters<typeof equityCompensationIssuanceDataToDaml>[0];
}

const OPTIONS: CompensationType[] = ['OPTION', 'OPTION_ISO', 'OPTION_NSO'];
const SARS: CompensationType[] = ['CSAR', 'SSAR'];

const MISSING: Array<{ compensationType: CompensationType; field: 'exercise_price' | 'base_price'; value: unknown }> = [
  ...OPTIONS.flatMap((compensationType) => [
    { compensationType, field: 'exercise_price' as const, value: undefined },
    { compensationType, field: 'exercise_price' as const, value: null },
  ]),
  ...SARS.flatMap((compensationType) => [
    { compensationType, field: 'base_price' as const, value: undefined },
    { compensationType, field: 'base_price' as const, value: null },
  ]),
];

const ACCEPTED: Array<{ compensationType: CompensationType; prices: Record<string, unknown> }> = [
  ...OPTIONS.map((compensationType) => ({ compensationType, prices: { exercise_price: PRICE } })),
  ...OPTIONS.map((compensationType) => ({ compensationType, prices: { exercise_price: PRICE, base_price: PRICE } })),
  ...SARS.map((compensationType) => ({ compensationType, prices: { base_price: PRICE } })),
  ...SARS.map((compensationType) => ({ compensationType, prices: { exercise_price: PRICE, base_price: PRICE } })),
  { compensationType: 'RSU', prices: {} },
  { compensationType: 'RSU', prices: { exercise_price: PRICE, base_price: PRICE } },
];

describe('equity compensation pricing (OCF anyOf on compensation_type)', () => {
  describe('ledger read', () => {
    it.each(MISSING)('rejects $compensationType with $field = $value', ({ compensationType, field, value }) => {
      const record = ledgerRecord(compensationType, { [field]: value });
      if (value === undefined) delete record[field];
      expect(() => damlEquityCompensationIssuanceDataToNative(record)).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `equityCompensationIssuance.${field}`,
        })
      );
    });

    it.each(ACCEPTED)('accepts $compensationType with prices $prices', ({ compensationType, prices }) => {
      const native = damlEquityCompensationIssuanceDataToNative(ledgerRecord(compensationType, prices));
      expect(native.compensation_type).toBe(compensationType);
    });
  });

  describe('write', () => {
    it.each(MISSING)('rejects $compensationType with $field = $value', ({ compensationType, field, value }) => {
      expect(() => equityCompensationIssuanceDataToDaml(writeInput(compensationType, { [field]: value }))).toThrow(
        expect.objectContaining({
          code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
          fieldPath: `equityCompensationIssuance.${field}`,
        })
      );
    });

    it.each(ACCEPTED)('accepts $compensationType with prices $prices', ({ compensationType, prices }) => {
      expect(() => equityCompensationIssuanceDataToDaml(writeInput(compensationType, prices))).not.toThrow();
    });

    it.each([0, '', false, 'USD 1', { amount: '1' }])('rejects a malformed exercise_price %p', (value) => {
      expect(() => equityCompensationIssuanceDataToDaml(writeInput('OPTION', { exercise_price: value }))).toThrow(
        expect.objectContaining({
          fieldPath: expect.stringMatching(/^equityCompensationIssuance\.exercise_price/),
        })
      );
    });
  });
});
