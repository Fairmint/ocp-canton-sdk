# ProposedPaymentStream Types

This document describes the new type definitions for `ProposedPaymentStream` contracts added to the
SDK.

## Overview

The `ProposedPaymentStream` contract type definitions follow the same pattern as
`ActivePaymentStream`, providing strongly-typed interfaces for working with paymentStream proposals
in TypeScript.

## New Types

### File: `src/functions/Subscriptions/types/proposedSubscription.ts`

#### `SubscriptionProposal`

The paymentStream proposal details:

- `payer: string` - The party paying
- `recipient: string` - The party receiving payments
- `provider: string` - The provider party
- `recipientPaymentPerDay` - Amount to pay recipient per day
- `processorPaymentPerDay` - Amount to pay processor per day (optional)
- `prepayWindow` - Prepayment window in microseconds
- `paymentsEndAt` - When payments should end (optional)
- `freeTrialExpiration` - When free trial expires (optional)
- `appRewardBeneficiaries` - App reward beneficiaries
- `observers` - Additional observer parties
- `description` - Optional description
- `metadata` - Optional metadata

#### `Approvals`

The approval state for the proposal:

- `payerApproved: boolean` - Has the payer approved?
- `recipientApproved: boolean` - Has the recipient approved?
- `processorApproved: boolean` - Has the processor approved?

#### `ProposedPaymentStreamPayload`

The complete contract payload:

- `paymentStreamProposal: SubscriptionProposal` - The proposal details
- `processorContext: { processor: string; dso: string }` - Processor context
- `approvals: Approvals` - The approval state

#### `ProposedPaymentStreamContract`

The full contract structure:

- `contractId: string` - The contract ID
- `payload: ProposedPaymentStreamPayload` - The contract payload

## Helper Functions

The module also exports several helper functions for working with proposals:

### `isProposalPendingRecipientApproval(proposal, recipientPartyId)`

Checks if a proposal is pending the recipient's approval.

**Parameters:**

- `proposal: ProposedPaymentStreamContract` - The proposal to check
- `recipientPartyId: string` - The recipient party ID

**Returns:** `boolean` - `true` if pending recipient approval

**Example:**

```typescript
import { isProposalPendingRecipientApproval } from '@open-captable-protocol/canton';

const needsApproval = isProposalPendingRecipientApproval(proposal, 'recipient-party::123');
```

### `isProposalPendingPayerApproval(proposal, payerPartyId)`

Checks if a proposal is pending the payer's approval.

**Parameters:**

- `proposal: ProposedPaymentStreamContract` - The proposal to check
- `payerPartyId: string` - The payer party ID

**Returns:** `boolean` - `true` if pending payer approval

### `isProposalPendingProcessorApproval(proposal, processorPartyId)`

Checks if a proposal is pending the processor's approval.

**Parameters:**

- `proposal: ProposedPaymentStreamContract` - The proposal to check
- `processorPartyId: string` - The processor party ID

**Returns:** `boolean` - `true` if pending processor approval

### `areAllPartiesApproved(proposal)`

Checks if all parties have approved the proposal.

**Parameters:**

- `proposal: ProposedPaymentStreamContract` - The proposal to check

**Returns:** `boolean` - `true` if all parties have approved

## Usage

Import the types and helpers from the SDK:

```typescript
import {
  ProposedPaymentStreamContract,
  ProposedPaymentStreamPayload,
  SubscriptionProposal,
  Approvals,
  isProposalPendingRecipientApproval,
  isProposalPendingPayerApproval,
  isProposalPendingProcessorApproval,
  areAllPartiesApproved,
} from '@open-captable-protocol/canton';
```

### Example: Filtering Proposals

```typescript
import {
  OcpClient,
  type ProposedPaymentStreamContract,
  isProposalPendingRecipientApproval,
} from '@open-captable-protocol/canton';

// Get all proposals
const proposals: ProposedPaymentStreamContract[] = /* ... */;

// Filter for proposals pending recipient approval
const recipientPartyId = 'recipient-party::123';
const needingApproval = proposals.filter((proposal) =>
  isProposalPendingRecipientApproval(proposal, recipientPartyId)
);

console.log(`Found ${needingApproval.length} proposals pending recipient approval`);
```

### Example: Checking Approval Status

```typescript
import {
  type ProposedPaymentStreamContract,
  areAllPartiesApproved,
} from '@open-captable-protocol/canton';

const proposal: ProposedPaymentStreamContract = /* ... */;

if (areAllPartiesApproved(proposal)) {
  console.log('All parties have approved, ready to start paymentStream');
} else {
  const { approvals } = proposal.payload;
  console.log('Waiting for approvals:', {
    payer: approvals.payerApproved ? '✓' : '✗',
    recipient: approvals.recipientApproved ? '✓' : '✗',
    processor: approvals.processorApproved ? '✓' : '✗',
  });
}
```

## Consistency with ActivePaymentStream

These types follow the same pattern as `ActivePaymentStreamContract`:

```typescript
// Both follow the same structure:
interface SomeContract {
  contractId: string;
  payload: SomePayload;
}

// Both provide helper functions for common checks:
isSubscriptionReadyForProcessing(activeSubscription, period);
isProposalPendingRecipientApproval(proposal, recipientId);
```

## Type Safety Benefits

1. **IntelliSense Support** - Full autocomplete in IDEs
2. **Compile-Time Validation** - Catch errors before runtime
3. **Documentation** - Types serve as inline documentation
4. **Refactoring Safety** - Type changes propagate through codebase
5. **Reduced Bugs** - Less room for typos or incorrect field access

## Related Types

- `ActivePaymentStreamContract` - For active paymentStreams
- `SubscriptionChangeProposal` - For proposed changes to active paymentStreams
- `PartyMigrationProposal` - For migrating party identities

## Future Enhancements

Potential improvements:

1. Add validation functions (e.g., `validateSubscriptionProposal`)
2. Add transformation functions (e.g., `proposalToSubscription`)
3. Add more specific helper functions for common workflows
4. Add JSDoc comments with examples for all types
