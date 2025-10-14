#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Example script demonstrating Airdrop Subscriptions on devnet
 *
 * This script shows the airdrop subscription flow:
 * 
 * 1. Subscriber (Intellect/Fairmint-validator-1) creates a subscription proposal via factory
 * 2. Recipient (5N/TransferAgent-mainnet-1) approves the proposal to activate
 * 3. Processor (5N/TransferAgent-mainnet-1) processes periodic payments (3 rounds)
 * 4. Recipient cancels the subscription (to demonstrate subscription lifecycle completion)
 *
 * Airdrop Subscription Pattern:
 * - Subscriber: Fairmint-validator-1 (pays for the airdrop)
 * - Recipient: TransferAgent-mainnet-1 (receives $20/day)
 * - Processor: TransferAgent-mainnet-1 (processes payments, no fee)
 * - Recipient provider: Fairmint-validator-1 (for featured app rewards)
 * - Beneficiaries: 85% Fairmint-validator-1, 15% airdrop-vault-1
 * - Metadata: {"appUserIdHash": "hash(<app_user.id>)"}
 *
 * Prerequisites:
 * - Environment variables configured via EnvLoader for devnet
 * - Subscription factory contract deployed on devnet
 * - Parties configured: Intellect (Fairmint-validator-1) and 5N (TransferAgent-mainnet-1)
 */

