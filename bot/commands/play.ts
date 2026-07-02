import { SlashCommandBuilder, CommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { joinVoiceChannel, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer de la musique depuis YouTube')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('URL YouTube ou termes de recherche')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const member = interaction.member as GuildMember;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply('❌ Cette commande ne peut être utilisée que dans un serveur.');
      return;
    }

    // Check if user is in a voice channel
    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      await interaction.editReply('❌ Vous devez être dans un salon vocal pour utiliser cette commande.');
      return;
    }

    // Check if bot has permissions
    const permissions = voiceChannel.permissionsFor(interaction.guild!.members.me!);
    if (!permissions?.has(['Connect', 'Speak'])) {
      await interaction.editReply('❌ Je n\'ai pas les permissions pour rejoindre ou parler dans ce salon vocal.');
      return;
    }

    // Check if the voice channel has a user limit and if it's full
    if (voiceChannel.userLimit > 0 && voiceChannel.members.size >= voiceChannel.userLimit) {
      if (!permissions.has('MoveMembers')) {
        await interaction.editReply('❌ Le salon vocal est plein et je n\'ai pas la permission de déplacer des membres.');
        return;
      }
    }

    try {
      let queue = musicService.getQueue(guildId);

      // Create queue if it doesn't exist
      if (!queue) {
        console.log(`[PLAY] Creating new voice connection for guild ${guildId}`);
        
        const voiceConnection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild!.voiceAdapterCreator,
          selfDeaf: false
        });

        // Add error handler for voice connection
        voiceConnection.on('error', (error) => {
          console.error('[VOICE] Connection error:', error);
        });

        // Wait for the connection to be ready with proper state handling
        try {
          // Wait for connection to be ready (max 30 seconds)
          await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
          console.log(`[VOICE] Successfully connected to voice channel in guild ${guildId}`);
        } catch (error) {
          console.error('[VOICE] Failed to enter Ready state:', error);
          voiceConnection.destroy();
          await interaction.editReply('❌ Impossible de rejoindre le salon vocal. Le délai de connexion a expiré.');
          return;
        }

        try {
          queue = musicService.createQueue(guildId, interaction.channel as any, voiceConnection);
          console.log(`[PLAY] Queue created successfully for guild ${guildId}`);
        } catch (error) {
          console.error('[PLAY] Failed to create queue:', error);
          voiceConnection.destroy();
          await interaction.editReply('❌ Erreur lors de la création de la file d\'attente.');
          return;
        }
      }

      // Check if this is a playlist URL
      if (query.includes('playlist') || query.includes('/sets/')) {
        await interaction.editReply('🎵 Détection d\'une playlist ! Chargement...');
        
        const result = await musicService.addPlaylist(guildId, query, member.user.username);
        
        if (result.added === 0) {
          await interaction.editReply('❌ Impossible de charger la playlist. Vérifiez l\'URL.');
          return;
        }

        let responseMessage = `✅ **${result.added}** pistes ajoutées depuis la playlist.`;
        if (result.failed > 0) {
          responseMessage += `\n⚠️ ${result.failed} pistes ont échoué.`;
        }
        responseMessage += `\n📋 File d'attente: ${queue.tracks.length} pistes au total.`;
        
        await interaction.editReply(responseMessage);
        return;
      }

      // Add single track to queue
      console.log(`[PLAY] Adding track: ${query} for user ${member.user.username}`);
      const track = await musicService.addTrack(guildId, query, member.user.username);

      if (!track) {
        console.log(`[PLAY] Failed to add track: ${query}`);
        await interaction.editReply('❌ Impossible de trouver cette piste. Vérifiez votre recherche ou URL.');
        return;
      }
      
      console.log(`[PLAY] Successfully added track: ${track.title}`);

      // Check if this is the first track (now playing)
      if (queue.tracks.length === 1 && queue.playing) {
        const embed = musicService.createNowPlayingEmbed(track);
        await interaction.editReply({ content: '', embeds: [embed] });
      } else {
        const sourceEmoji = track.source === 'soundcloud' ? '🟠' : '🔴';
        await interaction.editReply(
          `${sourceEmoji} **${track.title}** ajoutée à la file d'attente (position ${queue.tracks.length})`
        );
      }

    } catch (error) {
      console.error('Error in play command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        await interaction.editReply('❌ Timeout lors de la récupération de la piste. Veuillez réessayer.');
      } else {
        await interaction.editReply('❌ Une erreur s\'est produite lors de l\'ajout de la piste.');
      }
    }
  },

  cooldown: 3
};