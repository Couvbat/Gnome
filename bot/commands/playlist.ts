import { SlashCommandBuilder, CommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Ajouter une playlist YouTube ou SoundCloud à la file d\'attente')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('URL de la playlist YouTube ou SoundCloud')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const playlistUrl = interaction.options.getString('url', true);
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
    if (!voiceChannel.permissionsFor(interaction.guild!.members.me!)?.has(['Connect', 'Speak'])) {
      await interaction.editReply('❌ Je n\'ai pas les permissions pour rejoindre ou parler dans ce salon vocal.');
      return;
    }

    // Validate URL is a playlist
    if (!playlistUrl.includes('playlist') && !playlistUrl.includes('/sets/')) {
      await interaction.editReply('❌ Veuillez fournir une URL de playlist valide (YouTube ou SoundCloud).');
      return;
    }

    try {
      let queue = musicService.getQueue(guildId);

      // Create queue if it doesn't exist
      if (!queue) {
        const voiceConnection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild!.voiceAdapterCreator,
          selfDeaf: false
        });

        // Wait for the connection to be ready
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Voice connection timeout'));
            }, 10000);

            voiceConnection.on(VoiceConnectionStatus.Ready, () => {
              clearTimeout(timeout);
              resolve();
            });

            voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
              clearTimeout(timeout);
              reject(new Error('Voice connection failed'));
            });
          });
        } catch (error) {
          await interaction.editReply('❌ Impossible de rejoindre le salon vocal.');
          return;
        }

        queue = musicService.createQueue(guildId, interaction.channel as any, voiceConnection);
        await interaction.editReply('🎵 Connexion au salon vocal établie ! Chargement de la playlist...');
      } else {
        await interaction.editReply('🎵 Chargement de la playlist...');
      }

      // Add playlist tracks
      const result = await musicService.addPlaylist(guildId, playlistUrl, member.user.username);

      if (result.added === 0) {
        await interaction.editReply('❌ Impossible de charger la playlist. Vérifiez l\'URL et réessayez.');
        return;
      }

      let responseMessage = `✅ **${result.added}** pistes ajoutées à la file d'attente depuis la playlist.`;
      
      if (result.failed > 0) {
        responseMessage += `\n⚠️ ${result.failed} pistes n'ont pas pu être ajoutées.`;
      }

      // Show total queue size
      const totalTracks = queue.tracks.length;
      responseMessage += `\n📋 File d'attente: ${totalTracks} pistes au total.`;

      await interaction.editReply(responseMessage);

    } catch (error) {
      console.error('Error in playlist command:', error);
      await interaction.editReply('❌ Une erreur s\'est produite lors du chargement de la playlist.');
    }
  },

  cooldown: 5
};