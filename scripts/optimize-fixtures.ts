#!/usr/bin/env ts-node

/**
 * Script to optimize test fixtures by removing files that don't contribute to test coverage.
 *
 * This script:
 *
 * 1. Runs test:coverage to get baseline coverage
 * 2. Iterates through fixture files from largest to smallest
 * 3. For each file: deletes it, runs coverage again, and compares results
 * 4. If coverage drops, restores the file; otherwise keeps it deleted
 * 5. Generates a report of removed files
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface FileInfo {
  path: string;
  name: string;
  size: number;
}

const FIXTURES_DIR = path.join(process.cwd(), 'test/fixtures/createOcf');
const BACKUP_DIR = path.join(process.cwd(), 'test/fixtures/.backup-createOcf');

/** Parse coverage summary from Jest output */
function parseCoverage(coverageOutput: string): CoverageData {
  // Look for the coverage summary table in Jest output
  const lines = coverageOutput.split('\n');
  let totalLine = '';

  for (const line of lines) {
    if (line.includes('All files')) {
      totalLine = line;
      break;
    }
  }

  if (!totalLine) {
    console.error('Could not find coverage summary in output');
    console.error('Output:', coverageOutput);
    throw new Error('Failed to parse coverage data');
  }

  // Extract percentages from the line
  // Format: "All files    |   XX.XX |   XX.XX |   XX.XX |   XX.XX |"
  const percentages = totalLine.match(/\d+\.\d+/g);

  if (!percentages || percentages.length < 4) {
    console.error('Could not parse coverage percentages from line:', totalLine);
    throw new Error('Failed to parse coverage percentages');
  }

  return {
    statements: parseFloat(percentages[0]),
    branches: parseFloat(percentages[1]),
    functions: parseFloat(percentages[2]),
    lines: parseFloat(percentages[3]),
  };
}

/** Run test coverage and return coverage data */
function runCoverage(): CoverageData {
  console.log('  Running test:coverage...');
  try {
    const output = execSync('npm run test:coverage 2>&1', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return parseCoverage(output);
  } catch (error: any) {
    // Jest might exit with non-zero code even on successful coverage run
    if (error.stdout) {
      return parseCoverage(error.stdout);
    }
    throw error;
  }
}

/** Check if coverage has decreased */
function coverageDecreased(baseline: CoverageData, current: CoverageData): boolean {
  return (
    current.statements < baseline.statements ||
    current.branches < baseline.branches ||
    current.functions < baseline.functions ||
    current.lines < baseline.lines
  );
}

/** Get all fixture files sorted by size (largest first) */
function getFixtureFilesSortedBySize(): FileInfo[] {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  const filesWithSize = files.map((name) => {
    const filePath = path.join(FIXTURES_DIR, name);
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name,
      size: stats.size,
    };
  });

  // Sort by size descending (largest first)
  filesWithSize.sort((a, b) => b.size - a.size);

  return filesWithSize;
}

