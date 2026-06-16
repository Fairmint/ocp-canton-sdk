# ocp-canton-sdk

High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton Network.

All documentation, examples, architecture, and contributor information live on the
**[GitHub wiki](https://github.com/Fairmint/ocp-canton-sdk/wiki)**.

## Observability

Write operations accept optional command context and observability hooks:

```typescript
const ocp = new OcpClient({
  ledger: canton.ledger,
  logger,
  metrics,
  defaultContext: { workflowId: 'issuer-onboarding' },
});

await ocp.OpenCapTable.capTable
  .update({
    capTableContractId,
    actAs: [issuerParty],
    context: {
      commandId: 'create-stakeholder-123',
      submissionId: 'submission-123',
      traceContext: { traceId, spanId },
    },
  })
  .create('stakeholder', stakeholder)
  .execute();
```

`workflowId`, `commandId`, and `submissionId` are forwarded to Canton command submissions.
`traceContext` is included in SDK log context; the current `@fairmint/canton-node-sdk`
submit-and-wait schema does not expose a submit-level trace context field yet.
