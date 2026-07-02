<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { User, Character } from './types';
import { apiService } from './services/api';
import { wsService } from './services/websocket';
import {
  initializeDiscordSdk,
  getCurrentUser as getDiscordUser,
  getGuildId,
  getChannelId,
} from './services/discordSdk';
import { useEnergy } from './composables';
import CharacterCreation from './components/CharacterCreation.vue';
import CasinoLobby from './components/CasinoLobby.vue';
import UserProfileModal from './components/UserProfileModal.vue';
import AppHeader from './components/organisms/AppHeader.vue';
import LoadingScreen from './components/molecules/LoadingScreen.vue';
import AmbientEmbers from './components/atoms/AmbientEmbers.vue';

type AppView = 'loading' | 'character-creation' | 'casino';

const view = ref<AppView>('loading');
const user = ref<User | null>(null);
const character = ref<Character | null>(null);
const error = ref<string | null>(null);
const isProfileOpen = ref(false);

const { energy, refresh: refreshEnergy } = useEnergy(1000, 60000);

onMounted(() => {
  initializeApp();
});

const initializeApp = async () => {
  try {
    const isFramed =
      window.self !== window.top ||
      window.location.search.includes('frame_id');

    if (isFramed) {
      try {
        const sdkSuccess = await initializeDiscordSdk();
        if (sdkSuccess) {
          const discordUser = getDiscordUser();
          getGuildId();
          getChannelId();

          if (discordUser) {
            try {
              const authResponse = await apiService.devLogin(
                discordUser.globalName || discordUser.username
              );
              const userData = await apiService.getCurrentUser();
              if (discordUser.avatar && discordUser.id) {
                userData.avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`;
                userData.discordUsername = discordUser.username;
                userData.discordGlobalName =
                  discordUser.globalName || discordUser.username;
              }
              user.value = userData;
              wsService.connect(authResponse.token);
              const characterData = await apiService.getCharacter(userData.id);
              character.value = characterData;
              view.value = characterData ? 'casino' : 'character-creation';
              return;
            } catch {
              /* fall through to regular auth */
            }
          }
        }
      } catch {
        /* fall through */
      }
    }

    const authResponse = await apiService.devLogin('Demo User');
    const userData = await apiService.getCurrentUser();
    user.value = userData;
    const characterData = await apiService.getCharacter(userData.id);
    character.value = characterData;
    view.value = characterData ? 'casino' : 'character-creation';
    if (characterData) wsService.connect(authResponse.token);
  } catch {
    error.value = 'Failed to initialize application. Using demo mode.';
    view.value = 'character-creation';
  }
};

const handleCharacterCreated = (newCharacter: Character) => {
  character.value = newCharacter;
  view.value = 'casino';
  const token = localStorage.getItem('authToken');
  if (token) wsService.connect(token);
};

const refreshUserData = async () => {
  try {
    const [userData, characterData] = await Promise.all([
      apiService.getCurrentUser(),
      user.value?.id ? apiService.getCharacter(user.value.id) : Promise.resolve(null),
      refreshEnergy(),
    ]);
    user.value = userData;
    if (characterData) character.value = characterData;
  } catch {
    /* ignore */
  }
};
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AmbientEmbers />
    <AppHeader
      :user="user"
      :character="character"
      :energy="energy"
      @profile-click="isProfileOpen = true"
    />

    <main class="flex-1 p-4 md:p-8 overflow-y-auto">
      <div
        v-if="error"
        class="max-w-2xl mx-auto px-6 py-4 bg-red-500/15 border-2 border-red-500/40 rounded-xl text-red-400 text-center font-medium shadow-lg shadow-red-500/20"
      >
        {{ error }}
      </div>

      <LoadingScreen v-if="view === 'loading'" message="Chargement..." />

      <CharacterCreation
        v-else-if="view === 'character-creation'"
        :user-id="user?.id || 'demo-user'"
        @character-created="handleCharacterCreated"
      />

      <CasinoLobby
        v-else-if="view === 'casino' && character"
        :character="character"
        :user-coins="user?.coins || 0"
        :energy="energy"
        @balance-change="refreshUserData"
      />
    </main>

    <UserProfileModal
      :is-open="isProfileOpen"
      :user="user"
      :character="character"
      :energy="energy"
      @close="isProfileOpen = false"
    />
  </div>
</template>
