/**
 * Tests for OcpContextManager context caching functionality.
 */
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { OcpContextManager } from '../../src/OcpClient';

describe('OcpContextManager', () => {
  let contextManager: OcpContextManager;

  beforeEach(() => {
    contextManager = new OcpContextManager();
  });

  describe('initial state', () => {
    it('should have null values for all properties initially', () => {
      expect(contextManager.featuredAppRight).toBeNull();
      expect(contextManager.issuerParty).toBeNull();
      expect(contextManager.capTableContractId).toBeNull();
    });

    it('should not be ready for batch operations initially', () => {
      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });
  });

  describe('setFeaturedAppRight', () => {
    const mockDisclosedContract: DisclosedContract = {
      templateId: 'FeaturedAppRights:FeaturedAppRight',
      contractId: 'contract-123',
      createdEventBlob: 'blob-data',
      synchronizerId: 'sync-1',
    };

    it('should set featuredAppRight', () => {
      contextManager.setFeaturedAppRight(mockDisclosedContract);
      expect(contextManager.featuredAppRight).toEqual(mockDisclosedContract);
    });

    it('should overwrite existing featuredAppRight', () => {
      const anotherContract: DisclosedContract = {
        templateId: 'FeaturedAppRights:FeaturedAppRight',
        contractId: 'contract-456',
        createdEventBlob: 'new-blob',
        synchronizerId: 'sync-2',
      };

      contextManager.setFeaturedAppRight(mockDisclosedContract);
      contextManager.setFeaturedAppRight(anotherContract);
      expect(contextManager.featuredAppRight).toEqual(anotherContract);
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
    const mockDisclosedContract: DisclosedContract = {
      templateId: 'FeaturedAppRights:FeaturedAppRight',
      contractId: 'contract-123',
      createdEventBlob: 'blob-data',
      synchronizerId: 'sync-1',
    };

    it('should set all values at once', () => {
      contextManager.setAll({
        featuredAppRight: mockDisclosedContract,
        issuerParty: 'issuer::party-123',
        capTableContractId: 'captable-contract-789',
      });

      expect(contextManager.featuredAppRight).toEqual(mockDisclosedContract);
      expect(contextManager.issuerParty).toBe('issuer::party-123');
      expect(contextManager.capTableContractId).toBe('captable-contract-789');
    });

    it('should allow partial updates', () => {
      contextManager.setIssuerParty('issuer::existing-party');
      contextManager.setAll({
        featuredAppRight: mockDisclosedContract,
      });

      expect(contextManager.featuredAppRight).toEqual(mockDisclosedContract);
      expect(contextManager.issuerParty).toBe('issuer::existing-party');
      expect(contextManager.capTableContractId).toBeNull();
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

      // undefined values are not applied (only non-undefined values are)
      expect(contextManager.issuerParty).toBe('issuer::party-123');
    });
  });

  describe('requireFeaturedAppRight', () => {
    const mockDisclosedContract: DisclosedContract = {
      templateId: 'FeaturedAppRights:FeaturedAppRight',
      contractId: 'contract-123',
      createdEventBlob: 'blob-data',
      synchronizerId: 'sync-1',
    };

    it('should return featuredAppRight when set', () => {
      contextManager.setFeaturedAppRight(mockDisclosedContract);
      expect(contextManager.requireFeaturedAppRight()).toEqual(mockDisclosedContract);
    });

    it('should throw when featuredAppRight is not set', () => {
      expect(() => contextManager.requireFeaturedAppRight()).toThrow(
        'FeaturedAppRight not set. Call context.setFeaturedAppRight() first.'
      );
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
      const mockDisclosedContract: DisclosedContract = {
        templateId: 'FeaturedAppRights:FeaturedAppRight',
        contractId: 'contract-123',
        createdEventBlob: 'blob-data',
        synchronizerId: 'sync-1',
      };

      contextManager.setFeaturedAppRight(mockDisclosedContract);
      contextManager.setIssuerParty('issuer::party-123');
      contextManager.setCapTableContractId('captable-contract-789');

      contextManager.clear();

      expect(contextManager.featuredAppRight).toBeNull();
      expect(contextManager.issuerParty).toBeNull();
      expect(contextManager.capTableContractId).toBeNull();
    });

    it('should make context not ready for batch operations after clear', () => {
      const mockDisclosedContract: DisclosedContract = {
        templateId: 'FeaturedAppRights:FeaturedAppRight',
        contractId: 'contract-123',
        createdEventBlob: 'blob-data',
        synchronizerId: 'sync-1',
      };

      contextManager.setFeaturedAppRight(mockDisclosedContract);
      contextManager.setCapTableContractId('captable-contract-789');

      expect(contextManager.isReadyForBatchOperations()).toBe(true);

      contextManager.clear();

      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });
  });

  describe('isReadyForBatchOperations', () => {
    const mockDisclosedContract: DisclosedContract = {
      templateId: 'FeaturedAppRights:FeaturedAppRight',
      contractId: 'contract-123',
      createdEventBlob: 'blob-data',
      synchronizerId: 'sync-1',
    };

    it('should return false when only featuredAppRight is set', () => {
      contextManager.setFeaturedAppRight(mockDisclosedContract);
      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });

    it('should return false when only capTableContractId is set', () => {
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.isReadyForBatchOperations()).toBe(false);
    });

    it('should return true when featuredAppRight and capTableContractId are both set', () => {
      contextManager.setFeaturedAppRight(mockDisclosedContract);
      contextManager.setCapTableContractId('captable-contract-789');
      expect(contextManager.isReadyForBatchOperations()).toBe(true);
    });

    it('should return true regardless of issuerParty', () => {
      contextManager.setFeaturedAppRight(mockDisclosedContract);
      contextManager.setCapTableContractId('captable-contract-789');

      // Without issuerParty
      expect(contextManager.isReadyForBatchOperations()).toBe(true);

      // With issuerParty
      contextManager.setIssuerParty('issuer::party-123');
      expect(contextManager.isReadyForBatchOperations()).toBe(true);
    });
  });
});

describe('OcpContextManager implements OcpContext interface', () => {
  it('should expose all properties defined in OcpContext', () => {
    const contextManager = new OcpContextManager();

    // Verify all interface properties are accessible
    expect('featuredAppRight' in contextManager).toBe(true);
    expect('issuerParty' in contextManager).toBe(true);
    expect('capTableContractId' in contextManager).toBe(true);
  });
});
