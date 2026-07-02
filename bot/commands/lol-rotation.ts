import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  ComponentType,
  Message
} from 'discord.js';
import { request } from 'undici';
import { Command } from '../types/command';

const PLATFORM_ROUTING = 'euw1';

interface ChampionRotation {
  freeChampionIds: number[];
  freeChampionIdsForNewPlayers: number[];
  maxNewPlayerLevel: number;
}

interface ChampionData {
  type: string;
  format: string;
  version: string;
  data: {
    [key: string]: {
      version: string;
      id: string;
      key: string;
      name: string;
      title: string;
      blurb: string;
      info: {
        attack: number;
        defense: number;
        magic: number;
        difficulty: number;
      };
      image: {
        full: string;
        sprite: string;
        group: string;
        x: number;
        y: number;
        w: number;
        h: number;
      };
      tags: string[];
    };
  };
}

type Champion = ChampionData['data'][string];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lol-rotation')
    .setDescription('Affiche la rotation des champions gratuits de la semaine'),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const apiKey = process.env.RIOT_GAMES_API_KEY;

    if (!apiKey) {
      await interaction.editReply({
        content: 'Erreur: La clé API Riot n\'est pas configurée.',
      });
      return;
    }

    try {
      // Get champion rotation
      const rotationResponse = await request(
        `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/platform/v3/champion-rotations`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (rotationResponse.statusCode !== 200) {
        throw new Error(`Rotation API returned status ${rotationResponse.statusCode}`);
      }

      const rotation = (await rotationResponse.body.json()) as ChampionRotation;

      // Get champion data from Data Dragon
      const championDataResponse = await request(
        'https://ddragon.leagueoflegends.com/cdn/14.21.1/data/fr_FR/champion.json'
      );

      if (championDataResponse.statusCode !== 200) {
        throw new Error('Failed to fetch champion data from Data Dragon');
      }

      const championData = (await championDataResponse.body.json()) as ChampionData;

      // Map champion IDs to full champion objects
      const championMap = new Map<number, Champion>();
      Object.values(championData.data).forEach(champ => {
        championMap.set(parseInt(champ.key), champ);
      });

      // Get champion objects for rotation
      const freeChampionObjects = rotation.freeChampionIds
        .map(id => championMap.get(id))
        .filter((champ): champ is Champion => champ !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));

      const newPlayerChampionObjects = rotation.freeChampionIdsForNewPlayers
        .map(id => championMap.get(id))
        .filter((champ): champ is Champion => champ !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));

      // Build initial overview embed
      const overviewEmbed = buildRotationOverviewEmbed(
        freeChampionObjects,
        newPlayerChampionObjects,
        rotation.maxNewPlayerLevel
      );

      // Create select menu for filtering by role
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_filter')
        .setPlaceholder('Filtrer par rôle')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('📊 Vue d\'ensemble')
            .setDescription('Afficher tous les champions')
            .setValue('overview'),
          new StringSelectMenuOptionBuilder()
            .setLabel('⚔️ Combattant')
            .setDescription('Filtrer les combattants')
            .setValue('Fighter')
            .setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🗡️ Assassin')
            .setDescription('Filtrer les assassins')
            .setValue('Assassin')
            .setEmoji('🗡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🏹 Tireur')
            .setDescription('Filtrer les tireurs')
            .setValue('Marksman')
            .setEmoji('🏹'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🔮 Mage')
            .setDescription('Filtrer les mages')
            .setValue('Mage')
            .setEmoji('🔮'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🛡️ Tank')
            .setDescription('Filtrer les tanks')
            .setValue('Tank')
            .setEmoji('🛡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('💚 Support')
            .setDescription('Filtrer les supports')
            .setValue('Support')
            .setEmoji('💚')
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      const response = await interaction.editReply({
        embeds: [overviewEmbed],
        components: [row]
      }) as Message;

      // Create collector for select menu interactions
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300000, // 5 minutes
      });

      collector.on('collect', async (selectInteraction) => {
        // Only allow the original user to interact
        if (selectInteraction.user.id !== interaction.user.id) {
          await selectInteraction.reply({
            content: 'Ce menu n\'est pas pour toi !',
            ephemeral: true,
          });
          return;
        }

        const selectedRole = selectInteraction.values[0];

        let embed: EmbedBuilder;

        if (selectedRole === 'overview') {
          embed = buildRotationOverviewEmbed(
            freeChampionObjects,
            newPlayerChampionObjects,
            rotation.maxNewPlayerLevel
          );
        } else {
          // Filter champions by role
          const filteredChampions = freeChampionObjects.filter(champ =>
            champ.tags.includes(selectedRole)
          );

          embed = buildRoleFilteredEmbed(filteredChampions, selectedRole);
        }

        await selectInteraction.update({ embeds: [embed] });
      });

      collector.on('end', async () => {
        // Disable select menu when collector expires
        const disabledMenu = new StringSelectMenuBuilder()
          .setCustomId('role_filter')
          .setPlaceholder('Filtrer par rôle (expiré)')
          .setDisabled(true)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Expiré')
              .setValue('expired')
          );

        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(disabledMenu);

        await interaction.editReply({ components: [disabledRow] }).catch(() => {});
      });
    } catch (error) {
      console.error('Error fetching champion rotation:', error);
      await interaction.editReply({
        content: 'Une erreur est survenue lors de la récupération de la rotation. Réessayez plus tard.',
      });
    }
  },

  cooldown: 30, // Rotation doesn't change often, so higher cooldown is fine
};

