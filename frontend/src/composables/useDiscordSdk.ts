import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  initializeDiscordSdk,
  getCurrentUser,
  getCurrentChannel,
  getCurrentGuild,
  getVoiceParticipants,
  refreshVoiceParticipants,
  openInviteDialog,
  setActivity,
  getInstanceId,
  getChannelId,
  getGuildId,
  type DiscordUser,
  type ChannelInfo,
  type GuildInfo,
  type VoiceChannelParticipant,
} from '../services/discordSdk';

export function useDiscordSdk() {
  const isReady = ref(false);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const user = ref<DiscordUser | null>(null);
  const channel = ref<ChannelInfo | null>(null);
  const guild = ref<GuildInfo | null>(null);
  const voiceParticipants = ref<VoiceChannelParticipant[]>([]);

  let participantTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(async () => {
    try {
      isLoading.value = true;
      error.value = null;
      const success = await initializeDiscordSdk();
      if (success) {
        isReady.value = true;
        user.value = getCurrentUser();
        channel.value = getCurrentChannel();
        guild.value = getCurrentGuild();
        voiceParticipants.value = getVoiceParticipants();

        participantTimer = setInterval(async () => {
          voiceParticipants.value = await refreshVoiceParticipants();
        }, 5000);
      } else {
        error.value = 'Failed to initialize Discord SDK';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  });

  onUnmounted(() => {
    if (participantTimer) clearInterval(participantTimer);
  });

  const refreshParticipants = async () => {
    voiceParticipants.value = await refreshVoiceParticipants();
  };

  const inviteFriends = async () => {
    await openInviteDialog();
  };

  const updateActivity = async (details: string, state?: string) => {
    await setActivity(details, state);
  };

  const humanParticipants = computed(() =>
    voiceParticipants.value.filter((p) => !p.bot)
  );

  return {
    isReady,
    isLoading,
    error,
    user,
    channel,
    guild,
    voiceParticipants,
    humanParticipants,
    refreshParticipants,
    inviteFriends,
    updateActivity,
    instanceId: computed(() => getInstanceId()),
    channelId: computed(() => getChannelId()),
    guildId: computed(() => getGuildId()),
  };
}

export default useDiscordSdk;
