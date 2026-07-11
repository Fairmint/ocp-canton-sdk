/** Compile-time contracts for canonical source stakeholder relationships. */

import { STAKEHOLDER_RELATIONSHIP_TYPES, type StakeholderRelationshipType } from '../../src';

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

// @ts-expect-error the canonical tuple is readonly
STAKEHOLDER_RELATIONSHIP_TYPES[0] = 'OTHER';
// @ts-expect-error the canonical tuple cannot be extended
STAKEHOLDER_RELATIONSHIP_TYPES.push('ADVISOR');
// @ts-expect-error legacy relationship aliases are not part of the canonical union
const legacyRelationship: StakeholderRelationshipType = 'DIRECTOR';

void exactTuple;
void exactUnion;
void legacyRelationship;