// Helper function to build overview embed
function buildRotationOverviewEmbed(
  freeChampions: Champion[],
  newPlayerChampions: Champion[],
  maxNewPlayerLevel: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🎮 Rotation des Champions Gratuits')
    .setDescription('Champions jouables gratuitement cette semaine\nUtilisez le menu pour filtrer par rôle')
    .setThumbnail('https://ddragon.leagueoflegends.com/cdn/14.21.1/img/ui/champion.png')
    .setTimestamp();

  // Split champions into chunks for better display
  const championNames = freeChampions.map(c => c.name);
  const championsPerColumn = Math.ceil(championNames.length / 3);
  const column1 = championNames.slice(0, championsPerColumn);
  const column2 = championNames.slice(championsPerColumn, championsPerColumn * 2);
  const column3 = championNames.slice(championsPerColumn * 2);

  if (column1.length > 0) {
    embed.addFields({
      name: `Champions (${championNames.length})`,
      value: column1.map(name => `• ${name}`).join('\n'),
      inline: true,
    });
  }

  if (column2.length > 0) {
    embed.addFields({
      name: '\u200B',
      value: column2.map(name => `• ${name}`).join('\n'),
      inline: true,
    });
  }

  if (column3.length > 0) {
    embed.addFields({
      name: '\u200B',
      value: column3.map(name => `• ${name}`).join('\n'),
      inline: true,
    });
  }

  // Add new player rotation
  if (newPlayerChampions.length > 0) {
    const newPlayerNames = newPlayerChampions.map(c => c.name);
    embed.addFields({
      name: `🆕 Rotation Débutants (niveau ≤ ${maxNewPlayerLevel})`,
      value: newPlayerNames.map(name => `• ${name}`).join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Rotation mise à jour chaque semaine' });

  return embed;
}

// Helper function to build role-filtered embed
function buildRoleFilteredEmbed(
  champions: Champion[],
  role: string
): EmbedBuilder {
  const roleEmojis: { [key: string]: string } = {
    'Fighter': '⚔️',
    'Assassin': '🗡️',
    'Marksman': '🏹',
    'Mage': '🔮',
    'Tank': '🛡️',
    'Support': '💚',
  };

  const roleNames: { [key: string]: string } = {
    'Fighter': 'Combattants',
    'Assassin': 'Assassins',
    'Marksman': 'Tireurs',
    'Mage': 'Mages',
    'Tank': 'Tanks',
    'Support': 'Supports',
  };

  const emoji = roleEmojis[role] || '🎮';
  const roleName = roleNames[role] || role;

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`${emoji} ${roleName} - Rotation Gratuite`)
    .setDescription(champions.length > 0 
      ? `${champions.length} champion(s) disponible(s)` 
      : 'Aucun champion de ce rôle dans la rotation cette semaine')
    .setTimestamp();

  // Add each champion with details
  for (const champ of champions) {
    const difficulty = '⭐'.repeat(Math.min(champ.info.difficulty, 3));
    const roles = champ.tags.join(', ');
    
    embed.addFields({
      name: `${champ.name}`,
      value: [
        `*${champ.title}*`,
        `**Rôles:** ${roles}`,
        `**Difficulté:** ${difficulty}`,
        `${champ.blurb}`,
      ].join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Utilisez le menu pour changer de rôle' });

  return embed;
}

// For backward compatibility with CommonJS
module.exports = command;
