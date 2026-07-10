import {
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  isOcfEntityType,
  type OcfEntityType,
} from '../../src';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';

const entityTypes = Object.keys(ENTITY_REGISTRY) as OcfEntityType[];

describe('batch entity capabilities', () => {
  it.each(entityTypes)('recognizes %s as a supported entity type', (entityType) => {
    expect(isOcfEntityType(entityType)).toBe(true);
  });

  it('rejects unknown entity types', () => {
    expect(isOcfEntityType('notAnEntity')).toBe(false);
  });

  it.each(entityTypes)('derives the complete operation set for %s from the registry', (entityType) => {
    const isIssuer = entityType === 'issuer';
    expect(isOcfCreatableEntityType(entityType)).toBe(!isIssuer);
    expect(isOcfEditableEntityType(entityType)).toBe(true);
    expect(isOcfDeletableEntityType(entityType)).toBe(!isIssuer);
  });

  it('rejects unknown entity types for every capability', () => {
    expect(isOcfCreatableEntityType('notAnEntity')).toBe(false);
    expect(isOcfEditableEntityType('notAnEntity')).toBe(false);
    expect(isOcfDeletableEntityType('notAnEntity')).toBe(false);
  });
});
