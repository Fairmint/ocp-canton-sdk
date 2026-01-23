/** Utilities for building payment context for paymentStream payments */

import type { ValidatorApiClient } from '@fairmint/canton-node-sdk';
import type { DisclosedContract } from '@fairmint/canton-node-sdk/build/src/clients/ledger-json-api/schemas/api/commands';
import { getCurrentMiningRoundContext } from '@fairmint/canton-node-sdk/build/src/utils/mining/mining-rounds';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';

export interface PaymentContext {
  amuletRulesCid: string;
  openMiningRoundCid: string;
  featuredAppRight: string | null;
}

export interface PaymentContextWithDisclosedContracts {
  paymentContext: PaymentContext;
  disclosedContracts: DisclosedContract[];
}

export interface PaymentContextWithAmulets {
  payerAmulets: string[];
  amuletRulesCid: string;
  openMiningRoundCid: string;
  featuredAppRight?: string | null;
}

export interface PaymentContextWithAmuletsAndDisclosed {
  paymentContext: PaymentContextWithAmulets;
  disclosedContracts: DisclosedContract[];
}

/**
 * Build payment context for processing paymentStream payments (no amulet inputs needed)
 *
 * Queries the ledger for:
 *
 * - AmuletRules contract
 * - OpenMiningRound contract
 * - FeaturedAppRight contract (if provider specified)
 *
 * Returns both the payment context and the disclosed contracts needed
 *
 * @param validatorClient - Validator API client for getting rules/rounds
 * @param provider - Optional provider party ID to lookup featured app right
 */
export async function buildPaymentContext(
  validatorClient: ValidatorApiClient,
  provider: string
): Promise<PaymentContextWithDisclosedContracts> {
  // Get AmuletRules contract
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesCid = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesContract = {
    templateId: amuletRulesResponse.amulet_rules.contract.template_id,
    contractId: amuletRulesCid,
    createdEventBlob: amuletRulesResponse.amulet_rules.contract.created_event_blob,
    synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
  };

  // Get OpenMiningRound contract
  const miningRoundContext = await getCurrentMiningRoundContext(validatorClient);
  const openMiningRoundCid = miningRoundContext.openMiningRound;
  const { openMiningRoundContract } = miningRoundContext;

  // Get FeaturedAppRight contract if provider specified
  let featuredAppRightCid: string | null = null;
  const disclosedContracts: DisclosedContract[] = [amuletRulesContract, openMiningRoundContract];

  if (provider) {
    try {
      const featuredAppRight = await validatorClient.lookupFeaturedAppRight({ partyId: provider });
      const contractId = featuredAppRight.featured_app_right?.contract_id;
      if (contractId) {
        featuredAppRightCid = contractId;
        disclosedContracts.push({
          templateId: featuredAppRight.featured_app_right.template_id,
          contractId,
          createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
          synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
        });
      }
    } catch {
      // If featured app right lookup fails, continue with null (optional)
      // This is expected when the provider doesn't have a featured app right
    }
  }

  return {
    paymentContext: {
      amuletRulesCid,
      openMiningRoundCid,
      featuredAppRight: featuredAppRightCid,
    },
    disclosedContracts,
  };
}

/**
 * Build payment context with payer's amulets for initial paymentStream approval
 *
 * Queries the ledger for:
 *
 * - Payer's Amulet contracts (via Validator API)
 * - AmuletRules contract
 * - OpenMiningRound contract
 * - FeaturedAppRight contract
 *
 * Selects the minimum number of amulets needed to cover the requested amount, choosing largest amulets first to
 * minimize the number of inputs.
 *
 * Returns both the payment context and the disclosed contracts needed
 *
 * NOTE: The validatorClient must be authenticated as the payerParty
 *
 * @param validatorClient - Validator API client authenticated as payer
 * @param payerParty - Party ID of the payer (for validation only)
 * @param requestedAmount - Amount in CC needed for the payment
 * @param provider - Provider party ID for featured app right lookup
 */
