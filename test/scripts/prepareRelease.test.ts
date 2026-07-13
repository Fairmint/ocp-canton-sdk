import { selectReleaseVersion } from '../../scripts/prepare-release';

describe('selectReleaseVersion', () => {
  const withTakenVersions = (...versions: string[]) => {
    const takenVersions = new Set(versions);
    return (version: string): boolean => takenVersions.has(version);
  };

  test('publishes an intentionally advanced manifest version unchanged', () => {
    expect(selectReleaseVersion('0.6.0', '0.5.23', withTakenVersions('0.5.23'))).toBe('0.6.0');
  });

  test('resumes patch increments after the manifest version has been published', () => {
    expect(selectReleaseVersion('0.6.0', '0.6.0', withTakenVersions('0.6.0'))).toBe('0.6.1');
  });

  test('increments from a newer NPM baseline and skips unavailable versions', () => {
    expect(selectReleaseVersion('0.6.0', '0.6.2', withTakenVersions('0.6.2', '0.6.3'))).toBe('0.6.4');
  });

  test('does not reuse an advanced manifest version that is already tagged', () => {
    expect(selectReleaseVersion('0.6.0', '0.5.23', withTakenVersions('0.6.0'))).toBe('0.6.1');
  });
});
