import { OcpErrorCodes } from '../../src/errors/codes';
import { OcpContractError } from '../../src/errors/OcpContractError';
import { OcpParseError } from '../../src/errors/OcpParseError';
import {
  analyzeContractReadFailure,
  classifyContractReadFailure,
  createDiagnosedContractReadError,
} from '../../src/utils/contractReadDiagnostics';

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

  describe('analyzeContractReadFailure', () => {
    it('marks generic connection failures as retryable when classified as network', () => {
      const outcome = analyzeContractReadFailure(new Error('connect ECONNREFUSED 127.0.0.1:7575'));
      expect(outcome.classification).toBe('network');
      expect(outcome.retryable).toBe(true);
      expect(outcome.benignMissing).toBe(false);
    });
  });

  describe('createDiagnosedContractReadError', () => {
    it('sets classification, context, and diagnostics on the thrown contract error', () => {
      const cause = new Error('ledger boom');
      const err = createDiagnosedContractReadError({
        message: 'Failed to fetch issuer (visibility)',
        code: OcpErrorCodes.AUTHORIZATION_FAILED,
        contractId: 'cid-1',
        cause,
        diagnostics: {
          classification: 'visibility',
          operation: 'getEventsByContractId',
          contractId: 'cid-1',
          entityType: 'issuer',
          issuerPartyId: 'alice::issuer',
        },
      });

      expect(err).toBeInstanceOf(OcpContractError);
      expect(err.message).toBe('Failed to fetch issuer (visibility)');
      expect(err.code).toBe(OcpErrorCodes.AUTHORIZATION_FAILED);
      expect(err.cause).toBe(cause);
      expect(err.classification).toBe('visibility');
      expect(err.context).toEqual({
        classification: 'visibility',
        operation: 'getEventsByContractId',
        contractId: 'cid-1',
        entityType: 'issuer',
        issuerPartyId: 'alice::issuer',
      });
      expect(err.diagnostics.entityType).toBe('issuer');
    });
  });
});
