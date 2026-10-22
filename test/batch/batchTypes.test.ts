import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import {
  isOcfCreatableEntityType,
  isOcfDeletableEntityType,
  isOcfEditableEntityType,
  isOcfEntityType,
  isOcfLedgerWrittenEntityType,
  isOcfReadableObjectType,
  mapOcfObjectTypeToEntityType,
  OCF_LEDGER_WRITTEN_ENTITY_TYPES,
  OCF_OBJECT_TYPE_TO_ENTITY_TYPE,
  type OcfEntityType,
} from '../../src';
import { ENTITY_REGISTRY, OCF_DATA_FIELD } from '../../src/functions/OpenCapTable/capTable/batchTypes';

const entityTypes = Object.keys(ENTITY_REGISTRY) as OcfEntityType[];

function decodeFailure(decode: () => unknown): string {
  try {
    decode();
  } catch (error) {
    // The generated decoders throw a DecoderError record, not an Error
    return typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  }
  throw new Error('Expected the generated codec to reject the value');
}

describe('entity registry capabilities', () => {
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

  it.each(entityTypes)('derives the capability set for %s from the registry', (entityType) => {
    const isIssuer = entityType === 'issuer';
    const isLedgerWritten = isOcfLedgerWrittenEntityType(entityType);
    expect(isOcfCreatableEntityType(entityType)).toBe(!isIssuer && !isLedgerWritten);
    expect(isOcfEditableEntityType(entityType)).toBe(!isLedgerWritten);
    expect(isOcfDeletableEntityType(entityType)).toBe(!isIssuer && !isLedgerWritten);
  });

  it('registers 51 entity kinds: the 49 the SDK writes and the register-written hold pair, read-only', () => {
    expect(entityTypes).toHaveLength(51);
    expect([...OCF_LEDGER_WRITTEN_ENTITY_TYPES]).toEqual(['stockHold', 'stockHoldCancellation']);
    expect(entityTypes.filter(isOcfEditableEntityType)).toHaveLength(49);
    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE.TX_STOCK_HOLD).toBe('stockHold');
    expect(OCF_OBJECT_TYPE_TO_ENTITY_TYPE.TX_STOCK_HOLD_CANCELLATION).toBe('stockHoldCancellation');
    expect(ENTITY_REGISTRY.stockHold.objectType).toBe('TX_STOCK_HOLD');
    expect(ENTITY_REGISTRY.stockHoldCancellation.objectType).toBe('TX_STOCK_HOLD_CANCELLATION');
  });

  it('keeps every OCF record in the one v35 data field', () => {
    expect(OCF_DATA_FIELD).toBe('ocf_data');
  });

  it.each(entityTypes)('pairs %s with its OcfRecordData and OcfRecordCid constructors', (entityType) => {
    const entry = ENTITY_REGISTRY[entityType];
    const name = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    expect(entry.recordTag).toBe(`OcfRecordData${name}`);
    expect(entry.cidTag).toBe(`OcfRecordCid${name}`);
  });

  it('names a constructor of the generated OcfRecordData and OcfRecordCid codecs for every entry', () => {
    const { OcfRecordData, OcfRecordCid } = Fairmint.OpenCapTable.OcfRecords;
    // A tag no constructor has is rejected with the list of constructors the codec expects.
    const dataConstructors = decodeFailure(() => OcfRecordData.decoder.runWithException({ tag: 'Bogus', value: {} }));
    const cidConstructors = decodeFailure(() => OcfRecordCid.decoder.runWithException({ tag: 'Bogus', value: 'cid' }));
    for (const entityType of entityTypes) {
      const entry = ENTITY_REGISTRY[entityType];
      expect(dataConstructors).toContain(`expected "${entry.recordTag}"`);
      expect(cidConstructors).toContain(`expected "${entry.cidTag}"`);
    }
  });

  it('exposes only the object type, template ID, record tag and contract tag per entry', () => {
    for (const entityType of entityTypes) {
      expect(Object.keys(ENTITY_REGISTRY[entityType]).sort()).toEqual([
        'cidTag',
        'objectType',
        'recordTag',
        'templateId',
      ]);
    }
  });

  it('rejects unknown entity types for every capability', () => {
    expect(isOcfLedgerWrittenEntityType('notAnEntity')).toBe(false);
    expect(isOcfCreatableEntityType('notAnEntity')).toBe(false);
    expect(isOcfEditableEntityType('notAnEntity')).toBe(false);
    expect(isOcfDeletableEntityType('notAnEntity')).toBe(false);
  });
});
