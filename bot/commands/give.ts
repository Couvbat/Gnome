import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Transférer des pièces à un autre joueur')
    .addUserOption(option =>
      option
        .setName('destinataire')
        .setDescription('Le joueur à qui donner les pièces')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('montant')
        .setDescription('Le nombre de pièces à transférer')
        .setRequired(true)
        .setMinValue(1)
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const recipient = interaction.options.getUser('destinataire', true);
    const amount = interaction.options.getInteger('montant', true);
    const guildId = interaction.guildId!;
    const sender = interaction.user;

    // Validation 1: Cannot give to yourself
    if (recipient.id === sender.id) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Transfert impossible')
        .setDescription('Vous ne pouvez pas vous transférer des pièces à vous-même!');
      
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Validation 2: Cannot give to bots
    if (recipient.bot) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Transfert impossible')
        .setDescription('Vous ne pouvez pas transférer des pièces à un bot!');
      
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    try {
      // Atomically deduct from sender — spendCoins returns false if insufficient balance,
      // eliminating the TOCTOU race between the balance check and the deduction.
      const spent = await userLevelsDb.spendCoins(sender.id, guildId, amount);
      if (!spent) {
        const senderData = await userLevelsDb.get(sender.id, guildId);
        const senderBalance = senderData?.coins || 0;
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Vous n'avez que **${senderBalance.toLocaleString()}** pièces.\nVous ne pouvez pas transférer **${amount.toLocaleString()}** pièces.`);
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      // Credit recipient — compensate sender on failure to prevent coin loss
      try {
        await userLevelsDb.addCoins(recipient.id, guildId, amount);
      } catch (creditError) {
        await userLevelsDb.addCoins(sender.id, guildId, amount); // restore sender
        throw creditError;
      }

      // Get updated balances
      const updatedSenderData = await userLevelsDb.get(sender.id, guildId);
      const updatedRecipientData = await userLevelsDb.get(recipient.id, guildId);
      
      const newSenderBalance = updatedSenderData?.coins || 0;
      const newRecipientBalance = updatedRecipientData?.coins || 0;

      // Success message
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Transfert réussi')
        .setDescription(`${sender.displayName} a transféré **${amount.toLocaleString()}** 🪙 à ${recipient.displayName}`)
        .addFields(
          {
            name: `💸 ${sender.displayName}`,
            value: `Nouveau solde: **${newSenderBalance.toLocaleString()}** pièces`,
            inline: true
          },
          {
            name: `💰 ${recipient.displayName}`,
            value: `Nouveau solde: **${newRecipientBalance.toLocaleString()}** pièces`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('[Give Command] Error during transfer:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors du transfert. Veuillez réessayer.');
      
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
