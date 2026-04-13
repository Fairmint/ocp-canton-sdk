import { OcpErrorCodes } from '../../src/errors/codes';
import { OcpContractError } from '../../src/errors/OcpContractError';
import { OcpParseError } from '../../src/errors/OcpParseError';
import { classifyContractReadFailure } from '../../src/utils/contractReadDiagnostics';

describe('contractReadDiagnostics', () => {
  describe('classifyContractReadFailure', () => {
    it('classifies OcpParseError by code as schema', () => {
      const err = new OcpParseError('Issuer data not found in contract create argument', {
        source: 'x',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
      });
      expect(classifyContractReadFailure(err)).toBe('schema');
    });

    it('does not treat parse/schema messages as not_found when only a generic Error', () => {
      const err = new Error('StockClass data not found in contract create argument');
      expect(classifyContractReadFailure(err)).toBe('schema');
    });

    it('classifies contract_events_not_found string as not_found', () => {
      expect(classifyContractReadFailure(new Error('CONTRACT_EVENTS_NOT_FOUND'))).toBe('not_found');
    });

    it('classifies OcpContractError CONTRACT_NOT_FOUND as not_found', () => {
      const err = new OcpContractError('missing', { code: OcpErrorCodes.CONTRACT_NOT_FOUND });
      expect(classifyContractReadFailure(err)).toBe('not_found');
    });
  });
});
