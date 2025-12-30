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

import { createIntegrationTestSuite, skipIfValidatorUnavailable } from '../setup';
import { generateTestId } from '../utils';

createIntegrationTestSuite('SimpleAirdrop operations', (getContext) => {
  /**
   * NOTE: SimpleAirdrop tests require:
   *
   * 1. Validator API with amulet support
   * 2. Sender party with amulets (CC tokens)
   * 3. Recipient parties
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds create simple airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.simpleAirdrop.buildCreateSimpleAirdropCommand({
      sender: ctx.issuerParty,
      airdropId: generateTestId('simple-airdrop'),
      recipients: [{ party: ctx.issuerParty, amount: '100' }],
      provider: ctx.issuerParty,
    });

    expect(cmd).toBeDefined();
    expect(
      (cmd as Record<string, unknown>).ExerciseCommand ?? (cmd as Record<string, unknown>).CreateCommand
    ).toBeDefined();
  });

  test('builds archive simple airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.simpleAirdrop.buildArchiveSimpleAirdropCommand({
      simpleAirdropContractId: 'test-simple-airdrop-contract-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds execute simple airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.simpleAirdrop.buildExecuteSimpleAirdropCommand({
      simpleAirdropContractId: 'test-simple-airdrop-contract-id',
    });

    expect(cmd).toBeDefined();
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
