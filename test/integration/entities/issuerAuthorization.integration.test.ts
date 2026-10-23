/**
 * Integration tests for IssuerAuthorization operations.
 *
 * Tests the authorization workflow of the harness factory (the SDK's `OpenCapTable.setup`):
 *
 * - Authorize an issuer and pin its transfer agent
 * - The transfer agent accepts, which makes the authorization disclosable to the issuer
 * - Withdraw authorization
 * - Re-authorize after withdrawal
 *
 * The cap table creation that follows, and what the SDK and ledger refuse, are covered by `register/setup`.
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration
 * ```
 */

import { createIntegrationTestSuite } from '../setup';

createIntegrationTestSuite('IssuerAuthorization operations', (getContext) => {
  test('authorizes an issuer using the harness factory', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    const authResult = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });

    expect(authResult.authorizationContractId).toBeDefined();
    expect(authResult.authorizationTemplateId).toBeDefined();
    expect(authResult.capTableId.startsWith(`${ctx.factory.factoryId}-`)).toBe(true);

    // The pinned transfer agent accepts: the recreated authorization is ready to disclose to the issuer
    const { authorization } = await setup.acceptAuthorization({
      authorizationContractId: authResult.authorizationContractId,
      transferAgent: ctx.transferAgentParty,
    });
    expect(authorization.contractId).not.toBe(authResult.authorizationContractId);
    expect(authorization.createdEventBlob).toBeTruthy();
    expect(authorization.synchronizerId).toBeTruthy();
  });

  test('withdraws authorization', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    const authResult = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });

    // The system operator signs the authorization, so it withdraws it
    const withdrawResult = await setup.withdrawAuthorization({
      authorizationContractId: authResult.authorizationContractId,
    });

    expect(withdrawResult.updateId).toBeDefined();
  });

  test('can re-authorize after withdrawal', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    const authResult1 = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });

    await setup.withdrawAuthorization({ authorizationContractId: authResult1.authorizationContractId });

    // The factory's counter does not go back: the new authorization carries the next cap table ID
    const authResult2 = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });

    expect(authResult2.authorizationContractId).toBeDefined();
    expect(authResult2.authorizationContractId).not.toBe(authResult1.authorizationContractId);
    expect(authResult2.capTableId).not.toBe(authResult1.capTableId);
  });
});