/** Main function */
function main() {
  console.log('='.repeat(80));
  console.log('Test Fixture Optimization Script');
  console.log('='.repeat(80));
  console.log();

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Get baseline coverage
  console.log('Step 1: Getting baseline coverage...');
  const baselineCoverage = runCoverage();
  console.log('  Baseline coverage:');
  console.log(`    Statements: ${baselineCoverage.statements}%`);
  console.log(`    Branches:   ${baselineCoverage.branches}%`);
  console.log(`    Functions:  ${baselineCoverage.functions}%`);
  console.log(`    Lines:      ${baselineCoverage.lines}%`);
  console.log();

  // Get all fixture files sorted by size
  const files = getFixtureFilesSortedBySize();
  console.log(`Step 2: Found ${files.length} fixture files to test`);
  console.log();

  const removedFiles: string[] = [];
  const restoredFiles: string[] = [];
  let totalSizeRemoved = 0;

  // Time tracking for estimation
  const testTimes: number[] = [];
  const ESTIMATION_SAMPLE_SIZE = 5;

  // Test each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;
    const sizeKB = (file.size / 1024).toFixed(2);

    // Calculate and display time estimate after first few files
    let timeEstimate = '';
    if (testTimes.length >= ESTIMATION_SAMPLE_SIZE) {
      const avgTimePerFile = testTimes.reduce((a, b) => a + b, 0) / testTimes.length;
      const remainingFiles = files.length - i;
      const estimatedSeconds = avgTimePerFile * remainingFiles;
      const hours = Math.floor(estimatedSeconds / 3600);
      const minutes = Math.floor((estimatedSeconds % 3600) / 60);
      const seconds = Math.floor(estimatedSeconds % 60);

      if (hours > 0) {
        timeEstimate = ` (Est. ${hours}h ${minutes}m remaining)`;
      } else if (minutes > 0) {
        timeEstimate = ` (Est. ${minutes}m ${seconds}s remaining)`;
      } else {
        timeEstimate = ` (Est. ${seconds}s remaining)`;
      }
    } else if (testTimes.length > 0) {
      timeEstimate = ' (Calculating estimate...)';
    }

    console.log(`${progress} Testing ${file.name} (${sizeKB} KB)${timeEstimate}`);

    const startTime = Date.now();

    // Check if file still exists (might have been deleted already)
    if (!fs.existsSync(file.path)) {
      console.log(`  ⚠️  File already deleted, skipping`);
      console.log();
      continue;
    }

    // Backup the file
    const backupPath = path.join(BACKUP_DIR, file.name);
    fs.copyFileSync(file.path, backupPath);

    // Delete the file
    fs.unlinkSync(file.path);
    console.log('  🗑️  Deleted file');

    try {
      // Run coverage
      const newCoverage = runCoverage();

      // Check if coverage decreased
      if (coverageDecreased(baselineCoverage, newCoverage)) {
        console.log('  ❌ Coverage decreased - restoring file');
        console.log(`     Statements: ${baselineCoverage.statements}% → ${newCoverage.statements}%`);
        console.log(`     Branches:   ${baselineCoverage.branches}% → ${newCoverage.branches}%`);
        console.log(`     Functions:  ${baselineCoverage.functions}% → ${newCoverage.functions}%`);
        console.log(`     Lines:      ${baselineCoverage.lines}% → ${newCoverage.lines}%`);

        // Restore the file
        fs.copyFileSync(backupPath, file.path);
        restoredFiles.push(file.name);
      } else {
        console.log('  ✅ Coverage maintained - keeping file deleted');
        console.log(`     Statements: ${baselineCoverage.statements}% → ${newCoverage.statements}%`);
        console.log(`     Branches:   ${baselineCoverage.branches}% → ${newCoverage.branches}%`);
        console.log(`     Functions:  ${baselineCoverage.functions}% → ${newCoverage.functions}%`);
        console.log(`     Lines:      ${baselineCoverage.lines}% → ${newCoverage.lines}%`);

        removedFiles.push(file.name);
        totalSizeRemoved += file.size;
      }
    } catch (error) {
      console.error('  ⚠️  Error running coverage - restoring file');
      console.error(error);

      // Restore the file on error
      fs.copyFileSync(backupPath, file.path);
      restoredFiles.push(file.name);
    }

    // Track test time for estimation
    const testTime = (Date.now() - startTime) / 1000; // in seconds
    testTimes.push(testTime);

    // After collecting enough samples, show total time estimate once
    if (testTimes.length === ESTIMATION_SAMPLE_SIZE) {
      const avgTimePerFile = testTimes.reduce((a, b) => a + b, 0) / testTimes.length;
      const totalEstimatedSeconds = avgTimePerFile * files.length;
      const hours = Math.floor(totalEstimatedSeconds / 3600);
      const minutes = Math.floor((totalEstimatedSeconds % 3600) / 60);

      console.log('─'.repeat(80));
      console.log(`⏱️  Time Estimate Based on First ${ESTIMATION_SAMPLE_SIZE} Files:`);
      console.log(`   Average time per file: ${avgTimePerFile.toFixed(1)}s`);
      console.log(
        `   Total estimated time: ${hours}h ${minutes}m (${totalEstimatedSeconds.toFixed(0)}s) for all ${files.length} files`
      );
      console.log('─'.repeat(80));
      console.log();
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total files tested: ${files.length}`);
  console.log(`Files removed: ${removedFiles.length}`);
  console.log(`Files restored: ${restoredFiles.length}`);
  console.log(`Total size removed: ${(totalSizeRemoved / 1024 / 1024).toFixed(2)} MB`);
  console.log();

  if (removedFiles.length > 0) {
    console.log('Removed files:');
    removedFiles.forEach((name) => console.log(`  - ${name}`));
    console.log();

    // Save list of removed files
    const reportPath = path.join(process.cwd(), 'test/fixtures/removed-fixtures-report.txt');
    fs.writeFileSync(reportPath, `Fixtures removed on ${new Date().toISOString()}\n\n${removedFiles.join('\n')}\n`);
    console.log(`Report saved to: ${reportPath}`);
  }

  console.log();
  console.log('Backup files are available in:', BACKUP_DIR);
  console.log('='.repeat(80));
}

// Run the script
try {
  main();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
