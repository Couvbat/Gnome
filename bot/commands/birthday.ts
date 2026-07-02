import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { birthdaysDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Gérer les anniversaires des membres du serveur')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Définir votre date d\'anniversaire')
        .addIntegerOption(option =>
          option
            .setName('day')
            .setDescription('Jour (1-31)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
        .addIntegerOption(option =>
          option
            .setName('month')
            .setDescription('Mois (1-12)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12)
        )
        .addIntegerOption(option =>
          option
            .setName('year')
            .setDescription('Année (optionnel)')
            .setRequired(false)
            .setMinValue(1900)
            .setMaxValue(new Date().getFullYear())
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Supprimer votre date d\'anniversaire')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Afficher tous les anniversaires du serveur')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Vérifier votre anniversaire enregistré')
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'set':
          await handleSet(interaction);
          break;
        case 'remove':
          await handleRemove(interaction);
          break;
        case 'list':
          await handleList(interaction);
          break;
        case 'check':
          await handleCheck(interaction);
          break;
      }
    } catch (error) {
      console.error('[Birthday Command Error]', error);
      const errorMessage = 'Une erreur est survenue lors de l\'exécution de la commande.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  cooldown: 3,
};

async function handleSet(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;

  const day = interaction.options.getInteger('day', true);
  const month = interaction.options.getInteger('month', true);
  const year = interaction.options.getInteger('year', false);

  // Validate date
  const date = new Date(year || 2000, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) {
    await interaction.reply({
      content: '❌ Date invalide ! Veuillez vérifier le jour et le mois.',
      ephemeral: true,
    });
    return;
  }

  await birthdaysDb.set({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    birthMonth: month,
    birthDay: day,
    birthYear: year,
  });

  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  
  const dateStr = `${day} ${monthNames[month - 1]}${year ? ` ${year}` : ''}`;
  
  await interaction.reply({
    content: `🎉 Votre anniversaire a été enregistré : **${dateStr}** !`,
    ephemeral: true,
  });
}

async function handleRemove(interaction: CommandInteraction): Promise<void> {
  if (!interaction.guildId) return;

  const existing = await birthdaysDb.get(interaction.user.id, interaction.guildId);
  
  if (!existing) {
    await interaction.reply({
      content: '❌ Aucun anniversaire enregistré.',
      ephemeral: true,
    });
    return;
  }

  await birthdaysDb.delete(interaction.user.id, interaction.guildId);
  
  await interaction.reply({
    content: '✅ Votre anniversaire a été supprimé.',
    ephemeral: true,
  });
}

async function handleCheck(interaction: CommandInteraction): Promise<void> {
  if (!interaction.guildId) return;

  const birthday = await birthdaysDb.get(interaction.user.id, interaction.guildId);
  
  if (!birthday) {
    await interaction.reply({
      content: '❌ Vous n\'avez pas d\'anniversaire enregistré. Utilisez `/birthday set` pour en ajouter un.',
      ephemeral: true,
    });
    return;
  }

  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  
  const dateStr = `${birthday.birthDay} ${monthNames[birthday.birthMonth - 1]}${birthday.birthYear ? ` ${birthday.birthYear}` : ''}`;
  
  await interaction.reply({
    content: `🎂 Votre anniversaire : **${dateStr}**`,
    ephemeral: true,
  });
}

async function handleList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.guildId) return;

  await interaction.deferReply();

  const birthdays = await birthdaysDb.getAll(interaction.guildId);
  
  if (birthdays.length === 0) {
    await interaction.editReply('❌ Aucun anniversaire enregistré sur ce serveur.');
    return;
  }

  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Group by month
  const birthdaysByMonth: Record<number, typeof birthdays> = {};
  for (const birthday of birthdays) {
    if (!birthdaysByMonth[birthday.birthMonth]) {
      birthdaysByMonth[birthday.birthMonth] = [];
    }
    birthdaysByMonth[birthday.birthMonth].push(birthday);
  }

  const embed = new EmbedBuilder()
    .setTitle('🎉 Anniversaires du serveur')
    .setColor(0xFF69B4)
    .setTimestamp();

  let description = '';
  
  for (let month = 1; month <= 12; month++) {
    const monthBirthdays = birthdaysByMonth[month];
    if (!monthBirthdays || monthBirthdays.length === 0) continue;

    description += `\n**${monthNames[month - 1].toUpperCase()}**\n`;
    
    for (const birthday of monthBirthdays) {
      const user = await interaction.client.users.fetch(birthday.userId).catch(() => null);
      const username = user ? user.username : 'Utilisateur inconnu';
      const yearStr = birthday.birthYear ? ` (${birthday.birthYear})` : '';
      description += `• ${birthday.birthDay} - ${username}${yearStr}\n`;
    }
  }

  embed.setDescription(description || 'Aucun anniversaire enregistré');

  await interaction.editReply({ embeds: [embed] });
}
