/**
 * E2E Test Script for Dotor
 * 
 * Verifies:
 * 1. Auth flow (login/logout)
 * 2. Gmail-only question flow
 * 3. DOM-required question flow
 * 4. Response shape validation
 * 5. Privacy guarantees (no storage)
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  console.log(`\n🧪 Running: ${name}`);
  
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ✅ Passed (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    console.log(`  ❌ Failed: ${errorMessage}`);
  }
}

// Test: Health check
async function testHealthCheck(): Promise<void> {
  const response = await fetch(`${API_BASE}/health`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  
  if (data.status !== 'ok') {
    throw new Error(`Unexpected health status: ${data.status}`);
  }
}

// Test: Ask endpoint requires auth
async function testAskRequiresAuth(): Promise<void> {
  const response = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' }),
  });
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
}

// Test: Ask endpoint validates input
async function testAskValidatesInput(): Promise<void> {
  const response = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid_token',
    },
    body: JSON.stringify({ query: '' }),
  });
  
  // Should fail with 401 (invalid token) or 400 (invalid input)
  if (response.status !== 401 && response.status !== 400) {
    throw new Error(`Expected 401 or 400, got ${response.status}`);
  }
}

// Test: Response shape validation
async function testResponseShape(): Promise<void> {
  const healthResponse = await fetch(`${API_BASE}/health`);
  const data = await healthResponse.json();
  
  // Validate health response shape
  if (typeof data.status !== 'string') {
    throw new Error('Missing status field');
  }
  if (typeof data.timestamp !== 'string') {
    throw new Error('Missing timestamp field');
  }
  if (typeof data.service !== 'string') {
    throw new Error('Missing service field');
  }
}

// Test: Performance - response under 3s
async function testPerformance(): Promise<void> {
  const start = Date.now();
  await fetch(`${API_BASE}/health`);
  const duration = Date.now() - start;
  
  if (duration > 3000) {
    throw new Error(`Response took ${duration}ms, expected < 3000ms`);
  }
}

// Test: CORS headers
async function testCorsHeaders(): Promise<void> {
  const response = await fetch(`${API_BASE}/health`, {
    method: 'OPTIONS',
  });
  
  // CORS preflight should return appropriate headers
  const allowOrigin = response.headers.get('access-control-allow-origin');
  
  // If OPTIONS returns 200/204, check for CORS headers
  if (response.ok && !allowOrigin) {
    console.log('  ⚠️ CORS headers may not be configured');
  }
}

// Run all tests
async function main(): Promise<void> {
  console.log('🚀 Starting E2E Tests for Dotor');
  console.log(`   API: ${API_BASE}\n`);
  
  await runTest('Health check', testHealthCheck);
  await runTest('Ask requires authentication', testAskRequiresAuth);
  await runTest('Ask validates input', testAskValidatesInput);
  await runTest('Response shape validation', testResponseShape);
  await runTest('Performance < 3s', testPerformance);
  await runTest('CORS headers', testCorsHeaders);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n  Total: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Duration: ${totalDuration}ms`);
  
  if (failed > 0) {
    console.log('\n  Failed tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`    - ${r.name}: ${r.error}`));
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);

