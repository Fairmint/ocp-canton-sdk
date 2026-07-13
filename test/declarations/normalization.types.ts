/** Compile-time contracts for canonicalization helpers in the built SDK declarations. */

import {
  deepNormalizeNumericStrings,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  normalizeZeroUuidSentinels,
  type OcfPlanSecurityIssuance,
} from '../../dist';

const normalizedNumericString: string = deepNormalizeNumericStrings('1.00' as const);
void normalizedNumericString;

// @ts-expect-error built declarations must not preserve a numeric string literal that can be rewritten
const staleNumericLiteral: '1.00' = deepNormalizeNumericStrings('1.00' as const);
void staleNumericLiteral;

const normalizedEntity = normalizeEntityType('planSecurityIssuance');
const exactEntity: 'equityCompensationIssuance' = normalizedEntity;
void exactEntity;

const normalizedObjectType = normalizeObjectType('TX_PLAN_SECURITY_ISSUANCE');
const exactObjectType: 'TX_EQUITY_COMPENSATION_ISSUANCE' = normalizedObjectType;
void exactObjectType;

declare const planSecurityIssuance: OcfPlanSecurityIssuance;
const normalizedData: Record<string, unknown> = normalizeOcfData(planSecurityIssuance);
void normalizedData;

const normalizedZeroUuidObject: Record<string, unknown> = normalizeZeroUuidSentinels({
  vesting_terms_id: '00000000-0000-0000-0000-000000000000',
});
void normalizedZeroUuidObject;

const maybeNormalizedUuid: string | undefined = normalizeZeroUuidSentinels(
  '00000000-0000-0000-0000-000000000000'
);
void maybeNormalizedUuid;

// @ts-expect-error built declarations must not claim normalization preserves a PlanSecurity object shape
const unsoundPlanSecurityClaim: OcfPlanSecurityIssuance = normalizeOcfData(planSecurityIssuance);
void unsoundPlanSecurityClaim;