import { EnvLoader, FileLogger, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../src/OcpClient';
import { getFactoryContractId } from '../src/functions/Subscriptions/utils';

// Load environment configuration
const envLoader = EnvLoader.getInstance();

const NETWORK = 'devnet';
const FACTORY_CONTRACT_ID = getFactoryContractId(NETWORK).subscriptionsFactoryContractId;

/**
 * Helper to extract contract ID from transaction response
 */
function extractCreatedContractId(response: any, moduleName: string, entityName: string): string | null {
  const event = Object.values(response.transactionTree.eventsById).find((event: any) => {
    if (event && typeof event === 'object' && 'CreatedTreeEvent' in event) {
      const createdEvent = (event as any).CreatedTreeEvent.value;
      const { templateId } = createdEvent;
      return templateId.moduleName === moduleName && templateId.entityName === entityName;
    }
    return false;
  });

  if (event && typeof event === 'object' && 'CreatedTreeEvent' in event) {
    return (event as any).CreatedTreeEvent.value.contractId;
  }
  
  return null;
}

async function main() {
  // Initialize OCP clients for both parties
  const intellectClient = new OcpClient({
    network: NETWORK as 'mainnet' | 'devnet',
    provider: 'intellect' as 'intellect' | '5n',
    authUrl: envLoader.getAuthUrl(NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n'),
    apis: {
      LEDGER_JSON_API: {
        apiUrl:
          envLoader.getApiUri('LEDGER_JSON_API', NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n') ??
          '',
        auth: {
          clientId:
            envLoader.getApiClientId(
              'LEDGER_JSON_API',
              NETWORK as 'mainnet' | 'devnet',
              'intellect' as 'intellect' | '5n'
            ) ?? '',
          clientSecret:
            envLoader.getApiClientSecret(
              'LEDGER_JSON_API',
              NETWORK as 'mainnet' | 'devnet',
              'intellect' as 'intellect' | '5n'
            ) ?? '',
          grantType: 'client_credentials',
        },
      },
    },
    logger: new FileLogger(),
  });

  const fnClient = new OcpClient({
    network: NETWORK as 'mainnet' | 'devnet',
    provider: '5n' as 'intellect' | '5n',
    authUrl: envLoader.getAuthUrl(NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n'),
    apis: {
      LEDGER_JSON_API: {
        apiUrl:
          envLoader.getApiUri('LEDGER_JSON_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ?? '',
        auth: {
          clientId:
            envLoader.getApiClientId('LEDGER_JSON_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          username:
            envLoader.getApiUsername('LEDGER_JSON_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          password:
            envLoader.getApiPassword('LEDGER_JSON_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          grantType: 'password',
        },
      },
    },
    logger: new FileLogger(),
  });

  // Initialize Validator API client for payment context (processor's view)
  const validatorClient = new ValidatorApiClient({
    network: NETWORK as 'mainnet' | 'devnet',
    provider: '5n' as 'intellect' | '5n',
    authUrl: envLoader.getAuthUrl(NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n'),
    apis: {
      VALIDATOR_API: {
        apiUrl:
          envLoader.getApiUri('VALIDATOR_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ?? '',
        auth: {
          clientId:
            envLoader.getApiClientId('VALIDATOR_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          username:
            envLoader.getApiUsername('VALIDATOR_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          password:
            envLoader.getApiPassword('VALIDATOR_API', NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n') ??
            '',
          grantType: 'password',
        },
      },
    },
    logger: new FileLogger(),
  });

  // Define party roles for Airdrop Subscription
  const INTELLECT_PARTY = envLoader.getPartyId(NETWORK as any, 'intellect' as any);
  const FN_PARTY = envLoader.getPartyId(NETWORK as any, '5n' as any);

  const SUBSCRIBER_PARTY = INTELLECT_PARTY; // Fairmint-validator-1 pays for airdrop
  const RECIPIENT_PARTY = FN_PARTY; // TransferAgent-mainnet-1 receives payment
  const PROCESSOR_PARTY = FN_PARTY; // TransferAgent-mainnet-1 processes payments
  const RECIPIENT_PROVIDER = INTELLECT_PARTY; // Fairmint-validator-1 (for featured rewards)
  const AIRDROP_VAULT_PARTY = 'airdrop-vault-1'; // Note: This would need to be a real party ID

  console.log('🚀 Airdrop Subscription Example on Devnet\n');
  console.log(`📋 Using parties:`);
  console.log(`   Subscriber (Fairmint-validator-1): ${SUBSCRIBER_PARTY}`);
  console.log(`   Recipient (TransferAgent-mainnet-1): ${RECIPIENT_PARTY}`);
  console.log(`   Processor (TransferAgent-mainnet-1): ${PROCESSOR_PARTY}`);
  console.log(`   Recipient Provider (Fairmint-validator-1): ${RECIPIENT_PROVIDER}\n`);

  // ========================================
  // Step 1: Create subscription proposal
  // ========================================
  console.log('1️⃣  Creating airdrop subscription proposal...');

  // Generate a sample app user ID hash for demonstration
  const appUserId = '12345'; // In production, this would be the actual app_user.id
  const appUserIdHash = `hash_${appUserId}`; // In production, use proper hashing

  // Get disclosed contracts for the factory (allows subscriber to exercise it)
  const factoryDisclosedContracts = await intellectClient.Subscriptions.utils.getFactoryDisclosedContracts(
    FACTORY_CONTRACT_ID
  );

  const { command: createProposalCommand, disclosedContracts } =
    intellectClient.Subscriptions.subscriptionFactory.buildCreateProposedSubscriptionCommand({
      factoryContractId: FACTORY_CONTRACT_ID,
      actor: SUBSCRIBER_PARTY,
      subscriptionProposal: {
        subscriber: SUBSCRIBER_PARTY,
        recipient: RECIPIENT_PARTY,
        recipientProvider: RECIPIENT_PROVIDER,
        recipientBeneficiaries: [
          { party: RECIPIENT_PROVIDER, weight: '0.85' }, // 85% to Fairmint-validator-1
          { party: AIRDROP_VAULT_PARTY, weight: '0.15' }, // 15% to airdrop-vault-1
        ],
        recipientPaymentPerDay: {
          type: 'USD',
          amount: '20', // $20 per day
        },
        metadata: {
          appUserIdHash,
        },
        description: `Airdrop subscription for app user ${appUserId}`,
      },
    });

  const proposalResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [createProposalCommand],
    disclosedContracts: [...disclosedContracts, ...factoryDisclosedContracts],
  });

  const proposalContractId = extractCreatedContractId(
    proposalResponse,
    'Fairmint.Subscriptions',
    'ProposedSubscription'
  );

  if (!proposalContractId) {
    throw new Error('Failed to create subscription proposal');
  }

  console.log(`   ✅ Proposal created: ${proposalContractId}\n`);

  // ========================================
  // Step 2: Recipient approves to activate
  // ========================================
  console.log('2️⃣  Recipient approving proposal to activate...');

  const approveCommand = fnClient.Subscriptions.proposedSubscription.buildApproveCommand({
    proposedSubscriptionContractId: proposalContractId,
    actor: RECIPIENT_PARTY,
  });

  const approvedResponse = await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [RECIPIENT_PARTY],
    commands: [approveCommand],
  });

  const subscriptionContractId = extractCreatedContractId(
    approvedResponse,
    'Fairmint.Subscriptions',
    'ActiveSubscription'
  );

  if (!subscriptionContractId) {
    throw new Error('Failed to create active subscription');
  }

  console.log(`   ✅ Subscription active: ${subscriptionContractId}\n`);

  // ========================================
  // Step 3: Process payments (3 rounds)
  // ========================================
  console.log('3️⃣  Processing airdrop payments (3 rounds with 10-second periods)...\n');

  const NUM_PAYMENTS = 3;
  const PROCESSING_PERIOD_SECONDS = 10;
  const PROCESSING_PERIOD_MICROSECONDS = String(PROCESSING_PERIOD_SECONDS * 1000000);

  let currentSubscriptionContractId = subscriptionContractId;

  for (let i = 1; i <= NUM_PAYMENTS; i++) {
    console.log(`   💳 Processing airdrop payment ${i}/${NUM_PAYMENTS}...`);

    // Build payment context (Amulets, rules, mining round) with disclosed contracts
    const { paymentContext, disclosedContracts: paymentDisclosedContracts } =
      await fnClient.Subscriptions.utils.buildPaymentContext(
        validatorClient,
        SUBSCRIBER_PARTY,
        2 // Use top 2 Amulet contracts
      );

    const processPaymentCommand = fnClient.Subscriptions.activeSubscription.buildProcessPaymentCommand({
      subscriptionContractId: currentSubscriptionContractId,
      processingContext: {
        processingPeriod: PROCESSING_PERIOD_MICROSECONDS,
        processorProvider: PROCESSOR_PARTY,
        recipientProvider: RECIPIENT_PROVIDER,
        processorBeneficiaries: [
          { party: RECIPIENT_PROVIDER, weight: '1' }, // Not used since skipProcessorPayment is true
        ],
      },
      paymentContext,
      skipProcessorPayment: true, // No processor fee for airdrop subscriptions
    });

    const paymentResponse = await fnClient.client.submitAndWaitForTransactionTree({
      actAs: [PROCESSOR_PARTY],
      commands: [processPaymentCommand],
      disclosedContracts: paymentDisclosedContracts,
    });

    const newSubscriptionContractId = extractCreatedContractId(
      paymentResponse,
      'Fairmint.Subscriptions',
      'ActiveSubscription'
    );

    if (!newSubscriptionContractId) {
      throw new Error(`Failed to process payment ${i}`);
    }

    currentSubscriptionContractId = newSubscriptionContractId;
    console.log(`   ✅ Payment ${i} processed! New contract: ${currentSubscriptionContractId}`);

    // Wait before next payment (except after the last one)
    if (i < NUM_PAYMENTS) {
      console.log(`   ⏳ Waiting ${PROCESSING_PERIOD_SECONDS} seconds before next payment...\n`);
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_PERIOD_SECONDS * 1000));
    }
  }

  console.log(`\n   ✅ All ${NUM_PAYMENTS} airdrop payments completed!\n`);

  // ========================================
  // Step 4: Recipient cancels subscription
  // ========================================
  console.log('4️⃣  Recipient cancelling subscription...');

  const cancelCommand = fnClient.Subscriptions.activeSubscription.buildCancelCommand({
    subscriptionContractId: currentSubscriptionContractId,
    actor: RECIPIENT_PARTY,
    disregardAvailablePaidPeriod: true,
    description: 'Subscription ended by recipient',
  });

  await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [RECIPIENT_PARTY],
    commands: [cancelCommand],
  });

  console.log(`   ✅ Subscription cancelled by recipient!\n`);

  // ========================================
  // Summary
  // ========================================
  console.log('✨ Airdrop subscription workflow complete!');
  console.log('\nKey features of airdrop subscriptions:');
  console.log('- Subscriber (Fairmint) pays for airdrops to recipients (TransferAgent)');
  console.log('- $20/day payment priced in USD (converted to CC at processing time)');
  console.log('- Recipient provider enables featured app rewards with custom beneficiaries');
  console.log('- 85% rewards to Fairmint, 15% to airdrop vault');
  console.log('- No processor fee (skipProcessorPayment: true)');
  console.log('- Metadata tracks app user via hashed ID');
  console.log('- Per-day billing automatically pro-rates for any processing period');
  console.log('- Perpetual subscriptions (no expiration) with no prepaid window');
  console.log('- Any party can cancel unilaterally (recipient in this example)');
  console.log('- One subscription created per app user (scales to 14,676+ users)\n');

  console.log('Next steps:');
  console.log('- Scale to create one subscription per app_user');
  console.log('- Implement automated processing scheduler');
  console.log('- Monitor subscription stats and balance consumption');
  console.log('- Handle edge cases (insufficient balance, expired subscriptions, etc.)\n');
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
