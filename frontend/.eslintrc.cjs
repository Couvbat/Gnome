module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // vue3-essential: correctness rules only - the recommended tier is mostly
    // template formatting (attribute wrapping etc.) and this repo has no
    // autoformatter to keep that satisfied.
    'plugin:vue/vue3-essential'
  ],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'certs/'],
  rules: {
    // Game views are named after the game (Roulette.vue, Blackjack.vue)
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // The lint script runs with --max-warnings 0; `any` is pervasive at the
    // socket/SDK boundaries, so keep it advisory rather than blocking.
    '@typescript-eslint/no-explicit-any': 'off'
  }
};
