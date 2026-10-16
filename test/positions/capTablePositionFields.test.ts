import { OcpParseError } from '../../src/errors';
import { readCapTablePositionFields } from '../../src/functions/OpenCapTable/positions/capTablePositionFields';
import { capTablePayload } from './positionFixtures';

describe('readCapTablePositionFields', () => {
  it('reads a 0.0.3 CapTable without position fields as no positions', () => {
    const fields = readCapTablePositionFields(capTablePayload());

    expect(fields.enabled).toBe(false);
    expect(fields.registries.size).toBe(0);
    expect(fields.migratedSecurityIds.size).toBe(0);
  });

  it('reads None (null) fields as no positions', () => {
    const fields = readCapTablePositionFields(capTablePayload({ positionRegistries: null, migrated: null }));

    expect(fields.enabled).toBe(false);
  });

  it('reads Some empty maps as no positions', () => {
    const fields = readCapTablePositionFields(capTablePayload({ positionRegistries: [], migrated: [] }));

    expect(fields.enabled).toBe(false);
  });

  it('reads managed classes and migrated securities', () => {
    const fields = readCapTablePositionFields(
      capTablePayload({
        positionRegistries: [['CLASS-MANAGED', 'registry-cid']],
        migrated: [
          ['S1', 'SH-A'],
          ['S2-BAL', 'SH-B'],
        ],
      })
    );

    expect(fields.enabled).toBe(true);
    expect([...fields.registries]).toEqual([['CLASS-MANAGED', 'registry-cid']]);
    expect([...fields.migratedSecurityIds]).toEqual([
      ['S1', 'SH-A'],
      ['S2-BAL', 'SH-B'],
    ]);
  });

  it('is enabled by the registries alone, which are all the ledger guard reads', () => {
    const enabled = (options: Parameters<typeof capTablePayload>[0]) =>
      readCapTablePositionFields(capTablePayload(options)).enabled;

    expect(enabled({ positionRegistries: [['CLASS-M', 'cid']] })).toBe(true);
    expect(enabled({ migrated: [['S1', 'SH-A']] })).toBe(false);
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
