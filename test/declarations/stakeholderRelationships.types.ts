/** Compile-time contracts for built stakeholder relationship declarations. */

import { STAKEHOLDER_RELATIONSHIP_TYPES, type StakeholderRelationshipType } from '../../dist';

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
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const exactTuple: Assert<IsExactly<typeof STAKEHOLDER_RELATIONSHIP_TYPES, ExpectedRelationshipTuple>> = true;
const exactUnion: Assert<IsExactly<StakeholderRelationshipType, ExpectedRelationshipTuple[number]>> = true;

// @ts-expect-error built tuple declarations remain readonly
STAKEHOLDER_RELATIONSHIP_TYPES[0] = 'OTHER';
// @ts-expect-error built tuple declarations cannot be extended
STAKEHOLDER_RELATIONSHIP_TYPES.push('ADVISOR');
// @ts-expect-error built declarations reject legacy relationship aliases
const legacyRelationship: StakeholderRelationshipType = 'DIRECTOR';

void exactTuple;
void exactUnion;
void legacyRelationship;
