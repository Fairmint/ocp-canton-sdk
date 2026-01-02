/**
 * Integration tests for PartyMigrationProposal operations.
 *
 * NOTE: These tests require a full Canton Network setup with:
 *
 * - Validator API with amulet/CC support
 * - Active or proposed payment streams with migration proposals
 * - Multiple parties with proper permissions
 *
 * These tests are skipped in basic LocalNet environments.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';

createIntegrationTestSuite('PartyMigrationProposal operations', (getContext) => {
  /**
   * NOTE: PartyMigrationProposal tests require:
   *
   * 1. Validator API with payment stream support
   * 2. Existing party migration proposals
   * 3. Multiple parties with proper setup
   *
   * These tests verify the SDK exports the expected functions.
   */

  test('SDK exports party migration proposal functions', () => {
    const ctx = getContext();

    // Verify SDK exports party migration proposal functions
    expect(ctx.ocp.PaymentStreams.partyMigrationProposal.buildApproveCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.partyMigrationProposal.buildApproveCommand).toBe('function');

    expect(ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateActivePaymentStreamCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateActivePaymentStreamCommand).toBe(
      'function'
    );

    expect(ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateProposedPaymentStreamCommand).toBeDefined();
    expect(typeof ctx.ocp.PaymentStreams.partyMigrationProposal.buildMigrateProposedPaymentStreamCommand).toBe(
      'function'
    );
  });

  test.skip('full party migration workflow - requires payment infrastructure', async () => {
    // This test would require:
    // 1. Have an active or proposed payment stream
    // 2. Create migration proposal
    // 3. Approve the migration
    // 4. Execute the migration
    //
    // Skipped as it requires full Canton Network with payment stream support
  });
});
