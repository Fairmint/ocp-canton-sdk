/**
 * Integration tests for ActivePaymentStream operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active payment streams
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

createIntegrationTestSuite('ActivePaymentStream operations', (getContext) => {
  /**
   * NOTE: ActivePaymentStream tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing active payment stream contracts
   * 3. Payer party with amulets for payments
   *
   * These tests verify the command building but may not execute successfully without the full Canton Network
   * infrastructure.
   */

  test('builds process payment command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildProcessPaymentCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
      provider: ctx.issuerParty,
    });

    expect(cmd).toBeDefined();
    expect(cmd.command).toBeDefined();
  });

  test('builds process free trial command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildProcessFreeTrialCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds cancel command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildCancelCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds propose changes command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildProposeChangesCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
      newPaymentAmount: '150',
    });

    expect(cmd).toBeDefined();
  });

  test('builds refund command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildRefundCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
      refundAmount: '50',
    });

    expect(cmd).toBeDefined();
  });

  test('builds archive inactive payment stream command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildArchiveInactivePaymentStreamCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
    });

    expect(cmd).toBeDefined();
  });

  test('builds change party command', () => {
    if (skipIfValidatorUnavailable()) return;

    const ctx = getContext();

    const cmd = ctx.ocp.PaymentStreams.activePaymentStream.buildChangePartyCommand({
      activePaymentStreamContractId: 'test-active-stream-id',
      newParty: ctx.issuerParty,
      isPayerChange: false,
    });

    expect(cmd).toBeDefined();
  });

  test.skip('full active payment stream workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an existing active payment stream
    // 2. Process payments
    // 3. Propose and apply changes
    // 4. Cancel or archive the stream
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
