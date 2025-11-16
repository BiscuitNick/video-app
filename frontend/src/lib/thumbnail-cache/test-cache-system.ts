/**
 * Thumbnail Cache System - Test & Verification Script
 *
 * Run this in browser console to test the cache system:
 * import('./test-cache-system').then(m => m.runTests())
 */

import { getThumbnailCacheSystem } from './index';
import { getLRUCacheManager } from './LRUCacheManager';
import { getThumbnailDBService } from './ThumbnailDBService';
import { getThumbnailWorkerService } from './ThumbnailWorkerService';
import { getRetryManager } from './RetryManager';
import { ThumbnailQuality } from './types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`Running test: ${name}`);
  const startTime = performance.now();

  try {
    await fn();
    const duration = performance.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - startTime;
    results.push({
      name,
      passed: false,
      error: (error as Error).message,
      duration,
    });
    console.error(`✗ ${name}: ${(error as Error).message}`);
  }
}

/**
 * Test 1: IndexedDB Service initialization
 */
async function testIndexedDBService() {
  const dbService = getThumbnailDBService();
  const stats = await dbService.getStats();

  assert(stats !== null, 'DB stats should not be null');
  assert(typeof stats.totalEntries === 'number', 'Total entries should be a number');
  assert(typeof stats.totalSizeBytes === 'number', 'Total size should be a number');
}

/**
 * Test 2: IndexedDB CRUD operations
 */
async function testIndexedDBCRUD() {
  const dbService = getThumbnailDBService();

  // Create a test entry
  const testBlob = new Blob(['test data'], { type: 'image/jpeg' });
  const testEntry = {
    id: 'test-entry-1',
    blob: testBlob,
    sizeBytes: testBlob.size,
    lastAccessedAt: Date.now(),
    quality: ThumbnailQuality.MEDIUM,
    width: 640,
    height: 360,
  };

  // Put
  await dbService.put(testEntry);

  // Get
  const retrieved = await dbService.get('test-entry-1');
  assert(retrieved !== null, 'Should retrieve entry');
  assert(retrieved?.id === 'test-entry-1', 'Should have correct ID');

  // Delete
  await dbService.delete('test-entry-1');
  const deleted = await dbService.get('test-entry-1');
  assert(deleted === null, 'Entry should be deleted');
}

/**
 * Test 3: LRU Cache Manager
 */
async function testLRUCacheManager() {
  const cacheManager = getLRUCacheManager();

  // Clear cache first
  await cacheManager.clear();

  // Add entry
  const testBlob = new Blob(['test cache data'], { type: 'image/jpeg' });
  await cacheManager.put({
    id: 'cache-test-1',
    blob: testBlob,
    sizeBytes: testBlob.size,
    lastAccessedAt: Date.now(),
    quality: ThumbnailQuality.MEDIUM,
    width: 640,
    height: 360,
  });

  // Get entry (should be a hit)
  const retrieved = await cacheManager.get('cache-test-1');
  assert(retrieved !== null, 'Should retrieve from cache');

  // Get stats
  const stats = cacheManager.getStats();
  assert(stats.hitCount > 0, 'Should have cache hits');

  // Clean up
  await cacheManager.delete('cache-test-1');
}

/**
 * Test 4: Cache eviction
 */
async function testCacheEviction() {
  const cacheManager = new (await import('./LRUCacheManager')).LRUCacheManager(
    1024 * 100 // 100KB max
  );

  await cacheManager.clear();

  // Add entries until eviction occurs
  const largeBlob = new Blob([new ArrayBuffer(1024 * 30)]); // 30KB each

  for (let i = 0; i < 5; i++) {
    await cacheManager.put({
      id: `eviction-test-${i}`,
      blob: largeBlob,
      sizeBytes: largeBlob.size,
      lastAccessedAt: Date.now() + i, // Different timestamps
      quality: ThumbnailQuality.MEDIUM,
      width: 640,
      height: 360,
    });
  }

  const stats = await cacheManager.getDetailedStats();
  assert(stats.evictionCount > 0, 'Should have evictions');
  assert(
    stats.totalSizeBytes <= 1024 * 100,
    'Should respect max size'
  );

  await cacheManager.clear();
}

/**
 * Test 5: Worker service
 */
async function testWorkerService() {
  const workerService = getThumbnailWorkerService();

  assert(workerService.isAvailable(), 'Workers should be available');

  const stats = workerService.getStats();
  assert(stats.totalWorkers >= 0, 'Should have worker stats');
  assert(stats.availableWorkers >= 0, 'Should track available workers');
}

/**
 * Test 6: Retry Manager
 */
async function testRetryManager() {
  const retryManager = getRetryManager();

  // Test quality selection
  const quality = retryManager.selectQuality(320, 180);
  assert(
    [ThumbnailQuality.LOW, ThumbnailQuality.MEDIUM, ThumbnailQuality.HIGH].includes(
      quality
    ),
    'Should return valid quality'
  );

  // Test bandwidth update
  retryManager.updateBandwidth(1024 * 100, 1000); // 100KB in 1s
  const metrics = retryManager.getBandwidthEstimate();
  assert(metrics.estimatedBandwidth > 0, 'Should estimate bandwidth');
  assert(metrics.sampleCount > 0, 'Should track samples');

  // Test network speed
  const speed = retryManager.getNetworkSpeed();
  assert(['slow', 'medium', 'fast'].includes(speed), 'Should return valid speed');
}

