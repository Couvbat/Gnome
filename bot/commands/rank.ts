import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Afficher le niveau et l\'XP d\'un utilisateur')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('L\'utilisateur à vérifier (vous par défaut)')
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userLevel = await userLevelsDb.get(targetUser.id, interaction.guildId);

      if (!userLevel) {
        await interaction.editReply({
          content: `${targetUser.username} n'a pas encore d'XP sur ce serveur.`,
        });
        return;
      }

      // Calculate XP needed for next level
      // Formula: xp_for_level = (level + 1)^2 * 100
      const currentLevelXp = Math.pow(userLevel.level, 2) * 100;
      const nextLevelXp = Math.pow(userLevel.level + 1, 2) * 100;
      const xpInCurrentLevel = userLevel.xp - currentLevelXp;
      const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
      const progressPercent = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

      // Create progress bar
      const progressBarLength = 20;
      const filledBars = Math.floor((progressPercent / 100) * progressBarLength);
      const emptyBars = progressBarLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Rang de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x5865F2)
        .addFields(
          { name: '🎯 Niveau', value: `${userLevel.level}`, inline: true },
          { name: '⭐ XP Total', value: `${userLevel.xp}`, inline: true },
          { name: '💬 Messages', value: `${userLevel.totalMessages}`, inline: true },
          { name: '🎤 Minutes Vocales', value: `${userLevel.totalVoiceMinutes}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { 
            name: '📈 Progression', 
            value: `${progressBar}\n${xpInCurrentLevel}/${xpNeededForNextLevel} XP (${progressPercent.toFixed(1)}%)`,
            inline: false 
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Rank Command Error]', error);
      await interaction.editReply('Une erreur est survenue lors de la récupération du rang.');
    }
  },

  cooldown: 5,
};
