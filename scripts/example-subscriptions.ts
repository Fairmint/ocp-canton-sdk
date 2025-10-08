#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Example script demonstrating Subscriptions usage on devnet
 *
 * This script shows the complete subscription flow with disclosed contracts:
 * 0. Intellect reads factory contract creation event (for disclosure to 5N)
 * 1. Subscriber (5N) creates a subscription proposal via factory using disclosed contracts
 * 2. Processor (Intellect) approves the proposal
 * 3. Recipient (Intellect) accepts, activating the subscription
 * 4. Processor (Intellect) executes periodic payments (5 payments with 5-second intervals)
 * 5. Subscriber (5N) cancels the subscription
 *
 * Prerequisites:
 * - Environment variables configured via EnvLoader for devnet
 * - Subscription factory contract deployed on devnet
 * - Two parties configured:
 *   - Intellect: acts as recipient and processor (owns factory)
 *   - 5N: acts as subscriber (uses disclosed contracts to access factory)
 *
 * Key technique: Uses disclosed contracts to allow 5N to exercise the factory contract
 * that it doesn't directly have visibility to.
 */

import { EnvLoader, FileLogger } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../src/OcpClient';
import type { SubscriptionConfig, PaymentContext } from '../src/functions';
import * as path from 'path';
import * as fs from 'fs';

// Configuration
const NETWORK = 'devnet';

// Load subscription factory contract ID
function loadSubscriptionFactoryContractId(network: string): string {
  const factoryFilePath = path.resolve(
    __dirname,
    '../../open-captable-protocol-daml/generated/subscriptions-factory-contract-id.json'
  );
  
  if (!fs.existsSync(factoryFilePath)) {
    throw new Error(`Subscription factory contract ID file not found at ${factoryFilePath}`);
  }
  
  const factoryData = JSON.parse(fs.readFileSync(factoryFilePath, 'utf-8'));
  const networkData = factoryData[network];
  
  if (!networkData || !networkData.subscriptionsFactoryContractId) {
    throw new Error(`No subscription factory contract ID found for network: ${network}`);
  }
  
  return networkData.subscriptionsFactoryContractId;
}

