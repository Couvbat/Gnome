import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  Message
} from 'discord.js';
import { request } from 'undici';
import { Command } from '../types/command';

// Regional routing for Riot API
const PLATFORM_ROUTING = 'euw1'; // Platform routing for summoner data

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

interface RankedEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lol-stats')
    .setDescription('Affiche les statistiques d\'un joueur League of Legends')
    .addStringOption(option =>
      option
        .setName('summoner')
        .setDescription('Nom d\'invocateur (format: GameName#TAG ou GameName)')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const summonerInput = interaction.options.getString('summoner', true);
    const apiKey = process.env.RIOT_GAMES_API_KEY;

    if (!apiKey) {
      await interaction.editReply({
        content: 'Erreur: La clé API Riot n\'est pas configurée.',
      });
      return;
    }

    try {
      // Parse summoner name (support GameName#TAG or just GameName)
      let gameName: string;
      let tagLine: string;

      if (summonerInput.includes('#')) {
        [gameName, tagLine] = summonerInput.split('#');
      } else {
        gameName = summonerInput;
        tagLine = 'EUW'; // Default tag for EUW
      }

      // Step 1: Get account by Riot ID (gameName + tagLine)
      const accountResponse = await request(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (accountResponse.statusCode === 429) {
        await interaction.editReply({
          content: '⏱️ Trop de requêtes vers l\'API Riot Games (limite de débit atteinte). Réessayez dans quelques instants.',
        });
        return;
      }

      if (accountResponse.statusCode === 404) {
        await interaction.editReply({
          content: `Joueur introuvable: ${gameName}#${tagLine}. Vérifiez le nom et le tag.`,
        });
        return;
      }

      if (accountResponse.statusCode !== 200) {
        throw new Error(`Account API returned status ${accountResponse.statusCode}`);
      }

      const account = (await accountResponse.body.json()) as RiotAccount;

      // Step 2: Get summoner data by PUUID
      const summonerResponse = await request(
        `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (summonerResponse.statusCode === 429) {
        await interaction.editReply({
          content: '⏱️ Trop de requêtes vers l\'API Riot Games (limite de débit atteinte). Réessayez dans quelques instants.',
        });
        return;
      }

      if (summonerResponse.statusCode !== 200) {
        throw new Error(`Summoner API returned status ${summonerResponse.statusCode}`);
      }

      const summoner = (await summonerResponse.body.json()) as Summoner;

      // Step 3: Get ranked stats
      const rankedResponse = await request(
        `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      let rankedEntries: RankedEntry[] = [];

      if (rankedResponse.statusCode === 429) {
        await interaction.editReply({
          content: '⏱️ Trop de requêtes vers l\'API Riot Games (limite de débit atteinte). Réessayez dans quelques instants.',
        });
        return;
      } else if (rankedResponse.statusCode === 403) {
        // API key doesn't have access to League-v4 endpoint
        // Continue without ranked data
        console.log('League-v4 endpoint returned 403 - continuing without ranked data');
      } else if (rankedResponse.statusCode !== 200) {
        throw new Error(`League API returned status ${rankedResponse.statusCode}`);
      } else {
        rankedEntries = (await rankedResponse.body.json()) as RankedEntry[];
      }

      // Find ranked entries
      const soloQueue = rankedEntries.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
      const flexQueue = rankedEntries.find(entry => entry.queueType === 'RANKED_FLEX_SR');

      // Create buttons for navigation
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('overview')
            .setLabel('📊 Aperçu')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('solo')
            .setLabel('🎯 Solo/Duo')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!soloQueue),
          new ButtonBuilder()
            .setCustomId('flex')
            .setLabel('🎮 Flexible')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!flexQueue)
        );

      // Build initial overview embed
      const overviewEmbed = buildOverviewEmbed(account, summoner, soloQueue, flexQueue);

      const response = await interaction.editReply({ 
        embeds: [overviewEmbed], 
        components: [buttons] 
      }) as Message;

      // Create collector for button interactions
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on('collect', async (buttonInteraction) => {
        // Only allow the original user to interact
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'Ces boutons ne sont pas pour toi !',
            ephemeral: true,
          });
          return;
        }

        let embed: EmbedBuilder;

        switch (buttonInteraction.customId) {
          case 'overview':
            embed = buildOverviewEmbed(account, summoner, soloQueue, flexQueue);
            break;
          case 'solo':
            embed = buildQueueDetailEmbed(account, summoner, soloQueue!, 'Solo/Duo', '🎯');
            break;
          case 'flex':
            embed = buildQueueDetailEmbed(account, summoner, flexQueue!, 'Flexible', '🎮');
            break;
          default:
            return;
        }

        // Update button styles to show active view
        const updatedButtons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('overview')
              .setLabel('📊 Aperçu')
              .setStyle(buttonInteraction.customId === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('solo')
              .setLabel('🎯 Solo/Duo')
              .setStyle(buttonInteraction.customId === 'solo' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setDisabled(!soloQueue),
            new ButtonBuilder()
              .setCustomId('flex')
              .setLabel('🎮 Flexible')
              .setStyle(buttonInteraction.customId === 'flex' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setDisabled(!flexQueue)
          );

        await buttonInteraction.update({ 
          embeds: [embed], 
          components: [updatedButtons] 
        });
      });

      collector.on('end', async () => {
        // Disable buttons when collector expires
        const disabledButtons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('overview')
              .setLabel('📊 Aperçu')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('solo')
              .setLabel('🎯 Solo/Duo')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('flex')
              .setLabel('🎮 Flexible')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        await interaction.editReply({ components: [disabledButtons] }).catch(() => {});
      });
    } catch (error) {
      console.error('Error fetching LoL stats:', error);
      await interaction.editReply({
        content: 'Une erreur est survenue lors de la récupération des statistiques. Réessayez plus tard.',
      });
    }
  },

  cooldown: 10,
};

