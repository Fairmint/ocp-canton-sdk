/** Compile-time contracts for built stakeholder relationship declarations. */

import { STAKEHOLDER_RELATIONSHIP_TYPES, type OcfStakeholder, type StakeholderRelationshipType } from '../../dist';
import type { DamlDataTypeFor } from '../../dist/functions/OpenCapTable/capTable/batchTypes';

type ExpectedRelationshipTuple = readonly [
  'ADVISOR',
  'BOARD_MEMBER',
  'CONSULTANT',
  'EMPLOYEE',
  'EX_ADVISOR',
  'EX_CONSULTANT',
  'EX_EMPLOYEE',
  'EXECUTIVE',
  'FOUNDER',
  'INVESTOR',
  'NON_US_EMPLOYEE',
  'OFFICER',
  'OTHER',
];
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactly<A, B> =
  IsAny<A> extends true
    ? false
    : IsAny<B> extends true
      ? false
      : [A] extends [B]
        ? [B] extends [A]
          ? true
          : false
        : false;
type EveryTrue<T extends readonly boolean[]> = Exclude<T[number], true> extends never ? true : false;

type ExpectedDamlRelationship =
  | 'OcfRelAdvisor'
  | 'OcfRelBoardMember'
  | 'OcfRelConsultant'
  | 'OcfRelEmployee'
  | 'OcfRelExAdvisor'
  | 'OcfRelExConsultant'
  | 'OcfRelExEmployee'
  | 'OcfRelExecutive'
  | 'OcfRelFounder'
  | 'OcfRelInvestor'
  | 'OcfRelNonUsEmployee'
  | 'OcfRelOfficer'
  | 'OcfRelOther';
type GeneratedDamlRelationship = DamlDataTypeFor<'stakeholder'>['current_relationships'][number];

const exactTuple: Assert<IsExactly<typeof STAKEHOLDER_RELATIONSHIP_TYPES, ExpectedRelationshipTuple>> = true;
const exactUnion: Assert<IsExactly<StakeholderRelationshipType, ExpectedRelationshipTuple[number]>> = true;
const exactStakeholderField: Assert<
  IsExactly<OcfStakeholder['current_relationships'], StakeholderRelationshipType[] | undefined>
> = true;
const exactGeneratedDamlUnion: Assert<IsExactly<GeneratedDamlRelationship, ExpectedDamlRelationship>> = true;
const relationshipTypesAreNotAny: Assert<
  EveryTrue<
    [
      IsExactly<IsAny<typeof STAKEHOLDER_RELATIONSHIP_TYPES>, false>,
      IsExactly<IsAny<StakeholderRelationshipType>, false>,
      IsExactly<IsAny<OcfStakeholder['current_relationships']>, false>,
      IsExactly<IsAny<GeneratedDamlRelationship>, false>,
    ]
  >
> = true;

// @ts-expect-error built tuple declarations remain readonly
STAKEHOLDER_RELATIONSHIP_TYPES[0] = 'OTHER';
// @ts-expect-error built tuple declarations cannot be extended
STAKEHOLDER_RELATIONSHIP_TYPES.push('ADVISOR');
// @ts-expect-error built declarations reject legacy relationship aliases
const legacyRelationship: StakeholderRelationshipType = 'DIRECTOR';

void exactTuple;
void exactUnion;
void exactStakeholderField;
void exactGeneratedDamlUnion;
void relationshipTypesAreNotAny;
void legacyRelationship;
