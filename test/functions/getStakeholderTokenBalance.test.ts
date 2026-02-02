import {
  getStakeholderTokenBalance,
  type GetStakeholderTokenBalanceParams,
  type StakeholderTokenBalance,
} from '../../src/functions/OpenCapTable/stakeholder/getStakeholderTokenBalance';

// Mock ValidatorApiClient
const createMockValidatorClient = () => ({
  getExternalPartyBalance: jest.fn(),
});

describe('getStakeholderTokenBalance', () => {
  describe('successful balance retrieval', () => {
    it('returns the balance when party exists', async () => {
      const mockClient = createMockValidatorClient();
      const mockResponse = {
        party_id: 'party::stakeholder123',
        total_unlocked_coin: '100.5',
        total_locked_coin: '50.25',
        total_coin_holdings: '150.75',
        accumulated_holding_fees_unlocked: '0.01',
        accumulated_holding_fees_locked: '0.005',
        accumulated_holding_fees_total: '0.015',
        total_available_coin: '100.49',
        computed_as_of_round: 42,
      };

      mockClient.getExternalPartyBalance.mockResolvedValue(mockResponse);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::stakeholder123',
      };

      // Cast to any to avoid TypeScript complaining about mock
      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).not.toBeNull();
      const balance = result.balance as StakeholderTokenBalance;
      expect(balance.partyId).toBe('party::stakeholder123');
      expect(balance.totalUnlockedCoin).toBe('100.5');
      expect(balance.totalLockedCoin).toBe('50.25');
      expect(balance.totalCoinHoldings).toBe('150.75');
      expect(balance.accumulatedHoldingFeesUnlocked).toBe('0.01');
      expect(balance.accumulatedHoldingFeesLocked).toBe('0.005');
      expect(balance.accumulatedHoldingFeesTotal).toBe('0.015');
      expect(balance.totalAvailableCoin).toBe('100.49');
      expect(balance.computedAsOfRound).toBe(42);

      expect(mockClient.getExternalPartyBalance).toHaveBeenCalledWith({
        partyId: 'party::stakeholder123',
      });
    });
  });

  describe('non-existent party handling', () => {
    it('returns null when party returns 404 status', async () => {
      const mockClient = createMockValidatorClient();
      const error = { status: 404, message: 'Party not found' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error has statusCode 404', async () => {
      const mockClient = createMockValidatorClient();
      const error = { statusCode: 404 };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error has response.status 404', async () => {
      const mockClient = createMockValidatorClient();
      const error = { response: { status: 404 } };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error message contains "not found"', async () => {
      const mockClient = createMockValidatorClient();
      const error = { message: 'Party not found in the system' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error message contains "404"', async () => {
      const mockClient = createMockValidatorClient();
      const error = { message: 'HTTP 404: Resource not available' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error message contains "does not exist"', async () => {
      const mockClient = createMockValidatorClient();
      const error = { message: 'The requested party does not exist' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error message contains "no balance"', async () => {
      const mockClient = createMockValidatorClient();
      const error = { message: 'Party has no balance' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('returns null when error code is NOT_FOUND', async () => {
      const mockClient = createMockValidatorClient();
      const error = { code: 'NOT_FOUND' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::nonexistent',
      };

      const result = await getStakeholderTokenBalance(mockClient as any, params);

      expect(result.balance).toBeNull();
    });

    it('re-throws ENOTFOUND errors (DNS resolution failures)', async () => {
      // ENOTFOUND is a DNS resolution error, not a "not found" response.
      // It indicates network/infrastructure issues (e.g., misconfigured validator URL)
      // and should NOT be silently treated as "stakeholder has no balance".
      const mockClient = createMockValidatorClient();
      const error = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND validator.invalid' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::stakeholder123',
      };

      await expect(getStakeholderTokenBalance(mockClient as any, params)).rejects.toEqual(error);
    });
  });

  describe('error re-throwing', () => {
    it('re-throws non-404 errors', async () => {
      const mockClient = createMockValidatorClient();
      const error = new Error('Network error');
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::stakeholder123',
      };

      await expect(getStakeholderTokenBalance(mockClient as any, params)).rejects.toThrow('Network error');
    });

    it('re-throws errors with status 500', async () => {
      const mockClient = createMockValidatorClient();
      const error = { status: 500, message: 'Internal server error' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::stakeholder123',
      };

      await expect(getStakeholderTokenBalance(mockClient as any, params)).rejects.toEqual(error);
    });

    it('re-throws errors with status 401', async () => {
      const mockClient = createMockValidatorClient();
      const error = { status: 401, message: 'Unauthorized' };
      mockClient.getExternalPartyBalance.mockRejectedValue(error);

      const params: GetStakeholderTokenBalanceParams = {
        partyId: 'party::stakeholder123',
      };

      await expect(getStakeholderTokenBalance(mockClient as any, params)).rejects.toEqual(error);
    });
  });
});
