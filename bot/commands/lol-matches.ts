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

const REGIONAL_ROUTING = 'europe';

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface MatchParticipant {
  puuid: string;
  championName: string;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  win: boolean;
  summonerName: string;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
}

interface MatchInfo {
  gameCreation: number;
  gameDuration: number;
  gameMode: string;
  participants: MatchParticipant[];
}

interface MatchData {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: MatchInfo;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lol-matches')
    .setDescription('Affiche l\'historique des parties d\'un joueur')
    .addStringOption(option =>
      option
        .setName('summoner')
        .setDescription('Nom d\'invocateur (format: GameName#TAG ou GameName)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('Nombre de parties à afficher (1-10)')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const summonerInput = interaction.options.getString('summoner', true);
    const matchCount = interaction.options.getInteger('count') || 5;
    const apiKey = process.env.RIOT_GAMES_API_KEY;

    if (!apiKey) {
      await interaction.editReply({
        content: 'Erreur: La clé API Riot n\'est pas configurée.',
      });
      return;
    }

    try {
      // Parse summoner name
      let gameName: string;
      let tagLine: string;

      if (summonerInput.includes('#')) {
        [gameName, tagLine] = summonerInput.split('#');
      } else {
        gameName = summonerInput;
        tagLine = 'EUW';
      }

      // Get account by Riot ID
      const accountResponse = await request(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (accountResponse.statusCode === 404) {
        await interaction.editReply({
          content: `Joueur introuvable: ${gameName}#${tagLine}`,
        });
        return;
      }

      const account = (await accountResponse.body.json()) as RiotAccount;

      // Get more match IDs for pagination (up to 20)
      const maxMatches = Math.max(matchCount, 20);
      const matchIdsResponse = await request(
        `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=${maxMatches}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (matchIdsResponse.statusCode !== 200) {
        throw new Error(`Match IDs API returned status ${matchIdsResponse.statusCode}`);
      }

      const matchIds = (await matchIdsResponse.body.json()) as string[];

      if (matchIds.length === 0) {
        await interaction.editReply({
          content: `Aucune partie récente trouvée pour ${gameName}#${tagLine}`,
        });
        return;
      }

      // Fetch all match details upfront
      const matchesData: MatchData[] = [];
      for (const matchId of matchIds) {
        try {
          const matchResponse = await request(
            `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
            {
              headers: {
                'X-Riot-Token': apiKey,
              },
            }
          );

          if (matchResponse.statusCode === 200) {
            const matchData = (await matchResponse.body.json()) as MatchData;
            matchesData.push(matchData);
          }
        } catch (matchError) {
          console.error(`Error fetching match ${matchId}:`, matchError);
        }
      }

      if (matchesData.length === 0) {
        await interaction.editReply({
          content: 'Impossible de récupérer les détails des parties.',
        });
        return;
      }

      // Pagination state
      let currentPage = 0;
      const matchesPerPage = 5;
      const totalPages = Math.ceil(matchesData.length / matchesPerPage);

      // Build initial embed and buttons
      const embed = buildMatchHistoryEmbed(account, matchesData, currentPage, matchesPerPage);
      const buttons = buildPaginationButtons(currentPage, totalPages);

      const response = await interaction.editReply({ 
        embeds: [embed], 
        components: totalPages > 1 ? [buttons] : [] 
      }) as Message;

      // Only create collector if there are multiple pages
      if (totalPages > 1) {
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

          // Update current page
          if (buttonInteraction.customId === 'prev') {
            currentPage = Math.max(0, currentPage - 1);
          } else if (buttonInteraction.customId === 'next') {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
          }

          // Build updated embed and buttons
          const updatedEmbed = buildMatchHistoryEmbed(account, matchesData, currentPage, matchesPerPage);
          const updatedButtons = buildPaginationButtons(currentPage, totalPages);

          await buttonInteraction.update({ 
            embeds: [updatedEmbed], 
            components: [updatedButtons] 
          });
        });

        collector.on('end', async () => {
          // Disable buttons when collector expires
          const disabledButtons = buildPaginationButtons(currentPage, totalPages, true);
          await interaction.editReply({ components: [disabledButtons] }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('Error fetching match history:', error);
      await interaction.editReply({
        content: 'Une erreur est survenue lors de la récupération de l\'historique. Réessayez plus tard.',
      });
    }
  },

  cooldown: 15,
};

// Helper function to build match history embed for a specific page
function buildMatchHistoryEmbed(
  account: RiotAccount,
  matchesData: MatchData[],
  page: number,
  matchesPerPage: number
): EmbedBuilder {
  const start = page * matchesPerPage;
  const end = Math.min(start + matchesPerPage, matchesData.length);
  const pageMatches = matchesData.slice(start, end);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`📜 Historique de ${account.gameName}#${account.tagLine}`)
    .setDescription(`Page ${page + 1}/${Math.ceil(matchesData.length / matchesPerPage)} • ${matchesData.length} parties`)
    .setTimestamp();

  for (const matchData of pageMatches) {
    const playerData = matchData.info.participants.find(
      p => p.puuid === account.puuid
    );

    if (playerData) {
      const kda = playerData.deaths === 0 
        ? 'Perfect' 
        : ((playerData.kills + playerData.assists) / playerData.deaths).toFixed(2);
      
      const result = playerData.win ? '✅ Victoire' : '❌ Défaite';
      const durationMin = Math.floor(matchData.info.gameDuration / 60);
      const cs = playerData.totalMinionsKilled;
      const csPerMin = (cs / durationMin).toFixed(1);

      const gameMode = formatGameMode(matchData.info.gameMode);
      const timeSince = getTimeSince(matchData.info.gameCreation);

      embed.addFields({
        name: `${result} - ${playerData.championName}`,
        value: [
          `**${playerData.kills}/${playerData.deaths}/${playerData.assists}** (KDA: ${kda})`,
          `${cs} CS (${csPerMin}/min) • ${Math.floor(playerData.goldEarned / 1000)}k gold`,
          `${gameMode} • ${durationMin}min • ${timeSince}`,
        ].join('\n'),
        inline: false,
      });
    }
  }

  return embed;
}

// Helper function to build pagination buttons
function buildPaginationButtons(
  currentPage: number,
  totalPages: number,
  disabled = false
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('◀️ Précédent')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || currentPage === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Suivant ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || currentPage === totalPages - 1)
    );
}

// Helper functions
function formatGameMode(mode: string): string {
  const modes: { [key: string]: string } = {
    'CLASSIC': 'Classique',
    'ARAM': 'ARAM',
    'URF': 'URF',
    'ONEFORALL': 'Tous pour un',
    'TUTORIAL': 'Tutoriel',
    'CHERRY': 'Arena',
  };
  return modes[mode] || mode;
}

function getTimeSince(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `Il y a ${days}j`;
  if (hours > 0) return `Il y a ${hours}h`;
  return 'À l\'instant';
}

// For backward compatibility with CommonJS
module.exports = command;
