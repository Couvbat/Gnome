// Test setup file - runs before all tests

// Load environment variables for testing
require('dotenv').config();

// Set test environment variables if not already set
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-discord-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client-id';
process.env.DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || 'test-guild-id';
process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-mistral-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

// Suppress console.log during tests (optional)
// global.console.log = jest.fn();

// Global test timeout (optional)
jest.setTimeout(10000); // 10 seconds
