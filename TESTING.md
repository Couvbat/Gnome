# Testing Guide - Gnome Discord Bot

## Overview
This project uses **Jest** as its testing framework for unit testing Discord commands.

## Installation
Testing dependencies are already included in `package.json`:
```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (automatically re-run on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Structure

Tests are located in the `__tests__/` directory with the naming convention `<command-name>.test.js`:

```
__tests__/
├── setup.js           # Test configuration and environment setup
├── echo.test.js       # Tests for echo command
├── listen.test.js     # Tests for listen command  
├── mistral.test.js    # Tests for mistral command
└── ping.test.js       # Tests for ping command
```

## Writing Tests

### Basic Command Test Template

```javascript
const commandName = require('../commands/commandName');

describe('CommandName Command', () => {
  test('should have correct command structure', () => {
    expect(commandName.data.name).toBe('commandname');
    expect(commandName.execute).toBeDefined();
    expect(typeof commandName.execute).toBe('function');
  });

  test('should execute successfully', async () => {
    const mockInteraction = {
      options: {
        getString: jest.fn().mockReturnValue('test input')
      },
      reply: jest.fn().mockResolvedValue(undefined)
    };

    await commandName.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('expected output');
  });
});
```

### Mocking Discord Interactions

Discord interactions need to be mocked with the appropriate properties:

```javascript
const mockInteraction = {
  // User who triggered the interaction
  user: {
    username: 'TestUser',
    id: 'test-user-id'
  },
  
  // Guild and channel context
  guildId: 'test-guild-id',
  channel: {},
  
  // Command options
  options: {
    getString: jest.fn().mockReturnValue('test value'),
    getInteger: jest.fn().mockReturnValue(42),
    getBoolean: jest.fn().mockReturnValue(true)
  },
  
  // Reply methods
  reply: jest.fn().mockResolvedValue(undefined),
  deferReply: jest.fn().mockResolvedValue(undefined),
  editReply: jest.fn().mockResolvedValue(undefined),
  
  // For voice commands
  member: {
    voice: {
      channel: {
        id: 'voice-channel-id',
        guild: {
          voiceAdapterCreator: jest.fn()
        }
      }
    }
  }
};
```

### Mocking External APIs

Use Jest's mocking system for external API calls:

```javascript
const { request } = require('undici');
jest.mock('undici');

// In your test:
request.mockResolvedValue({
  body: {
    json: jest.fn().mockResolvedValue({
      // Your API response here
    })
  }
});
```

### Testing Async Commands

Most Discord commands are async, so use `async/await`:

```javascript
test('should handle async operations', async () => {
  const mockInteraction = {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined)
  };

  await command.execute(mockInteraction);

  expect(mockInteraction.deferReply).toHaveBeenCalled();
  expect(mockInteraction.editReply).toHaveBeenCalled();
});
```

### Testing Error Handling

Verify commands handle errors gracefully:

```javascript
test('should handle API error', async () => {
  request.mockRejectedValue(new Error('API Error'));

  const mockInteraction = {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined)
  };

  await command.execute(mockInteraction);

  expect(mockInteraction.editReply).toHaveBeenCalledWith({
    content: expect.stringContaining('error')
  });
});
```

## Test Coverage

Current test coverage includes:
- ✅ Command structure validation
- ✅ Basic command execution
- ✅ API integration (Mistral AI)
- ✅ Error handling
- ✅ User input validation
- ✅ Voice channel validation

## Best Practices

### 1. Isolate Tests
Each test should be independent and not rely on other tests:
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 2. Test Behavior, Not Implementation
Focus on what the command does, not how it does it:
```javascript
// Good
expect(mockInteraction.reply).toHaveBeenCalledWith('Pong!');

// Avoid
expect(someInternalVariable).toBe(someValue);
```

### 3. Use Descriptive Test Names
```javascript
// Good
test('should require user to be in voice channel', async () => {

// Avoid  
test('test1', async () => {
```

### 4. Mock External Dependencies
Never make real API calls in tests:
```javascript
jest.mock('undici');
jest.mock('@discordjs/voice');
```

### 5. Test Edge Cases
```javascript
test('should handle empty message', async () => {
  // Test with empty string
});

test('should handle missing API key', async () => {
  // Test without API key
});
```

## Troubleshooting

### Tests Fail with "Cannot find module"
Make sure you're running tests from the project root:
```bash
cd /home/jules/Dev/other/gnome
npm test
```

### Mock Not Working
Ensure mocks are declared before requiring the module:
```javascript
jest.mock('undici');  // Before require
const command = require('../commands/command');
```

### Environment Variables Not Loading
Check that `__tests__/setup.js` is properly configured in `package.json`:
```json
"jest": {
  "setupFilesAfterEnv": ["<rootDir>/__tests__/setup.js"]
}
```

### Voice Command Tests are Complex
Voice commands involve complex Discord.js internals. It's acceptable to test only the user-facing behavior (joining requirements, stop functionality) rather than the full voice connection lifecycle.

## Adding New Tests

When adding a new command:

1. Create a new test file in `__tests__/`:
   ```bash
   touch __tests__/newcommand.test.js
   ```

2. Use an existing test as a template

3. Run tests to verify:
   ```bash
   npm test
   ```

4. Check coverage:
   ```bash
   npm run test:coverage
   ```

## Continuous Integration

To integrate with CI/CD pipelines, add to your workflow:
```yaml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Discord.js Guide - Testing](https://discordjs.guide/additional-info/testing.html)
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions)

---

**Note**: Tests use mock data and do not make real API calls or connect to Discord. This ensures fast, reliable tests without external dependencies.
