import { OcpParseError } from '../../src/errors';
import { readCapTablePositionFields } from '../../src/functions/OpenCapTable/positions/capTablePositionFields';
import { capTablePayload } from './positionFixtures';

describe('readCapTablePositionFields', () => {
  it('reads a 0.0.3 CapTable without position fields as no positions', () => {
    const fields = readCapTablePositionFields(capTablePayload());

    expect(fields.enabled).toBe(false);
    expect(fields.registries.size).toBe(0);
    expect(fields.migratedSecurityIds.size).toBe(0);
    expect(fields.ancestorSecurityIds.size).toBe(0);
  });

  it('reads None (null) fields as no positions', () => {
    const fields = readCapTablePositionFields(
      capTablePayload({ positionRegistries: null, migrated: null, ancestors: null })
    );

    expect(fields.enabled).toBe(false);
  });

  it('reads Some empty maps as no positions', () => {
    const fields = readCapTablePositionFields(capTablePayload({ positionRegistries: [], migrated: [], ancestors: [] }));

    expect(fields.enabled).toBe(false);
  });

  it('reads managed classes, migrated securities and their ancestors', () => {
    const fields = readCapTablePositionFields(
      capTablePayload({
        positionRegistries: [['CLASS-MANAGED', 'registry-cid']],
        migrated: [
          ['S1', 'SH-A'],
          ['S2-BAL', 'SH-B'],
        ],
        ancestors: [['S2', 'S2-BAL']],
      })
    );

    expect(fields.enabled).toBe(true);
    expect([...fields.registries]).toEqual([['CLASS-MANAGED', 'registry-cid']]);
    expect([...fields.migratedSecurityIds]).toEqual([
      ['S1', 'SH-A'],
      ['S2-BAL', 'SH-B'],
    ]);
    expect([...fields.ancestorSecurityIds]).toEqual([['S2', 'S2-BAL']]);
  });

  it('treats any non-empty field as enabled, as the ledger guard does', () => {
    expect(readCapTablePositionFields(capTablePayload({ migrated: [['S1', 'SH-A']] })).enabled).toBe(true);
    expect(readCapTablePositionFields(capTablePayload({ ancestors: [['S0', 'S1']] })).enabled).toBe(true);
  });

  it('rejects a field that is not a DAML Map of strings', () => {
    expect(() =>
      readCapTablePositionFields({ ...capTablePayload(), position_registries: { 'CLASS-MANAGED': 'cid' } }, 'ct-1')
    ).toThrow(OcpParseError);
    expect(() =>
      readCapTablePositionFields({ ...capTablePayload(), position_migrated_security_ids: [['S1', 7]] }, 'ct-1')
    ).toThrow(/position_migrated_security_ids entry 0 must map to a non-empty string/);
  });
});
