import { OcpValidationError } from '../../src/errors';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { equityCompensationReleaseDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationRelease/equityCompensationReleaseDataToDaml';
import { stockConversionDataToDaml } from '../../src/functions/OpenCapTable/stockConversion/stockConversionDataToDaml';
import type {
  OcfConvertibleConversion,
  OcfEquityCompensationRelease,
  OcfStockConversion,
} from '../../src/types/native';

describe('Direct data-to-DAML converter validation', () => {
  test('convertibleConversionDataToDaml validates required reason_text and trigger_id', () => {
    const missingReasonText = {
      id: 'cc-001',
      date: '2024-01-15',
      security_id: 'sec-1',
      trigger_id: 'trigger-1',
      resulting_security_ids: ['result-1'],
    } as unknown as OcfConvertibleConversion;
    expect(() => convertibleConversionDataToDaml(missingReasonText)).toThrow(OcpValidationError);

    const missingTriggerId = {
      id: 'cc-001',
      date: '2024-01-15',
      reason_text: 'Auto conversion',
      security_id: 'sec-1',
      resulting_security_ids: ['result-1'],
    } as unknown as OcfConvertibleConversion;
    expect(() => convertibleConversionDataToDaml(missingTriggerId)).toThrow(OcpValidationError);
  });

  test('equityCompensationReleaseDataToDaml validates required release fields', () => {
    const missingReleasePrice = {
      id: 'ecr-001',
      date: '2024-01-15',
      security_id: 'sec-1',
      quantity: '10',
      settlement_date: '2024-01-16',
      resulting_security_ids: ['result-1'],
    } as unknown as OcfEquityCompensationRelease;
    expect(() => equityCompensationReleaseDataToDaml(missingReleasePrice)).toThrow(OcpValidationError);

    const missingSettlementDate = {
      id: 'ecr-001',
      date: '2024-01-15',
      security_id: 'sec-1',
      quantity: '10',
      release_price: { amount: '1.25', currency: 'USD' },
      resulting_security_ids: ['result-1'],
    } as unknown as OcfEquityCompensationRelease;
    expect(() => equityCompensationReleaseDataToDaml(missingSettlementDate)).toThrow(OcpValidationError);
  });

  test('stockConversionDataToDaml validates required security_id and quantity_converted', () => {
    const missingSecurityId = {
      id: 'sc-001',
      date: '2024-01-15',
      quantity_converted: '10',
      resulting_security_ids: ['result-1'],
    } as unknown as OcfStockConversion;
    expect(() => stockConversionDataToDaml(missingSecurityId)).toThrow(OcpValidationError);

    const missingQuantityConverted = {
      id: 'sc-001',
      date: '2024-01-15',
      security_id: 'sec-1',
      resulting_security_ids: ['result-1'],
    } as unknown as OcfStockConversion;
    expect(() => stockConversionDataToDaml(missingQuantityConverted)).toThrow(OcpValidationError);
  });
});
