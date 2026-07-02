import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

// Must be set before any module reads process.env.JWT_SECRET (auth middleware, socket handlers).
// Test files sign their own tokens with this same value.
process.env.JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-production';

// Mock mongoose connection for tests
beforeAll(async () => {
  // Mock mongoose.connect to avoid real DB connection
  vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as any);
  console.log('✅ Mongoose mocked for testing');
});

// Cleanup after all tests
afterAll(async () => {
  vi.restoreAllMocks();
  console.log('✅ Test mocks cleaned up');
});

// Clear mock calls between tests
afterEach(() => {
  vi.clearAllMocks();
});
