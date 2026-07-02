// Test setup file - runs before all tests
import { vi } from 'vitest';
import * as dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Set test environment variables if not already set
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-discord-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client-id';
process.env.DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || 'test-guild-id';
process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-mistral-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.RIOT_GAMES_API_KEY = process.env.RIOT_GAMES_API_KEY || 'test-riot-api-key';

// Suppress console.log during tests (optional)
// globalThis.console.log = vi.fn();
