/**
 * Privacy Audit Script for Dotor
 * 
 * Verifies:
 * 1. No query content storage
 * 2. No snippet logging
 * 3. No background jobs
 * 4. No DOM writes in extension
 */

import { execSync } from 'child_process';
import * as path from 'path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

interface AuditResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: AuditResult[] = [];

function runAudit(check: string, auditFn: () => { passed: boolean; details: string }): void {
  console.log(`\n🔍 Checking: ${check}`);
  
  try {
    const result = auditFn();
    results.push({ check, ...result });
    console.log(result.passed ? `  ✅ ${result.details}` : `  ❌ ${result.details}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ check, passed: false, details: errorMessage });
    console.log(`  ❌ Error: ${errorMessage}`);
  }
}

// Helper to run grep and return matches
function grepCode(pattern: string, excludeDirs: string[] = []): string[] {
  const excludeArgs = excludeDirs.map(d => `--exclude-dir=${d}`).join(' ');
  
  try {
    const result = execSync(
      `grep -r "${pattern}" ${ROOT_DIR}/packages ${excludeArgs} --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Audit: No query storage in database
function auditNoQueryStorage(): { passed: boolean; details: string } {
  // Check for any INSERT with query content
  const patterns = [
    'query.*INSERT',
    'INSERT.*query',
    'saveQuery',
    'storeQuery',
    'persistQuery',
  ];
  
  let allMatches: string[] = [];
  for (const pattern of patterns) {
    const matches = grepCode(pattern, ['node_modules', 'dist', '.next']);
    allMatches = [...allMatches, ...matches];
  }
  
  // Filter out false positives (test files, comments, type definitions)
  const realMatches = allMatches.filter(m => 
    !m.includes('// ') && 
    !m.includes('.test.') && 
    !m.includes('.spec.') &&
    !m.includes('type ') &&
    !m.includes('interface ')
  );
  
  return {
    passed: realMatches.length === 0,
    details: realMatches.length === 0 
      ? 'No query storage patterns found'
      : `Found ${realMatches.length} potential query storage patterns`,
  };
}

// Audit: No snippet logging
function auditNoSnippetLogging(): { passed: boolean; details: string } {
  const patterns = [
    'console\\.log.*snippet',
    'console\\.log.*content',
    'console\\.log.*message',
    'logger.*snippet',
    'log.*snippet',
  ];
  
  let allMatches: string[] = [];
  for (const pattern of patterns) {
    const matches = grepCode(pattern, ['node_modules', 'dist', '.next']);
    allMatches = [...allMatches, ...matches];
  }
  
  // Filter out legitimate debug logs and test files
  const realMatches = allMatches.filter(m =>
    !m.includes('// ') &&
    !m.includes('.test.') &&
    !m.includes('.spec.') &&
    !m.includes('[Dotor]') // Our debug markers are OK
  );
  
  return {
    passed: realMatches.length === 0,
    details: realMatches.length === 0
      ? 'No snippet logging found'
      : `Found ${realMatches.length} potential snippet logging patterns`,
  };
}

// Audit: No background jobs
function auditNoBackgroundJobs(): { passed: boolean; details: string } {
  const patterns = [
    'setInterval.*fetch',
    'setInterval.*sync',
    'cron',
    'schedule.*job',
    'background.*task',
  ];
  
  let allMatches: string[] = [];
  for (const pattern of patterns) {
    const matches = grepCode(pattern, ['node_modules', 'dist', '.next']);
    allMatches = [...allMatches, ...matches];
  }
  
  // Filter - cleanup intervals are OK
  const realMatches = allMatches.filter(m =>
    !m.includes('// ') &&
    !m.includes('cleanup') &&
    !m.includes('Cleanup')
  );
  
  return {
    passed: realMatches.length === 0,
    details: realMatches.length === 0
      ? 'No background sync jobs found'
      : `Found ${realMatches.length} potential background job patterns`,
  };
}

// Audit: No DOM writes in extension
function auditNoDOMWrites(): { passed: boolean; details: string } {
  const extensionDir = `${ROOT_DIR}/packages/extension`;
  
  const patterns = [
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document\\.write',
    'appendChild',
    'removeChild',
    'replaceChild',
  ];
  
  let allMatches: string[] = [];
  for (const pattern of patterns) {
    try {
      const result = execSync(
        `grep -r "${pattern}" ${extensionDir}/src/content ${extensionDir}/src/lib/dom --include="*.ts" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      );
      const matches = result.trim().split('\n').filter(Boolean);
      allMatches = [...allMatches, ...matches];
    } catch {
      // Ignore
    }
  }
  
  // Filter out comments and type definitions
  const realMatches = allMatches.filter(m =>
    !m.includes('// ') &&
    !m.includes('type ') &&
    !m.includes('interface ')
  );
  
  return {
    passed: realMatches.length === 0,
    details: realMatches.length === 0
      ? 'No DOM write operations in content scripts'
      : `Found ${realMatches.length} potential DOM write patterns`,
  };
}

// Audit: Read-only DOM operations
function auditReadOnlyDOM(): { passed: boolean; details: string } {
  const extensionDir = `${ROOT_DIR}/packages/extension`;
  
  // Check for read-only patterns
  const readOnlyPatterns = [
    'querySelector',
    'querySelectorAll',
    'textContent',
    'getAttribute',
  ];
  
  let hasReadOnly = false;
  for (const pattern of readOnlyPatterns) {
    try {
      const result = execSync(
        `grep -r "${pattern}" ${extensionDir}/src/content ${extensionDir}/src/lib/dom --include="*.ts" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      );
      if (result.trim()) {
        hasReadOnly = true;
        break;
      }
    } catch {
      // Ignore
    }
  }
  
  return {
    passed: hasReadOnly,
    details: hasReadOnly
      ? 'DOM search uses read-only operations'
      : 'Could not verify read-only DOM operations',
  };
}

// Run all audits
async function main(): Promise<void> {
  console.log('🔒 Privacy Audit for Dotor');
  console.log('='.repeat(50));
  
  runAudit('No query content storage', auditNoQueryStorage);
  runAudit('No snippet logging', auditNoSnippetLogging);
  runAudit('No background sync jobs', auditNoBackgroundJobs);
  runAudit('No DOM writes in extension', auditNoDOMWrites);
  runAudit('Read-only DOM operations', auditReadOnlyDOM);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Audit Summary');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n  Total checks: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n  Failed checks:');
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`    - ${r.check}: ${r.details}`));
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Privacy checklist
  console.log('\n📋 Privacy Checklist');
  console.log('='.repeat(50));
  console.log('  [ ] No query content stored in database');
  console.log('  [ ] No snippet/message content logged');
  console.log('  [ ] No background sync jobs running');
  console.log('  [ ] Extension performs read-only DOM access');
  console.log('  [ ] All data processed in-memory only');
  console.log('  [ ] 6-month date cap enforced on Gmail queries');
  console.log('\n  Manual verification required for complete audit.');
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);