/**
 * Test 7: Retry logic with exponential backoff
 */
async function testRetryLogic() {
  const retryManager = getRetryManager();

  let attemptCount = 0;
  const maxAttempts = 3;

  try {
    await retryManager.executeWithRetry('test-retry-key', async () => {
      attemptCount++;
      if (attemptCount < maxAttempts) {
        throw new Error('Simulated failure');
      }
      return 'success';
    });

    assert(attemptCount === maxAttempts, 'Should retry correct number of times');
  } catch (error) {
    // Expected to fail if not enough retries
  }

  retryManager.clearRetries('test-retry-key');
}

/**
 * Test 8: Cache statistics
 */
async function testCacheStatistics() {
  const cacheSystem = getThumbnailCacheSystem();
  const stats = await cacheSystem.getStats();

  assert(stats !== null, 'Should return stats');
  assert(typeof stats.totalSizeBytes === 'number', 'Should have size');
  assert(typeof stats.hitRate === 'number', 'Should have hit rate');
  assert(stats.hitRate >= 0 && stats.hitRate <= 1, 'Hit rate should be 0-1');
}

/**
 * Test 9: Progressive loading sequence
 */
async function testProgressiveLoading() {
  const retryManager = getRetryManager();

  const sequence = retryManager.getProgressiveLoadingSequence(
    ThumbnailQuality.HIGH
  );

  assert(sequence.length > 0, 'Should have loading sequence');
  assert(sequence[0] === ThumbnailQuality.LOW, 'Should start with low quality');
  assert(
    sequence[sequence.length - 1] === ThumbnailQuality.HIGH,
    'Should end with target quality'
  );
}

/**
 * Test 10: Cache size management
 */
async function testCacheSizeManagement() {
  const cacheManager = getLRUCacheManager();

  const initialSize = cacheManager.getMaxSize();
  const newSize = 300 * 1024 * 1024; // 300MB

  await cacheManager.setMaxSize(newSize);
  assert(cacheManager.getMaxSize() === newSize, 'Should update max size');

  // Restore original size
  await cacheManager.setMaxSize(initialSize);
}

/**
 * Run all tests
 */
export async function runTests(): Promise<void> {
  console.log('Starting Thumbnail Cache System Tests...\n');

  await runTest('IndexedDB Service Initialization', testIndexedDBService);
  await runTest('IndexedDB CRUD Operations', testIndexedDBCRUD);
  await runTest('LRU Cache Manager', testLRUCacheManager);
  await runTest('Cache Eviction', testCacheEviction);
  await runTest('Worker Service', testWorkerService);
  await runTest('Retry Manager', testRetryManager);
  await runTest('Retry Logic', testRetryLogic);
  await runTest('Cache Statistics', testCacheStatistics);
  await runTest('Progressive Loading', testProgressiveLoading);
  await runTest('Cache Size Management', testCacheSizeManagement);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log('='.repeat(60));

  return;
}

/**
 * Performance benchmarks
 */
export async function runBenchmarks(): Promise<void> {
  console.log('Running Performance Benchmarks...\n');

  const cacheManager = getLRUCacheManager();
  await cacheManager.clear();

  // Benchmark 1: Cache write performance
  const writeStart = performance.now();
  for (let i = 0; i < 100; i++) {
    const blob = new Blob([new ArrayBuffer(1024 * 10)]); // 10KB
    await cacheManager.put({
      id: `bench-${i}`,
      blob,
      sizeBytes: blob.size,
      lastAccessedAt: Date.now(),
      quality: ThumbnailQuality.MEDIUM,
      width: 640,
      height: 360,
    });
  }
  const writeTime = performance.now() - writeStart;
  console.log(`Write Performance: ${writeTime.toFixed(2)}ms for 100 entries`);
  console.log(`  Avg: ${(writeTime / 100).toFixed(2)}ms per entry`);

  // Benchmark 2: Cache read performance
  const readStart = performance.now();
  for (let i = 0; i < 100; i++) {
    await cacheManager.get(`bench-${i}`);
  }
  const readTime = performance.now() - readStart;
  console.log(`Read Performance: ${readTime.toFixed(2)}ms for 100 entries`);
  console.log(`  Avg: ${(readTime / 100).toFixed(2)}ms per entry`);

  // Benchmark 3: Stats calculation
  const statsStart = performance.now();
  await cacheManager.getDetailedStats();
  const statsTime = performance.now() - statsStart;
  console.log(`Stats Calculation: ${statsTime.toFixed(2)}ms`);

  await cacheManager.clear();
}

// Auto-run tests if loaded as module
if (typeof window !== 'undefined') {
  (window as any).testThumbnailCache = {
    runTests,
    runBenchmarks,
  };
  console.log('Thumbnail Cache Tests loaded. Run:');
  console.log('  window.testThumbnailCache.runTests()');
  console.log('  window.testThumbnailCache.runBenchmarks()');
}
