import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['__tests__/setup.ts'],
    testTimeout: 30000,
    teardownTimeout: 5000,
    clearMocks: true,
    restoreMocks: true,
    // Memory management settings
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: true,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
