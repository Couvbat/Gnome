import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Afficher le classement des utilisateurs du serveur')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Nombre d\'utilisateurs à afficher (par défaut: 10)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(25)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const limit = interaction.options.getInteger('limit') || 10;
      const leaderboard = await userLevelsDb.getLeaderboard(interaction.guildId, limit);

      if (!leaderboard || leaderboard.length === 0) {
        await interaction.editReply('Aucun utilisateur n\'a encore d\'XP sur ce serveur.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Classement du serveur')
        .setColor(0xFFD700)
        .setTimestamp();

      let description = '';
      const medals = ['🥇', '🥈', '🥉'];

      const discordUsers = await Promise.all(
        leaderboard.map(entry => interaction.client.users.fetch(entry.userId).catch(() => null))
      );

      for (let i = 0; i < leaderboard.length; i++) {
        const userData = leaderboard[i];
        const user = discordUsers[i];
        const username = user ? user.username : 'Utilisateur inconnu';
        const medal = i < 3 ? medals[i] : `**${i + 1}.**`;

        description += `${medal} **${username}**\n`;
        description += `   └ Niveau ${userData.level} • ${userData.xp} XP • ${userData.coins || 0} 💰\n`;
        description += `   └ ${userData.totalMessages} messages • ATH: ${userData.coinsAllTimeHigh || userData.coins || 0} 💰\n\n`;
      }

      embed.setDescription(description);

      // Find current user's position if not in top list
      const currentUserData = await userLevelsDb.get(interaction.user.id, interaction.guildId);
      if (currentUserData) {
        const currentUserPosition = await userLevelsDb.getUserRank(interaction.user.id, interaction.guildId);

        if (currentUserPosition > limit) {
          embed.setFooter({ 
            text: `Votre position: #${currentUserPosition} • Niveau ${currentUserData.level} • ${currentUserData.xp} XP` 
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Leaderboard Command Error]', error);
      await interaction.editReply('Une erreur est survenue lors de la récupération du classement.');
    }
  },

  cooldown: 10,
};
