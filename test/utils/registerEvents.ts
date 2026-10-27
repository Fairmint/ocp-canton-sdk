/**
 * Ledger metadata for mocked OpenCapTable-v35 created events.
 *
 * A genuine register contract is signed by exactly its context's issuer, `system_operator` and transfer agent, and
 * single-contract reads check that; mocked events of the shared test context carry these signatories.
 */

/** The `Context` mocked register payloads carry. */
export const TEST_REGISTER_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
  transfer_agent: 'transfer-agent::party',
  cap_table_id: 'cap-table-1',
} as const;

/** The signatories of a genuine register contract of {@link TEST_REGISTER_CONTEXT}. */
export const TEST_REGISTER_SIGNATORIES: string[] = [
  TEST_REGISTER_CONTEXT.issuer,
  TEST_REGISTER_CONTEXT.system_operator,
  TEST_REGISTER_CONTEXT.transfer_agent,
];
