import { SlashCommandBuilder, CommandInteraction, SlashCommandOptionsOnlyBuilder } from 'discord.js';

/**
 * Interface for Discord bot commands
 */
export interface Command {
  /** SlashCommandBuilder instance defining command metadata */
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  
  /** Function to execute when command is invoked */
  execute: (interaction: CommandInteraction) => Promise<void>;
  
  /** Optional cooldown in seconds (default is 3) */
  cooldown?: number;
  
  /** Optional flag to defer reply for long operations */
  defer?: boolean;
}