export async function buildPaymentContextWithAmulets(
  validatorClient: ValidatorApiClient,
  payerParty: string,
  requestedAmount: string,
  provider: string
): Promise<PaymentContextWithAmuletsAndDisclosed> {
  // Get payer's Amulet contracts via Validator API
  // Note: validatorClient must be authenticated as payerParty
  const amuletsResponse = await validatorClient.getAmulets();

  if (amuletsResponse.amulets.length === 0) {
    throw new OcpValidationError('payerParty.amulets', `Payer ${payerParty} has no Amulet contracts`, {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: payerParty,
    });
  }

  // Map amulets with their effective amounts
  const amuletsWithAmounts = amuletsResponse.amulets.map((amulet) => ({
    contractId: amulet.contract.contract.contract_id,
    templateId: amulet.contract.contract.template_id,
    synchronizerId: amulet.contract.domain_id,
    effectiveAmount: parseFloat(amulet.effective_amount),
    createdEventBlob: amulet.contract.contract.created_event_blob,
  }));

  // Sort by effective amount (largest first) to minimize number of inputs
  amuletsWithAmounts.sort((a, b) => b.effectiveAmount - a.effectiveAmount);

  // Select minimum amulets needed to cover requested amount
  const requestedAmountNum = parseFloat(requestedAmount);
  const selectedAmulets: typeof amuletsWithAmounts = [];
  let accumulatedAmount = 0;

  for (const amulet of amuletsWithAmounts) {
    selectedAmulets.push(amulet);
    accumulatedAmount += amulet.effectiveAmount;

    // Stop once we have enough to cover the requested amount
    if (accumulatedAmount >= requestedAmountNum) {
      break;
    }
  }

  // Check if we have sufficient funds
  if (accumulatedAmount < requestedAmountNum) {
    throw new OcpValidationError(
      'payerParty.balance',
      `Insufficient funds: Payer ${payerParty} has ${accumulatedAmount.toFixed(2)} CC available but needs ${requestedAmountNum.toFixed(2)} CC (missing ${(requestedAmountNum - accumulatedAmount).toFixed(2)} CC)`,
      { code: OcpErrorCodes.OUT_OF_RANGE, receivedValue: accumulatedAmount }
    );
  }

  // Build disclosed contracts for selected amulets
  const amuletDisclosedContracts = selectedAmulets.map((amulet) => ({
    templateId: amulet.templateId,
    contractId: amulet.contractId,
    createdEventBlob: amulet.createdEventBlob,
    synchronizerId: amulet.synchronizerId,
  }));

  // Get AmuletRules contract
  const amuletRulesResponse = await validatorClient.getAmuletRules();
  const amuletRulesCid = amuletRulesResponse.amulet_rules.contract.contract_id;
  const amuletRulesContract = {
    templateId: amuletRulesResponse.amulet_rules.contract.template_id,
    contractId: amuletRulesCid,
    createdEventBlob: amuletRulesResponse.amulet_rules.contract.created_event_blob,
    synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
  };

  // Get OpenMiningRound contract
  const miningRoundContext = await getCurrentMiningRoundContext(validatorClient);
  const openMiningRoundCid = miningRoundContext.openMiningRound;
  const { openMiningRoundContract } = miningRoundContext;

  // Build payment context with selected amulets
  const amuletInputs = selectedAmulets.map((a) => a.contractId);

  // Get FeaturedAppRight contract for provider
  let featuredAppRightCid: string | null = null;
  const disclosedContracts: DisclosedContract[] = [
    amuletRulesContract,
    openMiningRoundContract,
    ...amuletDisclosedContracts,
  ];

  try {
    const featuredAppRight = await validatorClient.lookupFeaturedAppRight({ partyId: provider });
    const contractId = featuredAppRight.featured_app_right?.contract_id;
    if (contractId) {
      featuredAppRightCid = contractId;
      disclosedContracts.push({
        templateId: featuredAppRight.featured_app_right.template_id,
        contractId,
        createdEventBlob: featuredAppRight.featured_app_right.created_event_blob,
        synchronizerId: amuletRulesResponse.amulet_rules.domain_id,
      });
    }
  } catch {
    // If featured app right lookup fails, continue with null (optional)
    // This is expected when the provider doesn't have a featured app right
  }

  return {
    paymentContext: {
      payerAmulets: amuletInputs,
      amuletRulesCid,
      openMiningRoundCid,
      featuredAppRight: featuredAppRightCid,
    },
    disclosedContracts,
  };
}
