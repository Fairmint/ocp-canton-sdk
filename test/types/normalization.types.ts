/** Compile-time contracts for canonicalization helpers exported from source. */

import {
  deepNormalizeNumericStrings,
  normalizeEntityType,
  normalizeObjectType,
  normalizeOcfData,
  type OcfPlanSecurityIssuance,
} from '../../src';

const normalizedNumericString: string = deepNormalizeNumericStrings('1.00' as const);
void normalizedNumericString;

// @ts-expect-error numeric normalization can change a string literal's value
const staleNumericLiteral: '1.00' = deepNormalizeNumericStrings('1.00' as const);
void staleNumericLiteral;

const normalizedEntity = normalizeEntityType('planSecurityIssuance');
const exactEntity: 'equityCompensationIssuance' = normalizedEntity;
void exactEntity;

const unchangedEntity = normalizeEntityType('stockIssuance');
const exactUnchangedEntity: 'stockIssuance' = unchangedEntity;
void exactUnchangedEntity;

const normalizedPlanSecurity = normalizeObjectType('TX_PLAN_SECURITY_ISSUANCE');
const exactPlanSecurity: 'TX_EQUITY_COMPENSATION_ISSUANCE' = normalizedPlanSecurity;
void exactPlanSecurity;

const unchangedObjectType = normalizeObjectType('TX_STOCK_ISSUANCE');
const exactUnchangedObjectType: 'TX_STOCK_ISSUANCE' = unchangedObjectType;
void exactUnchangedObjectType;

declare const planSecurityIssuance: OcfPlanSecurityIssuance;
const normalizedData: Record<string, unknown> = normalizeOcfData(planSecurityIssuance);
void normalizedData;

// @ts-expect-error normalization may rename the discriminator and fields, so the result cannot retain the input type
const unsoundPlanSecurityClaim: OcfPlanSecurityIssuance = normalizeOcfData(planSecurityIssuance);
void unsoundPlanSecurityClaim;
