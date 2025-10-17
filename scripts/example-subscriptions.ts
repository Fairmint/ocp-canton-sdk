#!/usr/bin/env ts-node
/// <reference types="node" />

/**
 * Example script demonstrating Airdrop Subscriptions on devnet
 *
 * This script shows the airdrop paymentStream flow:
 *
 * 1. 🤖 Processor (new account hosted on Intellect) proposes terms
 * 2. 💻 Recipient approves proposal (Reward)
 * 3. 👤 Payer starts paymentStream and locks funds (TBD reward)
 * 4. 🔁 🤖 Processor transfers funds every x period (e.g. 10 minutes) (Reward)
 * 5. 👤 Payer adds funds (Reward)
 * 6. 👤 Payer withdraws funds (Reward)
 * 7. 👤 Payer cancels (Reward)
 *
 * Airdrop Subscription Pattern:
 *
 * - Payer: Fairmint-validator-1 (pays for the airdrop)
 * - Recipient: TransferAgent-devnet-1 (receives $20/day)
 * - Processor: test-processor account (processes payments, no fee)
 * - Recipient provider: Fairmint-validator-1 (for featured app rewards)
 * - Beneficiaries: 85% Fairmint-validator-1, 15% test-vault account (demo)
 * - Metadata: {"appUserIdHash": "hash(<app_user.id>)"}
 * - PrepayWindow: 0 microseconds (no prepayment, pay-as-you-go)
 *
 * Prerequisites:
 *
 * - Environment variables configured via EnvLoader for devnet
 * - Subscription factory contract deployed on devnet
 * - Parties configured: Intellect (Fairmint-validator-1) and 5N (TransferAgent-devnet-1)
 */