// Helper function to build overview embed (both queues)
function buildOverviewEmbed(
  account: RiotAccount,
  summoner: Summoner,
  soloQueue?: RankedEntry,
  flexQueue?: RankedEntry
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`📊 ${account.gameName}#${account.tagLine}`)
    .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/14.21.1/img/profileicon/${summoner.profileIconId}.png`)
    .addFields(
      { name: '🎯 Niveau', value: `${summoner.summonerLevel}`, inline: true },
      { name: '🌍 Région', value: 'EUW', inline: true },
      { name: '\u200B', value: '\u200B', inline: true }
    );

  // Add Solo/Duo stats
  if (soloQueue) {
    const winRate = ((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100).toFixed(1);
    const rankEmoji = getRankEmoji(soloQueue.tier);
    embed.addFields({
      name: `${rankEmoji} Solo/Duo`,
      value: [
        `**${soloQueue.tier} ${soloQueue.rank}** - ${soloQueue.leaguePoints} LP`,
        `${soloQueue.wins}V / ${soloQueue.losses}D (${winRate}%)`,
        soloQueue.hotStreak ? '🔥 Série de victoires' : '',
      ].filter(Boolean).join('\n'),
      inline: true,
    });
  } else {
    embed.addFields({
      name: '🎮 Solo/Duo',
      value: 'Non classé',
      inline: true,
    });
  }

  // Add Flex stats
  if (flexQueue) {
    const winRate = ((flexQueue.wins / (flexQueue.wins + flexQueue.losses)) * 100).toFixed(1);
    const rankEmoji = getRankEmoji(flexQueue.tier);
    embed.addFields({
      name: `${rankEmoji} Flexible`,
      value: [
        `**${flexQueue.tier} ${flexQueue.rank}** - ${flexQueue.leaguePoints} LP`,
        `${flexQueue.wins}V / ${flexQueue.losses}D (${winRate}%)`,
        flexQueue.hotStreak ? '🔥 Série de victoires' : '',
      ].filter(Boolean).join('\n'),
      inline: true,
    });
  } else {
    embed.addFields({
      name: '🎮 Flexible',
      value: 'Non classé',
      inline: true,
    });
  }

  embed.setFooter({ text: `PUUID: ${account.puuid.substring(0, 20)}...` });
  embed.setTimestamp();

  return embed;
}

// Helper function to build detailed queue embed
function buildQueueDetailEmbed(
  account: RiotAccount,
  summoner: Summoner,
  queue: RankedEntry,
  queueName: string,
  emoji: string
): EmbedBuilder {
  const winRate = ((queue.wins / (queue.wins + queue.losses)) * 100).toFixed(1);
  const totalGames = queue.wins + queue.losses;
  const rankEmoji = getRankEmoji(queue.tier);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`${emoji} ${account.gameName}#${account.tagLine} - ${queueName}`)
    .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/14.21.1/img/profileicon/${summoner.profileIconId}.png`)
    .addFields(
      { 
        name: `${rankEmoji} Rang`, 
        value: `**${queue.tier} ${queue.rank}**\n${queue.leaguePoints} LP`, 
        inline: true 
      },
      { 
        name: '📊 Statistiques', 
        value: `${totalGames} parties jouées\n${winRate}% de victoires`, 
        inline: true 
      },
      { 
        name: '🏆 Score', 
        value: `${queue.wins} Victoires\n${queue.losses} Défaites`, 
        inline: true 
      }
    );

  // Add status badges
  const badges: string[] = [];
  if (queue.hotStreak) badges.push('🔥 Série de victoires');
  if (queue.veteran) badges.push('🎖️ Vétéran');
  if (queue.freshBlood) badges.push('✨ Nouveau dans ce rang');

  if (badges.length > 0) {
    embed.addFields({
      name: '🏅 Statut',
      value: badges.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: `Niveau ${summoner.summonerLevel} • EUW` });
  embed.setTimestamp();

  return embed;
}

// Helper function to get rank emoji
function getRankEmoji(tier: string): string {
  const emojis: { [key: string]: string } = {
    'IRON': '🔩',
    'BRONZE': '🥉',
    'SILVER': '🥈',
    'GOLD': '🥇',
    'PLATINUM': '💎',
    'EMERALD': '💚',
    'DIAMOND': '💠',
    'MASTER': '🎭',
    'GRANDMASTER': '👑',
    'CHALLENGER': '⭐',
  };
  return emojis[tier] || '🎮';
}

// For backward compatibility with CommonJS
module.exports = command;
