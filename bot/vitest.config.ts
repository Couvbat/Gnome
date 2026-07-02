import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.{js,ts}'],
    setupFiles: ['__tests__/setup.ts'],
    testTimeout: 10000,
    // Run tests sequentially like Jest did
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      exclude: ['node_modules/**'],
    },
  },
});
