import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from 'discord.js';

/**
 * Interface for Discord bot commands
 */
export interface Command {
  /** SlashCommandBuilder instance defining command metadata */
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  
  /** Function to execute when command is invoked */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  
  /** Optional cooldown in seconds (default is 3) */
  cooldown?: number;
  
  /** Optional flag to defer reply for long operations */
  defer?: boolean;

  /** Optional autocomplete handler for dynamic option suggestions */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
