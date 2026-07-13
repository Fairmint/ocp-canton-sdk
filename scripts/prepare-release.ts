#!/usr/bin/env node

/**
 * Prepare Release Script
 *
 * Prepares a new release by incrementing version and generating changelog.
 *
 * Usage: npm run prepare-release
 *
 * Features:
 *
 * - Uses an intentionally advanced package.json version as the next release
 * - Otherwise increments the patch version in package.json
 * - Creates changelog from commits since last tag
 * - Links commits to GitHub PRs
 * - Safe for local testing (no git operations)
 * - Saves changelog to CHANGELOG.md
 * - Checks both git tags AND NPM registry to avoid version conflicts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

/** Check if a git tag exists */
function tagExists(tag: string): boolean {
  try {
    execSync(`git rev-parse "refs/tags/${tag}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Get all published versions from NPM registry */
function getAllNpmVersions(packageName: string): Set<string> {
  try {
    const result = execSync(`npm view "${packageName}" versions --json`, { encoding: 'utf8' }).trim();
    const versions = JSON.parse(result) as string | string[];
    // npm returns a string for single version, array for multiple
    if (Array.isArray(versions)) {
      return new Set(versions);
    }
    return new Set([versions]);
  } catch {
    // Package may not exist on NPM yet
    return new Set();
  }
}

/** Get the latest version from NPM registry */
function getLatestNpmVersion(packageName: string): string | null {
  try {
    const result = execSync(`npm view "${packageName}" version`, { encoding: 'utf8' }).trim();
    return result || null;
  } catch {
    // Package may not exist on NPM yet
    return null;
  }
}

/** Parse version string into components */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  // Ensure all version components are non-negative integers
  if (!parts.every((part) => Number.isInteger(part) && part >= 0)) {
    return null;
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Compare two parsed semantic versions. */
function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

/** Find the next available version by incrementing patch until we find one that doesn't exist on git tags OR NPM */
function findNextAvailableVersion(
  isVersionTaken: (version: string) => boolean,
  major: number,
  minor: number,
  startPatch: number
): string {
  let patch = startPatch;
  let version: string;

  do {
    patch++;
    version = `${major}.${minor}.${patch}`;
  } while (isVersionTaken(version));

  return version;
}

/**
 * Select the version to publish.
 *
 * A manifest version newer than the latest NPM version is an explicit release boundary (for example, moving from
 * 0.5.23 to 0.6.0), so publish it unchanged when it is available. Once that version exists, normal patch increments
 * resume from the highest manifest/NPM baseline.
 */
function selectReleaseVersion(
  manifestVersion: string,
  latestNpmVersion: string | null,
  isVersionTaken: (version: string) => boolean
): string {
  const manifestParsed = parseVersion(manifestVersion);
  if (!manifestParsed) {
    throw new Error('Invalid version format in package.json. Expected format: x.y.z');
  }

  const npmParsed = latestNpmVersion ? parseVersion(latestNpmVersion) : null;

  if (npmParsed && compareVersions(manifestParsed, npmParsed) > 0 && !isVersionTaken(manifestVersion)) {
    return manifestVersion;
  }

  const baseline = npmParsed && compareVersions(npmParsed, manifestParsed) > 0 ? npmParsed : manifestParsed;
  return findNextAvailableVersion(isVersionTaken, baseline.major, baseline.minor, baseline.patch);
}

/**
 * Prepare release by incrementing version and generating changelog This script can be run locally to test the release
 * process
 */
function prepareRelease(): void {
  try {
    // Read package.json
    const packageJsonPath: string = path.join(process.cwd(), 'package.json');
    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const packageName: string = packageJson.name;
    const currentVersion: string = packageJson.version;
    console.log(`Package: ${packageName}`);
    console.log(`Current version in package.json: ${currentVersion}`);

    // Fetch all NPM versions upfront (single API call)
    console.log('Fetching published versions from NPM...');
    const npmVersions = getAllNpmVersions(packageName);
    const latestNpmVersion = getLatestNpmVersion(packageName);

    if (latestNpmVersion) {
      console.log(`Latest version on NPM: ${latestNpmVersion}`);
      console.log(`Total published versions: ${npmVersions.size}`);
    } else {
      console.log('No version found on NPM (new package or registry unavailable)');
    }

    const isVersionTaken = (version: string): boolean => npmVersions.has(version) || tagExists(`v${version}`);
    const newVersion: string = selectReleaseVersion(currentVersion, latestNpmVersion, isVersionTaken);

    console.log(`New version: ${newVersion}`);

    // Update version in package.json (without git tag)
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

    console.log('✅ Updated package.json with new version');

    // Generate changelog since last tag or main branch
    let commits: string;
    let lastTag: string | null = null;
    try {
      lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
        encoding: 'utf8',
      }).trim();
      console.log(`Last tag: ${lastTag}`);
      commits = execSync(`git log --oneline --format="%s" ${lastTag}..HEAD`, {
        encoding: 'utf8',
      }).trim();
    } catch {
      // No previous tag, get commits ahead of main branch
      console.log('No previous tag found, getting commits ahead of main branch');
      commits = execSync('git log --oneline --format="%s" main..HEAD', {
        encoding: 'utf8',
      }).trim();
    }

    if (!commits) {
      console.log('No commits found for changelog');
      return;
    }

    // Extract PR numbers and create changelog
    const commitLines: string[] = commits.split('\n').map((commit: string): string => `- ${commit}`);

    const changelog: string = commitLines.join('\n');

    console.log('\n📋 Generated changelog:');
    console.log('='.repeat(50));
    console.log(changelog);
    console.log('='.repeat(50));

    // Create detailed tag message
    const tagMessage = `Release v${newVersion}\n\nChanges:\n${changelog}`;

    console.log('\n🏷️  Tag message preview:');
    console.log('='.repeat(50));
    console.log(tagMessage);
    console.log('='.repeat(50));

    // Save changelog to file for reference
    const changelogPath: string = path.join(process.cwd(), 'CHANGELOG.md');

    // Add previous version link if available
    const previousVersionLink: string = lastTag
      ? `\n[Previous version: ${lastTag}](https://github.com/Fairmint/ocp-canton-sdk/releases/tag/${lastTag})`
      : '';

    const changelogContent = `# Changelog for v${newVersion}\n\n${changelog}${previousVersionLink}\n\n`;

    // Prepend to existing changelog if it exists
    if (fs.existsSync(changelogPath)) {
      const existingChangelog: string = fs.readFileSync(changelogPath, 'utf8');
      fs.writeFileSync(changelogPath, changelogContent + existingChangelog);
    } else {
      fs.writeFileSync(changelogPath, changelogContent);
    }

    console.log(`\n✅ Saved changelog to CHANGELOG.md`);
    console.log(`\n🎯 Ready for release! Next steps:`);
    console.log(`1. Review the changes above`);
    console.log(`2. Run: npm publish (if ready to publish)`);
    console.log(`3. Run: git tag -a "v${newVersion}" -m "${tagMessage.replace(/\n/g, '\\n')}"`);
    console.log(`4. Run: git push origin "v${newVersion}"`);
  } catch (error) {
    console.error('❌ Error preparing release:', (error as Error).message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  prepareRelease();
}

export { prepareRelease, selectReleaseVersion };
