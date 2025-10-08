#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Example script demonstrating Subscriptions usage on devnet
 *
 * This script shows the complete subscription flow:
 * 1. Subscriber creates a subscription proposal via factory
 * 2. Processor approves the proposal
 * 3. Recipient accepts, activating the subscription
 * 4. Processor executes periodic payments
 * 5. Subscription can be cancelled by any party
 *
 * Prerequisites:
 * - LEDGER_JSON_API environment variable set to devnet endpoint
 * - Valid factory contract ID
 * - Three parties: subscriber, recipient, and processor
 */

import { OcpClient } from '../src/OcpClient';
import type { SubscriptionConfig, PaymentContext } from '../src/functions';

// Configuration
const FACTORY_CONTRACT_ID = process.env.SUBSCRIPTION_FACTORY_CONTRACT_ID || '';
const SUBSCRIBER_PARTY = process.env.SUBSCRIBER_PARTY || 'subscriber::1220...';
const RECIPIENT_PARTY = process.env.RECIPIENT_PARTY || 'recipient::1220...';
const PROCESSOR_PARTY = process.env.PROCESSOR_PARTY || 'processor::1220...';

async function main() {
  // Initialize OCP client
  const ocpClient = new OcpClient();

  console.log('🚀 Subscription Example on Devnet\n');

  // Step 1: Subscriber creates subscription proposal
  console.log('1️⃣  Creating subscription proposal...');

  const subscriptionConfig: SubscriptionConfig = {
    subscriber: SUBSCRIBER_PARTY,
    recipient: RECIPIENT_PARTY,
      recipientPayment: {
        amountPerDay: {
          type: 'AMULET',
          amount: '10.0', // 10 Amulet per day
        },
        featuredAppRight: undefined, // Optional
      },
    processorPayment: {
      amountPerDay: {
        type: 'AMULET',
        amount: '0.5', // 0.5 Amulet per day processor fee
      },
      featuredAppRight: undefined,
    },
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    freeTrialEndsAt: new Date(Date.now() - 1000).toISOString(), // Free trial already ended (1 second ago)
    reason: 'Premium membership subscription - devnet test',
  };

  const { command: createProposalCommand } =
    ocpClient.Subscriptions.subscriptionFactory.buildCreateSubscriptionProposalCommand({
      factoryContractId: FACTORY_CONTRACT_ID,
      config: subscriptionConfig,
    });

  const proposalResponse = await ocpClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [createProposalCommand],
  });

  // Extract the proposal contract ID from the response
  const proposalEvent = proposalResponse.transactionTree.eventsById
    ? Object.values(proposalResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return typeof templateId === 'string' && templateId.includes('SubscriptionProposal');
        }
        return false;
      })
    : undefined;
  const proposalContractId =
    proposalEvent && 'CreatedTreeEvent' in proposalEvent
      ? proposalEvent.CreatedTreeEvent.value.contractId
      : undefined;

  if (!proposalContractId) {
    throw new Error('Failed to create subscription proposal');
  }

  console.log(`   ✅ Proposal created: ${proposalContractId}\n`);

  // Step 2: Processor approves the proposal
  console.log('2️⃣  Processor approving proposal...');

  const approveCommand = ocpClient.Subscriptions.subscriptionProposal.buildProcessorApproveCommand({
    proposalContractId,
  });

  const approvedResponse = await ocpClient.client.submitAndWaitForTransactionTree({
    actAs: [PROCESSOR_PARTY],
    commands: [approveCommand],
  });

  const approvedEvent = approvedResponse.transactionTree.eventsById
    ? Object.values(approvedResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return typeof templateId === 'string' && templateId.includes('ProcessorApprovedSubscriptionProposal');
        }
        return false;
      })
    : undefined;
  const approvedProposalContractId =
    approvedEvent && 'CreatedTreeEvent' in approvedEvent ? approvedEvent.CreatedTreeEvent.value.contractId : undefined;

  if (!approvedProposalContractId) {
    throw new Error('Failed to approve subscription proposal');
  }

  console.log(`   ✅ Proposal approved: ${approvedProposalContractId}\n`);

  // Step 3: Recipient accepts the proposal
  console.log('3️⃣  Recipient accepting subscription...');

  const acceptCommand =
    ocpClient.Subscriptions.processorApprovedSubscriptionProposal.buildRecipientAcceptCommand({
      approvedProposalContractId,
    });

  const subscriptionResponse = await ocpClient.client.submitAndWaitForTransactionTree({
    actAs: [RECIPIENT_PARTY],
    commands: [acceptCommand],
  });

  const subscriptionEvent = subscriptionResponse.transactionTree.eventsById
    ? Object.values(subscriptionResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return (
            typeof templateId === 'string' &&
            templateId.includes(':Subscription') &&
            !templateId.includes('Proposal')
          );
        }
        return false;
      })
    : undefined;
  const subscriptionContractId =
    subscriptionEvent && 'CreatedTreeEvent' in subscriptionEvent
      ? subscriptionEvent.CreatedTreeEvent.value.contractId
      : undefined;

  if (!subscriptionContractId) {
    throw new Error('Failed to create active subscription');
  }

  console.log(`   ✅ Subscription active: ${subscriptionContractId}\n`);

  // Step 4: Process payments 5 times with 5-second periods
  console.log('4️⃣  Processing payments (5 times with 5-second periods)...\n');

  // Query the ledger for required contracts
  // Note: You need to provide actual contract IDs from devnet:
  // - Amulet inputs from subscriber (with sufficient balance)
  // - Current AmuletRules contract ID
  // - Current OpenMiningRound contract ID
  // - Current Amulet price from OpenMiningRound

  const paymentContext: PaymentContext = {
    amuletInputs: [process.env.AMULET_INPUT_1 || '', process.env.AMULET_INPUT_2 || ''],
    amuletRulesCid: process.env.AMULET_RULES_CID || '',
    openMiningRoundCid: process.env.OPEN_MINING_ROUND_CID || '',
    amuletPrice: process.env.AMULET_PRICE || '1.0',
  };

  let currentSubscriptionContractId = subscriptionContractId;

  // Process 5 payments with 5-second intervals
  for (let i = 1; i <= 5; i++) {
    console.log(`   💳 Processing payment ${i}/5...`);

    const processPaymentCommand = ocpClient.Subscriptions.subscription.buildProcessPaymentCommand({
      subscriptionContractId: currentSubscriptionContractId,
      processingPeriod: '5000000', // 5 seconds in microseconds
      paymentCtx: paymentContext,
    });

    const paymentResponse = await ocpClient.client.submitAndWaitForTransactionTree({
      actAs: [PROCESSOR_PARTY],
      commands: [processPaymentCommand],
    });

    // Extract the new subscription contract ID from the response
    const createdEvent = paymentResponse.transactionTree.eventsById
      ? Object.values(paymentResponse.transactionTree.eventsById).find((event) => {
          if (!('CreatedTreeEvent' in event)) return false;
          const templateId = event.CreatedTreeEvent.value.templateId;
          return (
            typeof templateId === 'string' &&
            templateId.includes(':Subscription') &&
            !templateId.includes('Proposal')
          );
        })
      : undefined;
    
    const newSubscriptionContractId =
      createdEvent && 'CreatedTreeEvent' in createdEvent
        ? createdEvent.CreatedTreeEvent.value.contractId
        : undefined;

    if (!newSubscriptionContractId) {
      throw new Error(`Failed to process payment ${i}`);
    }

    currentSubscriptionContractId = newSubscriptionContractId;
    console.log(`   ✅ Payment ${i} processed! New contract: ${currentSubscriptionContractId}`);

    // Sleep for 5 seconds before next payment (except after the last one)
    if (i < 5) {
      console.log(`   ⏳ Waiting 5 seconds before next payment...\n`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`\n   ✅ All 5 payments completed!\n`);

  // Step 5: Cancel subscription
  console.log('5️⃣  Cancelling subscription...');

  const cancelCommand = ocpClient.Subscriptions.subscription.buildCancelBySubscriberCommand({
    subscriptionContractId: currentSubscriptionContractId,
  });

  await ocpClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [cancelCommand],
  });
  
  console.log(`   ✅ Subscription cancelled!\n`);

  console.log('✨ Subscription workflow complete!');
  console.log('\nKey takeaways:');
  console.log('- Subscriptions use a three-party model: subscriber, recipient, processor');
  console.log('- Per-day billing automatically pro-rates for any processing period');
  console.log('- Free trials supported via FeaturedAppRight rewards');
  console.log('- Pay-as-you-go model (no upfront collateral)');
  console.log('- Any party can cancel unilaterally\n');
}

// Run the example
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}

export { main };

