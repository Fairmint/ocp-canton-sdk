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
import { generateTestId } from '../utils';

createIntegrationTestSuite('Airdrop operations', (getContext) => {
  /**
   * NOTE: Airdrop tests require:
   *
   * 1. Validator API with amulet support
   * 2. Sender party with amulets (CC tokens)
   * 3. Recipient parties
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds create airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    // Build the command - this tests command construction
    const cmd = ctx.ocp.CantonPayments.airdrop.buildCreateAirdropCommand({
      sender: ctx.issuerParty,
      airdropId: generateTestId('airdrop'),
      airdropName: 'Test Airdrop',
      paymentInterval: { microseconds: '86400000000' }, // 1 day in microseconds
      paymentDuration: { microseconds: '2592000000000' }, // 30 days in microseconds
      totalAirdropAmount: '1000',
      provider: ctx.issuerParty,
    });

    // Verify command structure
    expect(cmd).toBeDefined();
    expect(
      (cmd as Record<string, unknown>).ExerciseCommand ?? (cmd as Record<string, unknown>).CreateCommand
    ).toBeDefined();
  });

  test('builds update airdrop config command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.airdrop.buildUpdateAirdropConfigCommand({
      airdropContractId: 'test-airdrop-contract-id',
      newAirdropName: 'Updated Airdrop',
    });

    expect(cmd).toBeDefined();
  });

  test('builds add observers to airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.airdrop.buildAddObserversToAirdropCommand({
      airdropContractId: 'test-airdrop-contract-id',
      observersToAdd: [ctx.issuerParty],
    });

    expect(cmd).toBeDefined();
  });

  test('builds execute airdrop command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.CantonPayments.airdrop.buildExecuteAirdropCommand({
      airdropContractId: 'test-airdrop-contract-id',
    });

    expect(cmd).toBeDefined();
  });

  test.skip('full airdrop workflow - requires amulet infrastructure', async () => {
    // This test would require:
    // 1. Create airdrop
    // 2. Recipients join airdrop
    // 3. Execute airdrop
    // 4. Verify amulet transfers
    //
    // Skipped as it requires full Canton Network with amulet support
  });
});
