/**
 * Tests for OcpContextManager context caching functionality.
 */
import { OcpContextManager } from '../../src/OcpClient';

describe('OcpContextManager', () => {
  let contextManager: OcpContextManager;

  beforeEach(() => {
    contextManager = new OcpContextManager();
  });

  describe('initial state', () => {
    it('should have null values for all properties initially', () => {
      expect(contextManager.issuerParty).toBeNull();
      expect(contextManager.capTableContractId).toBeNull();
    });

    it('should not be ready for batch operations initially', () => {
      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });
  });

  describe('setIssuerParty', () => {
    it('should set issuerParty', () => {
      contextManager.setIssuerParty('issuer::party-123');
      expect(contextManager.issuerParty).toBe('issuer::party-123');
    });

    it('should overwrite existing issuerParty', () => {
      contextManager.setIssuerParty('issuer::party-123');
      contextManager.setIssuerParty('issuer::party-456');
      expect(contextManager.issuerParty).toBe('issuer::party-456');
    });
  });

  describe('setCapTableContractId', () => {
    it('should set capTableContractId', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.capTableContractId).toBe('captable-contract-789');
    });

    it('should overwrite existing capTableContractId', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      contextManager.setCapTableContractId('captable-contract-999');
      expect(contextManager.capTableContractId).toBe('captable-contract-999');
    });
  });

  describe('setAll', () => {
    it('should set all values at once', () => {
      contextManager.setAll({
        issuerParty: 'issuer::party-123',
        capTableContractId: 'captable-contract-789',
      });

      expect(contextManager.issuerParty).toBe('issuer::party-123');
      expect(contextManager.capTableContractId).toBe('captable-contract-789');
    });

    it('should allow partial updates', () => {
      contextManager.setIssuerParty('issuer::existing-party');
      contextManager.setAll({
        capTableContractId: 'captable-contract-789',
      });

      expect(contextManager.issuerParty).toBe('issuer::existing-party');
      expect(contextManager.capTableContractId).toBe('captable-contract-789');
    });

    it('should allow setting null values explicitly', () => {
      contextManager.setIssuerParty('issuer::party-123');
      contextManager.setAll({
        issuerParty: null,
      });

      expect(contextManager.issuerParty).toBeNull();
    });

    it('should not change values when undefined is passed', () => {
      contextManager.setIssuerParty('issuer::party-123');
      contextManager.setAll({
        issuerParty: undefined,
      });

      expect(contextManager.issuerParty).toBe('issuer::party-123');
    });
  });

  describe('requireIssuerParty', () => {
    it('should return issuerParty when set', () => {
      contextManager.setIssuerParty('issuer::party-123');
      expect(contextManager.requireIssuerParty()).toBe('issuer::party-123');
    });

    it('should throw when issuerParty is not set', () => {
      expect(() => contextManager.requireIssuerParty()).toThrow(
        'Issuer party not set. Call context.setIssuerParty() first.'
      );
    });
  });

  describe('requireCapTableContractId', () => {
    it('should return capTableContractId when set', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.requireCapTableContractId()).toBe('captable-contract-789');
    });

    it('should throw when capTableContractId is not set', () => {
      expect(() => contextManager.requireCapTableContractId()).toThrow(
        'Cap table contract ID not set. Call context.setCapTableContractId() first.'
      );
    });
  });

  describe('clear', () => {
    it('should clear all values', () => {
      contextManager.setIssuerParty('issuer::party-123');
      contextManager.setCapTableContractId('captable-contract-789');

      contextManager.clear();

      expect(contextManager.issuerParty).toBeNull();
      expect(contextManager.capTableContractId).toBeNull();
    });

    it('should make context not ready for batch operations after clear', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.isReadyForBatchOperations()).toBe(true);

      contextManager.clear();

      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });
  });

  describe('isReadyForBatchOperations', () => {
    it('should return false when capTableContractId is not set', () => {
      contextManager.setIssuerParty('issuer::party-123');
      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });

    it('should return true when capTableContractId is set', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.isReadyForBatchOperations()).toBe(true);
    });

    it('should return true regardless of issuerParty', () => {
      contextManager.setCapTableContractId('captable-contract-789');

      expect(contextManager.isReadyForBatchOperations()).toBe(true);

      contextManager.setIssuerParty('issuer::party-123');
      expect(contextManager.isReadyForBatchOperations()).toBe(true);
    });
  });
});

describe('OcpContextManager implements OcpContext interface', () => {
  it('should expose all properties defined in OcpContext', () => {
    const contextManager = new OcpContextManager();

    expect('issuerParty' in contextManager).toBe(true);
    expect('capTableContractId' in contextManager).toBe(true);
  });
});
