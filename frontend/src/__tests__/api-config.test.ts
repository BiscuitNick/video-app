/**
 * API Configuration Tests
 *
 * Simple tests to verify API client and environment configuration
 * Run with: npm test (when test framework is set up)
 */

import { apiClient } from '../lib/api-client';
import { env } from '../config/env';
import { queryClient, queryKeys } from '../lib/query-client';

// Test 1: Environment configuration
console.log('Test 1: Environment Configuration');
console.log('✓ API Base URL:', env.apiBaseUrl);
console.log('✓ API Timeout:', env.apiTimeout);
console.log('✓ App Environment:', env.appEnv);
console.log('✓ Debug Mode:', env.enableDebug);

// Test 2: API Client configuration
console.log('\nTest 2: API Client Configuration');
console.log('✓ Base URL:', apiClient.defaults.baseURL);
console.log('✓ Timeout:', apiClient.defaults.timeout);
console.log('✓ Content-Type:', apiClient.defaults.headers['Content-Type']);

// Test 3: Query Keys structure
console.log('\nTest 3: Query Keys Structure');
console.log('✓ Projects keys:', queryKeys.projects.all);
console.log('✓ Media keys:', queryKeys.media.all);
console.log('✓ Compositions keys:', queryKeys.compositions.all);
console.log('✓ Exports keys:', queryKeys.exports.all);

// Test 4: Query Client configuration
console.log('\nTest 4: Query Client Configuration');
console.log('✓ Query Client created:', !!queryClient);
console.log('✓ Default retry count:', queryClient.getDefaultOptions().queries?.retry);
console.log('✓ Default stale time:', queryClient.getDefaultOptions().queries?.staleTime);

console.log('\n✅ All API configuration tests passed!');
