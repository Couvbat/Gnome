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
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  win: boolean;
  summoner1Id: number;
  summoner2Id: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  largestKillingSpree: number;
  goldSpent: number;
  champLevel: number;
  totalHeal: number;
  damageSelfMitigated: number;
}

interface MatchInfo {
  gameCreation: number;
  gameDuration: number;
  gameMode: string;
  queueId: number;
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
    .setName('lol-lastgame')
    .setDescription('Analyse détaillée de votre dernière partie avec conseils personnalisés')
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

      // Get last match ID
      const matchIdsResponse = await request(
        `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=1`,
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

      // Get detailed match data
      const matchResponse = await request(
        `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchIds[0]}`,
        {
          headers: {
            'X-Riot-Token': apiKey,
          },
        }
      );

      if (matchResponse.statusCode !== 200) {
        throw new Error(`Match API returned status ${matchResponse.statusCode}`);
      }

      const matchData = (await matchResponse.body.json()) as MatchData;
      const playerData = matchData.info.participants.find(
        p => p.puuid === account.puuid
      );

      if (!playerData) {
        await interaction.editReply({
          content: 'Impossible de trouver les données du joueur dans cette partie.',
        });
        return;
      }

      // Calculate performance metrics
      const durationMin = Math.floor(matchData.info.gameDuration / 60);
      const kda = playerData.deaths === 0 
        ? 'Perfect' 
        : ((playerData.kills + playerData.assists) / playerData.deaths).toFixed(2);
      const totalCS = playerData.totalMinionsKilled + playerData.neutralMinionsKilled;
      const csPerMin = (totalCS / durationMin).toFixed(1);
      const visionScorePerMin = (playerData.visionScore / durationMin).toFixed(1);
      const goldEfficiency = ((playerData.goldSpent / playerData.goldEarned) * 100).toFixed(1);
      const damagePerGold = (playerData.totalDamageDealtToChampions / playerData.goldEarned * 1000).toFixed(0);

      // Generate personalized tips
      const tips = generateTips(playerData, matchData.info, durationMin, parseFloat(csPerMin), parseFloat(visionScorePerMin));

      // Build main stats embed
      const statsEmbed = buildStatsEmbed(account, playerData, matchData.info, durationMin, kda, totalCS, csPerMin, visionScorePerMin, goldEfficiency, damagePerGold);

      // Build tips embed
      const tipsEmbed = buildTipsEmbed(tips, playerData.win);

      // Create buttons for view switching
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('stats')
            .setLabel('📊 Statistiques')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('tips')
            .setLabel('💡 Conseils')
            .setStyle(ButtonStyle.Secondary)
        );

      const response = await interaction.editReply({ 
        embeds: [statsEmbed], 
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

        const embed = buttonInteraction.customId === 'stats' ? statsEmbed : tipsEmbed;

        // Update button styles
        const updatedButtons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('stats')
              .setLabel('📊 Statistiques')
              .setStyle(buttonInteraction.customId === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('tips')
              .setLabel('💡 Conseils')
              .setStyle(buttonInteraction.customId === 'tips' ? ButtonStyle.Primary : ButtonStyle.Secondary)
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
              .setCustomId('stats')
              .setLabel('📊 Statistiques')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('tips')
              .setLabel('💡 Conseils')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        await interaction.editReply({ components: [disabledButtons] }).catch(() => {});
      });
    } catch (error) {
      console.error('Error fetching last game:', error);
      await interaction.editReply({
        content: 'Une erreur est survenue lors de la récupération de la dernière partie. Réessayez plus tard.',
      });
    }
  },

  cooldown: 10,
};