import { EnvLoader, FileLogger, ValidatorApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../src/OcpClient';
import { buildAddFundsCommand, buildWithdrawFundsCommand, getFactoryContractId } from '../src/functions/PaymentStreams';

// Load environment configuration
const envLoader = EnvLoader.getInstance();

const NETWORK = 'devnet';
const FACTORY_CONTRACT_ID = getFactoryContractId(NETWORK).paymentStreamsFactoryContractId;

/** Helper to extract contract ID from transaction response */
function extractCreatedContractId(response: any, moduleName: string, entityName: string): string | null {
  const event = Object.values(response.transactionTree.eventsById).find((evt: any) => {
    if (evt && typeof evt === 'object' && 'CreatedTreeEvent' in evt) {
      const createdEvent = evt.CreatedTreeEvent.value;
      const { templateId } = createdEvent;

      // Handle both string format (packageId:fullModulePath.entityName:entityName) and object format
      if (typeof templateId === 'string') {
        const parts = templateId.split(':');
        if (parts.length >= 3) {
          // parts[1] is like "CantonPayments.PaymentStreams.ProposedPaymentStream"
          // parts[2] is like "ProposedPaymentStream"
          const fullPath = parts[1];
          const templateEntity = parts[2];

          // Check if the full path matches moduleName.entityName
          const expectedFullPath = `${moduleName}.${entityName}`;
          return fullPath === expectedFullPath && templateEntity === entityName;
        }
      } else if (typeof templateId === 'object') {
        return templateId.moduleName === moduleName && templateId.entityName === entityName;
      }
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
        partyId: envLoader.getPartyId(NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n'),
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
          clientSecret:
            envLoader.getApiClientSecret(
              'LEDGER_JSON_API',
              NETWORK as 'mainnet' | 'devnet',
              '5n' as 'intellect' | '5n'
            ) ?? '',
          grantType: 'client_credentials',
        },
        partyId: envLoader.getPartyId(NETWORK as 'mainnet' | 'devnet', '5n' as 'intellect' | '5n'),
      },
    },
    logger: new FileLogger(),
  });

  // Initialize Validator API client for payment context (processor's view)
  const validatorClient = new ValidatorApiClient({
    network: NETWORK as 'mainnet' | 'devnet',
    provider: 'intellect' as 'intellect' | '5n',
    authUrl: envLoader.getAuthUrl(NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n'),
    apis: {
      VALIDATOR_API: {
        apiUrl:
          envLoader.getApiUri('VALIDATOR_API', NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n') ??
          '',
        auth: {
          clientId:
            envLoader.getApiClientId(
              'VALIDATOR_API',
              NETWORK as 'mainnet' | 'devnet',
              'intellect' as 'intellect' | '5n'
            ) ?? '',
          username:
            envLoader.getApiUsername(
              'VALIDATOR_API',
              NETWORK as 'mainnet' | 'devnet',
              'intellect' as 'intellect' | '5n'
            ) ?? '',
          password:
            envLoader.getApiPassword(
              'VALIDATOR_API',
              NETWORK as 'mainnet' | 'devnet',
              'intellect' as 'intellect' | '5n'
            ) ?? '',
          grantType: 'password',
        },
        partyId: envLoader.getPartyId(NETWORK as 'mainnet' | 'devnet', 'intellect' as 'intellect' | '5n'),
      },
    },
    logger: new FileLogger(),
  });

  // Define party roles for Airdrop Subscription
  const INTELLECT_PARTY = envLoader.getPartyId(NETWORK as any, 'intellect' as any);
  const FN_PARTY = envLoader.getPartyId(NETWORK as any, '5n' as any);

  const SUBSCRIBER_PARTY = INTELLECT_PARTY; // Fairmint-validator-1 pays for airdrop
  const RECIPIENT_PARTY = FN_PARTY; // TransferAgent-devnet-1 receives payment
  const PROCESSOR_PARTY =
    'test-subscription-processor::1220ea70ea2cbfe6be431f34c7323e249c624a02fb2209d2b73fabd7eea1fe84df34'; // An 5n account
  const PROVIDER = INTELLECT_PARTY; // Fairmint-validator-1 (for featured rewards)
  // For demo purposes, use actual parties. In production, use a real airdrop vault party
  const AIRDROP_VAULT_PARTY = 'test-vault::1220cddaf354fb12d4cbdee3d314430aa6fd26d6060b9f35c34a022885e3c681ec63'; // A 5N account

  console.log('🚀 Airdrop Subscription Example on Devnet\n');
  console.log(`📋 Using parties:`);
  console.log(`   Payer (Fairmint-validator-1): ${SUBSCRIBER_PARTY}`);
  console.log(`   Recipient (TransferAgent-devnet-1): ${RECIPIENT_PARTY}`);
  console.log(`   Processor (TransferAgent-devnet-1): ${PROCESSOR_PARTY}`);
  console.log(`   Recipient Provider (Fairmint-validator-1): ${PROVIDER}`);
  console.log(`   Airdrop Vault (Fairmint-validator-1): ${AIRDROP_VAULT_PARTY}\n`);

  // ========================================
  // Step 1: Processor creates paymentStream proposal
  // ========================================
  console.log('1️⃣  Processor creating airdrop paymentStream proposal...');

  // Generate a sample app user ID hash for demonstration
  const appUserId = '12345'; // In production, this would be the actual app_user.id
  const appUserIdHash = `hash_${appUserId}`; // In production, use proper hashing

  // Get disclosed contracts for the factory (allows processor to exercise it)
  const factoryDisclosedContracts = fnClient.Subscriptions.utils.getFactoryDisclosedContracts();

  const { command: createProposalCommand, disclosedContracts } =
    fnClient.Subscriptions.paymentStreamFactory.buildCreateProposedPaymentStreamCommand({
      factoryContractId: FACTORY_CONTRACT_ID,
      actor: PROCESSOR_PARTY,
      paymentStreamProposal: {
        payer: SUBSCRIBER_PARTY,
        recipient: RECIPIENT_PARTY,
        provider: PROVIDER,
        appRewardBeneficiaries: [
          { beneficiary: PROVIDER, weight: '0.85' }, // 85% to Fairmint-validator-1
          { beneficiary: AIRDROP_VAULT_PARTY, weight: '0.15' }, // 15% to airdrop-vault-1
        ],
        recipientPaymentPerDay: {
          type: 'AMULET',
          amount: '86400', // 10 CC every 10 seconds
        },
        processorPaymentPerDay: null, // No processor fee for airdrop paymentStreams
        prepayWindow: '0', // 0 microseconds = no prepay window (pay-as-you-go)
        metadata: {
          appUserIdHash,
        },
        description: `Airdrop paymentStream for app user ${appUserId}`,
      },
    });

  const proposalResponse = await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [PROCESSOR_PARTY],
    commands: [createProposalCommand],
    disclosedContracts: [...disclosedContracts, ...factoryDisclosedContracts],
  });

  const proposalContractId = extractCreatedContractId(
    proposalResponse,
    'CantonPayments.PaymentStreams',
    'ProposedPaymentStream'
  );

  if (!proposalContractId) {
    throw new Error('Failed to create paymentStream proposal');
  }

  console.log(`   ✅ Proposal created by processor: ${proposalContractId}\n`);

  // ========================================
  // Step 2: Recipient approves proposal
  // ========================================
  console.log('2️⃣  Recipient approving proposal...');

  // Get disclosed contracts for the ProposedPaymentStream (required to exercise the choice)
  let proposalDisclosedContracts =
    await fnClient.Subscriptions.utils.getProposedPaymentStreamDisclosedContracts(proposalContractId);

  const { command: recipientApproveCommand, disclosedContracts: recipientApproveDisclosedContracts } =
    fnClient.Subscriptions.proposedSubscription.buildApproveCommand({
      proposedPaymentStreamContractId: proposalContractId,
      actor: RECIPIENT_PARTY,
    });

  const recipientApprovedResponse = await fnClient.client.submitAndWaitForTransactionTree({
    actAs: [RECIPIENT_PARTY],
    commands: [recipientApproveCommand],
    disclosedContracts: [...recipientApproveDisclosedContracts, ...proposalDisclosedContracts],
  });

  const recipientApprovedProposalId = extractCreatedContractId(
    recipientApprovedResponse,
    'CantonPayments.PaymentStreams',
    'ProposedPaymentStream'
  );

  if (!recipientApprovedProposalId) {
    throw new Error('Failed to get recipient-approved proposal');
  }

  console.log(`   ✅ Recipient approved: ${recipientApprovedProposalId}`);

  // ========================================
  // Step 3: Payer starts paymentStream and locks funds
  // ========================================
  console.log('3️⃣  Payer starting paymentStream and locking funds...');

  // Get payer's amulets and payment context for locking funds
  const { paymentContext: payerPaymentContext, disclosedContracts: payerAmuletDisclosedContracts } =
    await intellectClient.Subscriptions.utils.buildPaymentContextWithAmulets(
      validatorClient,
      SUBSCRIBER_PARTY,
      2, // Use top 2 Amulet contracts
      PROVIDER // Provider party for featured app right lookup
    );

  // Get disclosed contracts for the recipient-approved ProposedPaymentStream
  proposalDisclosedContracts =
    await intellectClient.Subscriptions.utils.getProposedPaymentStreamDisclosedContracts(recipientApprovedProposalId);

  const amountToLock = '500000.0'; // Lock 500,000 CC for paymentStream payments (needs to cover 3 payments + high fees)

  const { command: startSubscriptionCommand, disclosedContracts: startSubscriptionDisclosedContracts } =
    intellectClient.Subscriptions.proposedSubscription.buildStartSubscriptionCommand({
      proposedPaymentStreamContractId: recipientApprovedProposalId,
      lockFundsInput: {
        amuletInputs: payerPaymentContext.payerAmulets,
        amountToLock,
        paymentContext: {
          amuletRulesCid: payerPaymentContext.amuletRulesCid,
          openMiningRoundCid: payerPaymentContext.openMiningRoundCid,
          featuredAppRight: payerPaymentContext.featuredAppRight ?? null,
        },
      },
    });

  const startSubscriptionResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [startSubscriptionCommand],
    disclosedContracts: [
      ...startSubscriptionDisclosedContracts,
      ...proposalDisclosedContracts,
      ...payerAmuletDisclosedContracts,
    ],
  });

  const paymentStreamContractId = extractCreatedContractId(
    startSubscriptionResponse,
    'CantonPayments.PaymentStreams',
    'ActivePaymentStream'
  );

  if (!paymentStreamContractId) {
    throw new Error('Failed to create active paymentStream');
  }

  console.log(`   ✅ Subscription active: ${paymentStreamContractId}`);
  // ========================================
  // Step 4: Process payments (3 rounds)
  // ========================================
  console.log('4️⃣  🔁 Processing airdrop payments (3 rounds with 10-second periods)...\n');

  const NUM_PAYMENTS = 3;
  const PROCESSING_PERIOD_SECONDS = 10; // Keep 10 seconds for fast testing
  const PROCESSING_PERIOD_MICROSECONDS = String(PROCESSING_PERIOD_SECONDS * 1000000);
  // Sleep for processing period before starting the payment loop
  await new Promise((resolve) => setTimeout(resolve, PROCESSING_PERIOD_SECONDS * 1000));

  let currentSubscriptionContractId = paymentStreamContractId;

  for (let i = 1; i <= NUM_PAYMENTS; i++) {
    console.log(`   💳 Processing airdrop payment ${i}/${NUM_PAYMENTS}...`);

    // Build payment context (rules, mining round, featured app right) with disclosed contracts
    const { paymentContext, disclosedContracts: paymentDisclosedContracts } =
      await fnClient.Subscriptions.utils.buildPaymentContext(validatorClient, PROVIDER);

    const { command: processPaymentCommand, disclosedContracts: processDisclosedContracts } =
      fnClient.Subscriptions.activeSubscription.buildProcessPaymentCommand({
        paymentStreamContractId: currentSubscriptionContractId,
        processingPeriod: PROCESSING_PERIOD_MICROSECONDS,
        paymentContext,
        skipProcessorPayment: true, // No processor fee for airdrop paymentStreams
      });

    const paymentResponse = await fnClient.client.submitAndWaitForTransactionTree({
      actAs: [PROCESSOR_PARTY],
      commands: [processPaymentCommand],
      disclosedContracts: [...processDisclosedContracts, ...paymentDisclosedContracts],
    });

    const newSubscriptionContractId = extractCreatedContractId(
      paymentResponse,
      'CantonPayments.PaymentStreams',
      'ActivePaymentStream'
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
  // Step 5: Payer adds funds
  // ========================================
  console.log('5️⃣  👤 Payer adding funds to paymentStream...');

  // Get additional amulets for the payer to add more funds
  const { paymentContext: addFundsPaymentContext, disclosedContracts: addFundsDisclosedContracts } =
    await intellectClient.Subscriptions.utils.buildPaymentContextWithAmulets(
      validatorClient,
      SUBSCRIBER_PARTY,
      2, // Use top 2 Amulet contracts
      PROVIDER // Provider party for featured app right lookup
    );

  const addFundsAmount = '600000.0'; // Total desired lock amount: 600,000 CC

  const { command: addFundsCommand, disclosedContracts: addFundsCommandDisclosed } = buildAddFundsCommand({
    paymentStreamContractId: currentSubscriptionContractId,
    actor: SUBSCRIBER_PARTY,
    lockFundsInput: {
      amuletInputs: addFundsPaymentContext.payerAmulets,
      amountToLock: addFundsAmount,
      paymentContext: {
        amuletRulesCid: addFundsPaymentContext.amuletRulesCid,
        openMiningRoundCid: addFundsPaymentContext.openMiningRoundCid,
        featuredAppRight: addFundsPaymentContext.featuredAppRight ?? null,
      },
    },
    description: 'Adding funds to paymentStream',
  });

  const addFundsResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [addFundsCommand],
    disclosedContracts: [...addFundsCommandDisclosed, ...addFundsDisclosedContracts],
  });

  const addFundsSubscriptionId = extractCreatedContractId(
    addFundsResponse,
    'CantonPayments.PaymentStreams',
    'ActivePaymentStream'
  );

  if (!addFundsSubscriptionId) {
    throw new Error('Failed to add funds to paymentStream');
  }

  currentSubscriptionContractId = addFundsSubscriptionId;
  console.log(`   ✅ Funds added! New contract: ${currentSubscriptionContractId}`);

  // ========================================
  // Step 6: Payer withdraws funds
  // ========================================
  console.log('6️⃣  👤 Payer withdrawing funds from paymentStream...');

  // Get payment context for unlocking amulets during withdrawal
  const { paymentContext: withdrawPaymentContext, disclosedContracts: withdrawDisclosedContracts } =
    await intellectClient.Subscriptions.utils.buildPaymentContext(validatorClient, PROVIDER);

  // Note: WithdrawFunds uses amountToKeepLocked, not amountToWithdraw
  // If paymentStream has 600,000 CC locked and we want to withdraw 50,000 CC,
  // we need to keep 550,000 CC locked
  const amountToKeepLocked = '550000.0'; // Keep 550,000 CC locked (withdrawing 50,000)

  const { command: withdrawCommand, disclosedContracts: withdrawCommandDisclosed } = buildWithdrawFundsCommand({
    paymentStreamContractId: currentSubscriptionContractId,
    amountToKeepLocked,
    paymentContext: withdrawPaymentContext,
  });

  const withdrawResponse = await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [withdrawCommand],
    disclosedContracts: [...withdrawCommandDisclosed, ...withdrawDisclosedContracts],
  });

  const withdrawSubscriptionId = extractCreatedContractId(
    withdrawResponse,
    'CantonPayments.PaymentStreams',
    'ActivePaymentStream'
  );

  if (!withdrawSubscriptionId) {
    throw new Error('Failed to withdraw funds from paymentStream');
  }

  currentSubscriptionContractId = withdrawSubscriptionId;
  console.log(`   ✅ Funds withdrawn! New contract: ${currentSubscriptionContractId}`);

  // ========================================
  // Step 7: Payer cancels paymentStream
  // ========================================
  console.log('7️⃣  👤 Payer cancelling paymentStream...');

  // Get payment context for unlocking amulets
  const { paymentContext: cancelPaymentContext, disclosedContracts: cancelDisclosedContracts } =
    await intellectClient.Subscriptions.utils.buildPaymentContext(validatorClient, PROVIDER);

  const cancelCommand = intellectClient.Subscriptions.activeSubscription.buildCancelCommand({
    paymentStreamContractId: currentSubscriptionContractId,
    actor: SUBSCRIBER_PARTY,
    disregardAvailablePaidPeriod: true,
    description: 'Subscription ended by payer',
    openMiningRoundCid: cancelPaymentContext.openMiningRoundCid,
  });

  await intellectClient.client.submitAndWaitForTransactionTree({
    actAs: [SUBSCRIBER_PARTY],
    commands: [cancelCommand],
    disclosedContracts: cancelDisclosedContracts,
  });

  console.log(`   ✅ Subscription cancelled by payer!`);

  // ========================================
  // Summary
  // ========================================
  console.log('✨ Airdrop paymentStream workflow complete!');
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
