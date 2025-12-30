/**
 * Integration tests for Airdrop operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Amulet contracts deployed
 * - Multiple parties with amulets
 *
 * These tests are skipped in basic LocalNet environments.
 *
 * Run with:
 *
 * ```bash
 * OCP_TEST_USE_CN_QUICKSTART_DEFAULTS=true npm run test:integration
 * ```
 */

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';

createIntegrationTestSuite('Airdrop operations', (getContext) => {
  /**
   * NOTE: Airdrop tests require:
   *
   * 1. Validator API with amulet support
   * 2. Sender party with amulets (CC tokens)
   * 3. Recipient parties
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports airdrop functions', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // Verify SDK exports airdrop functions
    expect(ctx.ocp.CantonPayments.airdrop.buildCreateAirdropCommand).toBeDefined();
    expect(typeof ctx.ocp.CantonPayments.airdrop.buildCreateAirdropCommand).toBe('function');
  });

  test.skip('full airdrop workflow - requires amulet infrastructure', async () => {
    // This test would require:
    // 1. Create airdrop with proper AirdropConfig
    // 2. Recipients join airdrop
    // 3. Execute airdrop
    // 4. Verify amulet transfers
    //
    // Skipped as it requires full Canton Network with amulet support
  });
});
