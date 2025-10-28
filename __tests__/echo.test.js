const echo = require('../commands/echo');

describe('Echo Command', () => {
  test('should have correct command structure', () => {
    expect(echo.data.name).toBe('echo');
    expect(echo.execute).toBeDefined();
    expect(typeof echo.execute).toBe('function');
  });

  test('should echo the provided message', async () => {
    const testMessage = 'Hello, World!';
    
    const mockInteraction = {
      options: {
        getString: jest.fn().mockReturnValue(testMessage)
      },
      reply: jest.fn().mockResolvedValue(undefined)
    };

    await echo.execute(mockInteraction);

    expect(mockInteraction.options.getString).toHaveBeenCalledWith('echo');
    expect(mockInteraction.reply).toHaveBeenCalledWith(testMessage);
  });

  test('should handle empty message', async () => {
    const mockInteraction = {
      options: {
        getString: jest.fn().mockReturnValue('')
      },
      reply: jest.fn().mockResolvedValue(undefined)
    };

    await echo.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('');
  });
});
