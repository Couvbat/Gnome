import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { describe, test, expect, vi } from 'vitest';
import echo from '../commands/echo';

describe('Echo Command', () => {
  test('should have correct command structure', () => {
    expect(echo.data.name).toBe('echo');
    expect(echo.execute).toBeDefined();
    expect(typeof echo.execute).toBe('function');
  });

  test('should echo the provided message', async () => {
    const testMessage = 'Hello, World!';
    
    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue(testMessage)
      },
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await echo.execute(mockInteraction);

    expect(mockInteraction.options.getString).toHaveBeenCalledWith('echo', true);
    expect(mockInteraction.reply).toHaveBeenCalledWith(testMessage);
  });

  test('should handle empty message', async () => {
    const mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn().mockReturnValue('')
      },
      reply: vi.fn().mockResolvedValue(undefined)
    };

    await echo.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('');
  });
});