// Helper function to build stats embed
function buildStatsEmbed(
  account: RiotAccount,
  player: MatchParticipant,
  match: MatchInfo,
  durationMin: number,
  kda: string,
  totalCS: number,
  csPerMin: string,
  visionScorePerMin: string,
  goldEfficiency: string,
  damagePerGold: string
): EmbedBuilder {
  const result = player.win ? '✅ VICTOIRE' : '❌ DÉFAITE';
  const color = player.win ? 0x00ff00 : 0xff0000;
  
  const gameMode = formatGameMode(match.gameMode);
  const timeSince = getTimeSince(match.gameCreation);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${result} - ${player.championName}`)
    .setDescription(`${account.gameName}#${account.tagLine} • ${gameMode} • ${timeSince}`)
    .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/14.21.1/img/champion/${player.championName}.png`)
    .addFields(
      {
        name: '⚔️ Combat',
        value: [
          `**KDA:** ${player.kills}/${player.deaths}/${player.assists} (${kda})`,
          `**Dégâts:** ${Math.floor(player.totalDamageDealtToChampions / 1000)}k`,
          `**Subis:** ${Math.floor(player.totalDamageTaken / 1000)}k`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🌾 Farm & Gold',
        value: [
          `**CS:** ${totalCS} (${csPerMin}/min)`,
          `**Gold:** ${Math.floor(player.goldEarned / 1000)}k`,
          `**Efficacité:** ${goldEfficiency}%`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '👁️ Vision',
        value: [
          `**Score:** ${player.visionScore} (${visionScorePerMin}/min)`,
          `**Balises:** ${player.wardsPlaced}`,
          `**Détruites:** ${player.wardsKilled}`,
        ].join('\n'),
        inline: true,
      }
    );

  // Add multikills if any
  const multikills: string[] = [];
  if (player.pentaKills > 0) multikills.push(`🏆 ${player.pentaKills} Pentakill`);
  if (player.quadraKills > 0) multikills.push(`💎 ${player.quadraKills} Quadrakill`);
  if (player.tripleKills > 0) multikills.push(`⭐ ${player.tripleKills} Triple kill`);
  if (player.doubleKills > 0) multikills.push(`✨ ${player.doubleKills} Double kill`);

  if (multikills.length > 0) {
    embed.addFields({
      name: '🎯 Exploits',
      value: multikills.join('\n'),
      inline: false,
    });
  }

  embed.addFields({
    name: '📈 Performances',
    value: [
      `**Niveau:** ${player.champLevel}`,
      `**Durée:** ${durationMin} minutes`,
      `**Dégâts/Gold:** ${damagePerGold}`,
      `**Plus longue série:** ${player.largestKillingSpree} kills`,
    ].join('\n'),
    inline: false,
  });

  embed.setFooter({ text: 'Utilisez les boutons pour naviguer entre stats et conseils' });
  embed.setTimestamp(match.gameCreation);

  return embed;
}

// Helper function to build tips embed
function buildTipsEmbed(tips: string[], won: boolean): EmbedBuilder {
  const color = won ? 0x00ff00 : 0xff0000;
  const title = won ? '💡 Conseils pour maintenir ce niveau' : '💡 Conseils pour progresser';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription('Analyse de votre dernière partie')
    .setTimestamp();

  tips.forEach((tip, index) => {
    embed.addFields({
      name: `${index + 1}. ${getTipIcon(tip)}`,
      value: tip,
      inline: false,
    });
  });

  return embed;
}

// Helper function to generate personalized tips
function generateTips(
  player: MatchParticipant,
  match: MatchInfo,
  _durationMin: number,
  csPerMin: number,
  visionScorePerMin: number
): string[] {
  const tips: string[] = [];

  // KDA Analysis
  const kda = player.deaths === 0 ? 999 : (player.kills + player.assists) / player.deaths;
  if (kda < 2) {
    tips.push('**Réduire les morts:** Votre KDA est faible. Travaillez votre positionnement en teamfight et évitez les engagements risqués sans vision.');
  } else if (kda > 5) {
    tips.push('**Excellent KDA!** Continuez à jouer prudemment tout en cherchant des opportunités d\'aggression calculées.');
  }

  // CS Analysis
  if (csPerMin < 5) {
    tips.push('**Améliorer le farming:** Votre CS/min est bas. Entraînez-vous en partie custom pour perfectionner le last-hit et gérer les vagues.');
  } else if (csPerMin < 7) {
    tips.push('**Farm correct:** Pour progresser, essayez de maintenir 7+ CS/min en optimisant vos timings de back et rotations.');
  } else if (csPerMin >= 8) {
    tips.push('**Farm excellent!** Votre économie est solide. Pensez à convertir cet avantage en objectifs et pression sur la map.');
  }

  // Vision Analysis
  if (visionScorePerMin < 1.5) {
    tips.push('**Augmenter la vision:** Placez plus de balises! Visez 1.5+ vision score/min. Chaque back, achetez des balises de contrôle.');
  } else if (visionScorePerMin >= 2) {
    tips.push('**Vision excellente!** Continuez à sécuriser les zones clés avant les objectifs et à dénier la vision ennemie.');
  }

  // Kill Participation
  // First 5 participants are team 1, last 5 are team 2
  const playerIndex = match.participants.findIndex(p => p.puuid === player.puuid);
  const isTeam1 = playerIndex < 5;
  
  // Calculate total team kills more efficiently
  const totalTeamKills = match.participants
    .filter((_, index) => (index < 5) === isTeam1)
    .reduce((sum, p) => sum + p.kills, 0);
  
  const killParticipation = totalTeamKills > 0 ? ((player.kills + player.assists) / totalTeamKills * 100).toFixed(0) : '0';
  
  if (parseInt(killParticipation) < 40) {
    tips.push(`**Participation aux kills faible (${killParticipation}%):** Soyez plus présent sur les objectifs et teamfights. Communiquez vos intentions et suivez les pings.`);
  } else if (parseInt(killParticipation) >= 60) {
    tips.push(`**Excellente participation (${killParticipation}%)!** Vous êtes très actif dans les actions de votre équipe. Continuez!`);
  }

  // Gold Efficiency
  const goldEfficiency = (player.goldSpent / player.goldEarned) * 100;
  if (goldEfficiency < 75) {
    tips.push('**Optimiser les achats:** Vous avez beaucoup d\'or non dépensé. Revenez en base après les objectifs majeurs pour convertir votre gold en puissance.');
  }

  // Damage Analysis
  const damagePerDeath = player.deaths > 0 ? player.totalDamageDealtToChampions / player.deaths : player.totalDamageDealtToChampions;
  if (damagePerDeath < 10000 && player.deaths > 5) {
    tips.push('**Impact en teamfight:** Vous mourez sans faire assez de dégâts. Attendez les initiations de votre équipe avant d\'entrer en combat.');
  }

  // If no specific issues, give general advice
  if (tips.length === 0) {
    tips.push('**Performance solide!** Continuez à travailler la synergie d\'équipe et la communication pour gagner plus de parties.');
  }

  // Limit to 5 tips maximum
  return tips.slice(0, 5);
}

// Helper function to get tip icon based on content
function getTipIcon(tip: string): string {
  if (tip.includes('KDA') || tip.includes('morts')) return '💀';
  if (tip.includes('Farm') || tip.includes('CS')) return '🌾';
  if (tip.includes('Vision') || tip.includes('balises')) return '👁️';
  if (tip.includes('kills') || tip.includes('Participation')) return '⚔️';
  if (tip.includes('Gold') || tip.includes('achats')) return '💰';
  if (tip.includes('Damage') || tip.includes('teamfight')) return '🔥';
  return '💡';
}

// Helper function to format game mode
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

// Helper function to get time since match
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