async function main() {
  const envLoader = EnvLoader.getInstance();
  const FACTORY_CONTRACT_ID = loadSubscriptionFactoryContractId(NETWORK);

  // Initialize two OCP client instances for different parties
  const intellectClient = new OcpClient({
    network: NETWORK as any,
    provider: 'intellect' as any,
    authUrl: envLoader.getAuthUrl(NETWORK as any, 'intellect' as any),
    apis: {
      LEDGER_JSON_API: {
        apiUrl: envLoader.getApiUri('LEDGER_JSON_API', NETWORK as any, 'intellect' as any) ?? '',
        auth: {
          clientId: envLoader.getApiClientId('LEDGER_JSON_API', NETWORK as any, 'intellect' as any) ?? '',
          clientSecret: envLoader.getApiClientSecret('LEDGER_JSON_API', NETWORK as any, 'intellect' as any) ?? '',
          grantType: 'client_credentials',
        },
        partyId: envLoader.getPartyId(NETWORK as any, 'intellect' as any),
      },
    },
    logger: new FileLogger(),
  });

  const fnClient = new OcpClient({
    network: NETWORK as any,
    provider: '5n' as any,
    authUrl: envLoader.getAuthUrl(NETWORK as any, '5n' as any),
    apis: {
      LEDGER_JSON_API: {
        apiUrl: envLoader.getApiUri('LEDGER_JSON_API', NETWORK as any, '5n' as any) ?? '',
        auth: {
          clientId: envLoader.getApiClientId('LEDGER_JSON_API', NETWORK as any, '5n' as any) ?? '',
          clientSecret: envLoader.getApiClientSecret('LEDGER_JSON_API', NETWORK as any, '5n' as any) ?? '',
          grantType: 'client_credentials',
        },
        partyId: envLoader.getPartyId(NETWORK as any, '5n' as any),
      },
    },
    logger: new FileLogger(),
  });

  const INTELLECT_PARTY = envLoader.getPartyId(NETWORK as any, 'intellect' as any);
  const FN_PARTY = envLoader.getPartyId(NETWORK as any, '5n' as any);

  // Party roles
  const SUBSCRIBER_PARTY = FN_PARTY;
  const RECIPIENT_PARTY = INTELLECT_PARTY;
  const PROCESSOR_PARTY = INTELLECT_PARTY;

  console.log('🚀 Subscription Example on Devnet\n');
  console.log(`📋 Using parties:`);
  console.log(`   Subscriber (5N): ${SUBSCRIBER_PARTY}`);
  console.log(`   Recipient (Intellect): ${RECIPIENT_PARTY}`);
  console.log(`   Processor (Intellect): ${PROCESSOR_PARTY}\n`);

  // Step 0: Read factory contract creation event to disclose it to 5N
  console.log('0️⃣  Reading factory contract creation event (for disclosure)...');
  
  const factoryEventsResponse = await intellectClient.client.getEventsByContractId({
    contractId: FACTORY_CONTRACT_ID,
  });

  const createdEvent = factoryEventsResponse.created?.createdEvent;
  
  if (!createdEvent) {
    throw new Error(`Factory contract creation event ${FACTORY_CONTRACT_ID} not found`);
  }

  console.log(`   ✅ Factory contract creation event retrieved\n`);

  // Step 1: Subscriber (5N) creates subscription proposal with disclosed factory
  console.log('1️⃣  Creating subscription proposal (as 5N subscriber)...');

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
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    freeTrialEndsAt: new Date(Date.now() - 1000), // Free trial already ended (1 second ago)
    reason: 'Premium membership subscription - devnet test',
  };

  // Build command with disclosed factory contract
  const { command: createProposalCommand, disclosedContracts } =
    fnClient.Subscriptions.subscriptionFactory.buildCreateSubscriptionProposalCommand({
      factoryContractId: FACTORY_CONTRACT_ID,
      config: subscriptionConfig,
    });

  // Add the factory contract to disclosed contracts
  const disclosedFactoryContracts = [
    ...disclosedContracts,
    {
      templateId: createdEvent.templateId,
      contractId: createdEvent.contractId,
      createdEventBlob: createdEvent.createdEventBlob,
      synchronizerId: factoryEventsResponse.created!.synchronizerId,
    },
  ];

  const proposalResponse = await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [createProposalCommand],
    disclosedContracts: disclosedFactoryContracts,
  });

  // Extract the proposal contract ID from the response
  const proposalEvent = proposalResponse.transactionTree.eventsById
    ? Object.values(proposalResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return (
            typeof templateId === 'string' && 
            templateId.includes('.SubscriptionProposal:SubscriptionProposal') &&
            !templateId.includes('Approved')
          );
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

  const approveCommand = intellectClient.Subscriptions.subscriptionProposal.buildProcessorApproveCommand({
    proposalContractId,
  });

  const approvedResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [PROCESSOR_PARTY],
    commands: [approveCommand],
  });

  const approvedEvent = approvedResponse.transactionTree.eventsById
    ? Object.values(approvedResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return (
            typeof templateId === 'string' && 
            templateId.includes('.ProcessorApprovedSubscriptionProposal:ProcessorApprovedSubscriptionProposal')
          );
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
    intellectClient.Subscriptions.processorApprovedSubscriptionProposal.buildRecipientAcceptCommand({
      approvedProposalContractId,
    });

  const subscriptionResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [RECIPIENT_PARTY],
    commands: [acceptCommand],
  });

  const subscriptionEvent = subscriptionResponse.transactionTree.eventsById
    ? Object.values(subscriptionResponse.transactionTree.eventsById).find((event) => {
        if ('CreatedTreeEvent' in event) {
          const templateId = event.CreatedTreeEvent.value.templateId;
          return (
            typeof templateId === 'string' && 
            templateId.includes('.Subscription:Subscription') &&
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

    const processPaymentCommand = intellectClient.Subscriptions.subscription.buildProcessPaymentCommand({
      subscriptionContractId: currentSubscriptionContractId,
      processingPeriod: '5000000', // 5 seconds in microseconds
      paymentCtx: paymentContext,
    });

    const paymentResponse = await intellectClient.client.submitAndWaitForTransactionTree({
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
  console.log('5️⃣  Cancelling subscription (as 5N subscriber)...');

  const cancelCommand = fnClient.Subscriptions.subscription.buildCancelBySubscriberCommand({
    subscriptionContractId: currentSubscriptionContractId,
  });

  await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [cancelCommand],
  });
  
  console.log(`   ✅ Subscription cancelled!\n`);

  console.log('✨ Subscription workflow complete!');
  console.log('\nKey takeaways:');
  console.log('- Subscriptions use a three-party model: subscriber, recipient, processor');
  console.log('- Disclosed contracts enable parties to exercise contracts they don\'t directly see');
  console.log('- 5N (subscriber) uses disclosed contracts to access Intellect\'s factory');
  console.log('- One party can act as both recipient and processor (Intellect in this example)');
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

