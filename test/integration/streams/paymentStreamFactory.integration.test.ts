/**
 * Integration tests for PaymentStreamFactory operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Payment stream factory contracts deployed
 * - Multiple parties with proper permissions
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

createIntegrationTestSuite('PaymentStreamFactory operations', (getContext) => {
  /**
   * NOTE: PaymentStreamFactory tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Factory contracts deployed
   * 3. Payer and payee parties with proper setup
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds create payment stream proposal command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.paymentStreamFactory.buildCreatePaymentStreamProposalCommand({
      payer: ctx.issuerParty,
      payee: ctx.issuerParty, // Using same party for testing command structure
      streamId: generateTestId('stream'),
      streamName: 'Test Payment Stream',
      paymentAmount: '100',
      paymentInterval: { microseconds: '2592000000000' }, // 30 days
      startTime: new Date().toISOString(),
      provider: ctx.issuerParty,
    });

    expect(cmd).toBeDefined();
    expect(cmd.command).toBeDefined();
    expect(cmd.disclosedContracts).toBeDefined();
  });

  test.skip('full payment stream proposal workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Create payment stream proposal
    // 2. Payee approves proposal
    // 3. Start the payment stream
    // 4. Process payments
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
