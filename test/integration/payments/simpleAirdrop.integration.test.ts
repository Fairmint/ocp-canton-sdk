/**
 * Integration tests for SimpleAirdrop operations.
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

import { createIntegrationTestSuite } from '../setup';

createIntegrationTestSuite('SimpleAirdrop operations', (getContext) => {
  /**
   * NOTE: SimpleAirdrop tests require:
   *
   * 1. Validator API with amulet support
   * 2. Sender party with amulets (CC tokens)
   * 3. Recipient parties
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports simple airdrop functions', () => {

    const ctx = getContext();

    // Verify SDK exports simple airdrop functions
    expect(ctx.ocp.CantonPayments.simpleAirdrop.buildCreateSimpleAirdropCommand).toBeDefined();
    expect(typeof ctx.ocp.CantonPayments.simpleAirdrop.buildCreateSimpleAirdropCommand).toBe('function');
  });

  test.skip('full simple airdrop workflow - requires amulet infrastructure', async () => {
    // This test would require:
    // 1. Create simple airdrop
    // 2. Execute simple airdrop
    // 3. Verify amulet transfers to recipients
    //
    // Skipped as it requires full Canton Network with amulet support
  });
});
