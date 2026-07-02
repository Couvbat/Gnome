import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { SlashCommandBuilder, EmbedBuilder, Collection } from 'discord.js';
import helpCommand from '../commands/help';

describe('/help command', () => {
  let mockClient;
  let mockInteraction;
  let mockAutocompleteInteraction;

  beforeEach(() => {
    // Create mock client with commands collection
    mockClient = {
      commands: new Collection(),
    };

    // Add sample commands to the collection
    const sampleCommands = [
      {
        data: new SlashCommandBuilder()
          .setName('ping')
          .setDescription('Replies with Pong!'),
        execute: vi.fn(),
      },
      {
        data: new SlashCommandBuilder()
          .setName('balance')
          .setDescription('Affiche votre solde de pièces')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('Utilisateur dont vous voulez voir le solde')
              .setRequired(false)
          ),
        execute: vi.fn(),
        cooldown: 5,
      },
      {
        data: new SlashCommandBuilder()
          .setName('mistral')
          .setDescription('Posez une question à Mistral.')
          .addStringOption(option =>
            option
              .setName('prompt')
              .setDescription('Prompt')
              .setRequired(true)
          ),
        execute: vi.fn(),
        defer: true,
      },
      {
        data: new SlashCommandBuilder()
          .setName('play')
          .setDescription('Jouer une chanson depuis YouTube ou SoundCloud')
          .addStringOption(option =>
            option
              .setName('recherche')
              .setDescription('Recherche ou URL')
              .setRequired(true)
          ),
        execute: vi.fn(),
        cooldown: 3,
      },
      {
        data: new SlashCommandBuilder()
          .setName('slots')
          .setDescription('Jouer aux machines à sous')
          .addIntegerOption(option =>
            option
              .setName('bet')
              .setDescription('Montant à miser')
              .setRequired(true)
          ),
        execute: vi.fn(),
      },
      {
        data: new SlashCommandBuilder()
          .setName('lol-stats')
          .setDescription('Affiche les statistiques d\'un joueur League of Legends')
          .addStringOption(option =>
            option
              .setName('pseudo')
              .setDescription('Pseudo du joueur')
              .setRequired(true)
          ),
        execute: vi.fn(),
      },
      {
        data: new SlashCommandBuilder()
          .setName('birthday')
          .setDescription('Gérer les anniversaires des membres du serveur')
          .addSubcommand(subcommand =>
            subcommand
              .setName('set')
              .setDescription('Définir votre date d\'anniversaire')
          )
          .addSubcommand(subcommand =>
            subcommand
              .setName('list')
              .setDescription('Afficher tous les anniversaires')
          ),
        execute: vi.fn(),
      },
    ];

    sampleCommands.forEach(cmd => {
      mockClient.commands.set(cmd.data.name, cmd);
    });

    // Mock message component collector
    const mockCollector = {
      on: vi.fn(),
      off: vi.fn(),
    };

    // Create mock interaction
    mockInteraction = {
      options: {
        getString: vi.fn(),
      },
      reply: vi.fn().mockResolvedValue({
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      }),
      editReply: vi.fn().mockResolvedValue(undefined),
      client: mockClient,
      user: {
        id: 'test-user-123',
        username: 'TestUser',
      },
    };

    // Create mock autocomplete interaction
    mockAutocompleteInteraction = {
      options: {
        getFocused: vi.fn(),
      },
      respond: vi.fn().mockResolvedValue(undefined),
      client: mockClient,
    };
  });

  describe('Command structure', () => {
    test('should have correct command data', () => {
      expect(helpCommand.data).toBeDefined();
      expect(helpCommand.data.name).toBe('help');
      expect(helpCommand.data.description).toBe('Affiche la liste des commandes disponibles');
    });

    test('should have execute function', () => {
      expect(helpCommand.execute).toBeDefined();
      expect(typeof helpCommand.execute).toBe('function');
    });

    test('should have autocomplete function', () => {
      expect(helpCommand.autocomplete).toBeDefined();
      expect(typeof helpCommand.autocomplete).toBe('function');
    });

    test('should have cooldown of 5 seconds', () => {
      expect(helpCommand.cooldown).toBe(5);
    });

    test('should have optional string parameter', () => {
      const commandJSON = helpCommand.data.toJSON();
      expect(commandJSON.options).toHaveLength(1);
      expect(commandJSON.options[0].name).toBe('commande');
      expect(commandJSON.options[0].required).toBe(false);
      expect(commandJSON.options[0].autocomplete).toBe(true);
    });
  });

  describe('Listing all commands', () => {
    test('should display paginated overview with navigation buttons when no filter provided', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      await helpCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      
      expect(replyCall.embeds).toBeDefined();
      expect(replyCall.embeds).toHaveLength(1);
      expect(replyCall.components).toBeDefined();
      expect(replyCall.components).toHaveLength(1);
      
      const embed = replyCall.embeds[0];
      expect(embed.data.title).toContain('Le Gnome');
      expect(embed.data.title).toContain('Guide des Commandes');
      expect(embed.data.description).toContain('Navigation');
      expect(embed.data.color).toBe(0xffd700); // Gold color
      
      // Check for navigation buttons
      const buttons = replyCall.components[0].components;
      expect(buttons).toHaveLength(5); // First, Prev, Home, Next, Last
      expect(buttons[0].data.emoji?.name || buttons[0].data.label).toContain('⏮️');
      expect(buttons[4].data.emoji?.name || buttons[4].data.label).toContain('⏭️');
    });

    test('should show category overview with command counts', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;

      // Check that categories exist with command counts
      const categoryNames = fields.map(f => f.name);
      expect(categoryNames).toContain('🛠️ Utilitaire');
      expect(categoryNames).toContain('🤖 IA & Conversation');
      expect(categoryNames).toContain('🎮 League of Legends');
      expect(categoryNames).toContain('🎵 Musique');
      expect(categoryNames).toContain('💰 Économie & Niveau');
      expect(categoryNames).toContain('🎰 Casino');
      
      // Check that values show command counts
      const allFieldValues = fields.map(f => f.value).join('\n');
      expect(allFieldValues).toContain('commande');
    });

    test('should include footer with total command count', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.footer.text).toContain('commandes disponibles');
      expect(embed.data.footer.text).toContain('/help');
    });

    test('should disable first/prev buttons on first page', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      await helpCommand.execute(mockInteraction);

      const replyCall = mockInteraction.reply.mock.calls[0][0];
      const buttons = replyCall.components[0].components;
      
      // First and Prev buttons should be disabled on page 0
      expect(buttons[0].data.disabled).toBe(true); // First
      expect(buttons[1].data.disabled).toBe(true); // Prev
      expect(buttons[2].data.disabled).toBe(true); // Home (already on home)
      expect(buttons[3].data.disabled).toBe(false); // Next
      expect(buttons[4].data.disabled).toBe(false); // Last
    });


  });

  describe('Filtering by category', () => {
    test('should display only AI category commands when filtered by "ai"', async () => {
      mockInteraction.options.getString.mockReturnValue('ai');

      await helpCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      
      expect(embed.data.title).toContain('🤖 IA & Conversation');
      expect(embed.data.fields[0].value).toContain('/mistral');
    });

    test('should display only music category commands when filtered by "music"', async () => {
      mockInteraction.options.getString.mockReturnValue('music');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.title).toContain('🎵 Musique');
      expect(embed.data.fields[0].value).toContain('/play');
    });

    test('should display only casino category commands when filtered by "casino"', async () => {
      mockInteraction.options.getString.mockReturnValue('casino');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.title).toContain('🎰 Casino');
      expect(embed.data.fields[0].value).toContain('/slots');
    });

    test('should match category by partial name (case-insensitive)', async () => {
      mockInteraction.options.getString.mockReturnValue('économie');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.title).toContain('💰 Économie & Niveau');
      expect(embed.data.fields[0].value).toContain('/balance');
    });

    test('should include cooldown info for category commands', async () => {
      mockInteraction.options.getString.mockReturnValue('economy');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fieldValue = embed.data.fields[0].value;
      
      // Balance has cooldown of 5s (non-default)
      expect(fieldValue).toContain('5s');
    });
  });

  describe('Showing specific command details', () => {
    test('should display detailed info for specific command', async () => {
      mockInteraction.options.getString.mockReturnValue('balance');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.title).toBe('/balance');
      expect(embed.data.description).toContain('Affiche votre solde de pièces');
    });

    test('should show command category', async () => {
      mockInteraction.options.getString.mockReturnValue('balance');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const categoryField = embed.data.fields.find(f => f.name === 'Catégorie');
      expect(categoryField).toBeDefined();
      expect(categoryField.value).toContain('💰 Économie & Niveau');
    });

    test('should show command cooldown', async () => {
      mockInteraction.options.getString.mockReturnValue('balance');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const cooldownField = embed.data.fields.find(f => f.name.includes('Cooldown'));
      expect(cooldownField).toBeDefined();
      expect(cooldownField.value).toContain('5 secondes');
    });

    test('should show default cooldown for commands without custom cooldown', async () => {
      mockInteraction.options.getString.mockReturnValue('ping');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const cooldownField = embed.data.fields.find(f => f.name.includes('Cooldown'));
      expect(cooldownField.value).toContain('3 seconde');
    });

    test('should show command options', async () => {
      mockInteraction.options.getString.mockReturnValue('balance');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const optionsField = embed.data.fields.find(f => f.name.includes('Options'));
      expect(optionsField).toBeDefined();
      expect(optionsField.value).toContain('user');
      expect(optionsField.value).toContain('[Optionnel]');
    });

    test('should show required options correctly', async () => {
      mockInteraction.options.getString.mockReturnValue('mistral');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const optionsField = embed.data.fields.find(f => f.name.includes('Options'));
      expect(optionsField.value).toContain('prompt');
      expect(optionsField.value).toContain('[Requis]');
    });

    test('should show subcommands for complex commands', async () => {
      mockInteraction.options.getString.mockReturnValue('birthday');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const optionsField = embed.data.fields.find(f => f.name.includes('Options'));
      expect(optionsField.value).toContain('set');
      expect(optionsField.value).toContain('list');
      expect(optionsField.value).toContain('sous-commande');
    });

    test('should show usage examples when available', async () => {
      mockInteraction.options.getString.mockReturnValue('balance');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const examplesField = embed.data.fields.find(f => f.name.includes('Exemples'));
      expect(examplesField).toBeDefined();
      expect(examplesField.value).toContain('/balance');
    });

    test('should handle commands without usage examples', async () => {
      mockInteraction.options.getString.mockReturnValue('ping');

      await helpCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const examplesField = embed.data.fields.find(f => f.name.includes('Exemples'));
      expect(examplesField).toBeDefined();
      expect(examplesField.value).toContain('/ping');
    });
  });

  describe('Invalid inputs', () => {
    test('should show error for non-existent command', async () => {
      mockInteraction.options.getString.mockReturnValue('nonexistent');

      await helpCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      
      expect(replyCall.content).toContain('❌');
      expect(replyCall.content).toContain('introuvable');
      expect(replyCall.content).toContain('nonexistent');
      expect(replyCall.ephemeral).toBe(true);
    });

    test('should show error for non-existent category', async () => {
      mockInteraction.options.getString.mockReturnValue('fakecategory');

      await helpCommand.execute(mockInteraction);

      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.content).toContain('introuvable');
      expect(replyCall.ephemeral).toBe(true);
    });

    test('should suggest using /help without arguments on error', async () => {
      mockInteraction.options.getString.mockReturnValue('invalid');

      await helpCommand.execute(mockInteraction);

      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.content).toContain('/help');
    });
  });

  describe('Autocomplete', () => {
    test('should provide category suggestions', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      expect(mockAutocompleteInteraction.respond).toHaveBeenCalledTimes(1);
      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];

      // Should include all 6 categories
      const categories = suggestions.filter(s => s.name.includes('catégorie'));
      expect(categories.length).toBe(6);
      
      // Check category names
      const categoryNames = categories.map(c => c.name);
      expect(categoryNames.some(n => n.includes('Utilitaire'))).toBe(true);
      expect(categoryNames.some(n => n.includes('IA & Conversation'))).toBe(true);
      expect(categoryNames.some(n => n.includes('League of Legends'))).toBe(true);
    });

    test('should provide command suggestions', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      
      // Should include all commands
      const commands = suggestions.filter(s => s.name.startsWith('/'));
      expect(commands.length).toBeGreaterThan(0);
      
      // Check specific commands
      expect(suggestions.some(s => s.value === 'ping')).toBe(true);
      expect(suggestions.some(s => s.value === 'balance')).toBe(true);
      expect(suggestions.some(s => s.value === 'mistral')).toBe(true);
    });

    test('should filter suggestions based on user input', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('bal');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      
      // Should include balance command
      expect(suggestions.some(s => s.value === 'balance')).toBe(true);
      
      // Total suggestions should be limited
      expect(suggestions.length).toBeLessThanOrEqual(25);
    });

    test('should filter by category name', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('music');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      
      // Should include music category
      expect(suggestions.some(s => s.value === 'music')).toBe(true);
      
      // Filtering works based on name/description text matching, not category membership
      // So "music" will match the category name but not necessarily all music commands
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('should be case-insensitive', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('PING');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      expect(suggestions.some(s => s.value === 'ping')).toBe(true);
    });

    test('should limit results to 25 (Discord limit)', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      expect(suggestions.length).toBeLessThanOrEqual(25);
    });

    test('should include command descriptions in autocomplete', async () => {
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('ping');

      await helpCommand.autocomplete(mockAutocompleteInteraction);

      const suggestions = mockAutocompleteInteraction.respond.mock.calls[0][0];
      const pingSuggestion = suggestions.find(s => s.value === 'ping');
      
      expect(pingSuggestion).toBeDefined();
      expect(pingSuggestion.name).toContain('/ping');
      expect(pingSuggestion.name).toContain('Replies with Pong!');
    });
  });
});
