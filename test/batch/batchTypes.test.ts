import {
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  isOcfEntityType,
  isOcfReadableObjectType,
  mapOcfObjectTypeToEntityType,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfEntityType,
} from '../../src';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';

const entityTypes = Object.keys(ENTITY_REGISTRY) as OcfEntityType[];

describe('batch entity capabilities', () => {
  it('maps every registered entity type from a canonical OCF object type', () => {
    expect(new Set(Object.values(OCF_OBJECT_TYPE_TO_ENTITY_TYPE))).toEqual(new Set(entityTypes));
  });

  it('keeps the public object-type mapping immutable at runtime', () => {
    expect(Object.isFrozen(OCF_OBJECT_TYPE_TO_ENTITY_TYPE)).toBe(true);

    expect(Reflect.set(OCF_OBJECT_TYPE_TO_ENTITY_TYPE, 'STOCK_CLASS', 'issuer')).toBe(false);
    expect(Reflect.set(OCF_OBJECT_TYPE_TO_ENTITY_TYPE, 'SYNTHETIC', 'stakeholder')).toBe(false);

    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE.STOCK_CLASS).toBe('stockClass');
    expect(mapOcfObjectTypeToEntityType('STOCK_CLASS')).toBe('stockClass');
    expect(isOcfReadableObjectType('SYNTHETIC')).toBe(false);
    expect(mapOcfObjectTypeToEntityType('SYNTHETIC')).toBeNull();
  });

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
