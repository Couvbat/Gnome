<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import type { User, Character } from './types';
import { apiService, authExpired } from './services/api';
import { wsService } from './services/websocket';
import {
  initializeDiscordSdk,
  isRunningInDiscordActivity,
  getAuthToken,
  getCurrentUser as getDiscordUser,
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

// Guards the authExpired watcher against an infinite retry loop: on retry,
// initializeDiscordSdk() is idempotent and returns the same cached (stale)
// token that just 401'd, so a second consecutive failure means automatic
// re-auth cannot succeed and the user must reload the Activity.
let hasRetriedAuth = false;

// Single rule for when the socket connects: once a character exists (either
// found on init, or just created). Both branches below and
// handleCharacterCreated follow this same rule - wsService.connect() already
// no-ops if already connected, so there's no need to guard it further.
const initializeApp = async () => {
  try {
    const isFramed =
      window.self !== window.top ||
      window.location.search.includes('frame_id');

    if (isFramed) {
      const sdkSuccess = await initializeDiscordSdk();

      if (isRunningInDiscordActivity()) {
        // Real Discord Activity: the Discord OAuth exchange (discordSdk.ts,
        // which calls POST /api/auth/discord) is the only valid login path.
        // devLogin() is dev-only and the backend 403s it in production, so we
        // must not fall back to it here - surface a real error instead.
        if (!sdkSuccess) {
          error.value =
            "Impossible de se connecter à Discord. Vérifiez votre connexion et réessayez.";
          view.value = 'character-creation';
          return;
        }

        const authToken = getAuthToken();
        if (!authToken) {
          error.value =
            "L'authentification Discord a échoué. Veuillez recharger l'application.";
          view.value = 'character-creation';
          return;
        }

        localStorage.setItem('authToken', authToken);
        const discordUser = getDiscordUser();
        const userData = await apiService.getCurrentUser();
        if (discordUser?.avatar && discordUser.id) {
          userData.avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`;
          userData.discordUsername = discordUser.username;
          userData.discordGlobalName = discordUser.globalName || discordUser.username;
        }
        user.value = userData;
        const characterData = await apiService.getMyCharacter();
        character.value = characterData;
        view.value = characterData ? 'casino' : 'character-creation';
        if (characterData) wsService.connect(authToken);
        error.value = null;
        hasRetriedAuth = false;
        return;
      }
      // Framed but not a real Discord Activity (e.g. local iframe testing
      // without a frame_id) - fall through to the dev login path below.
    }

    // Not running inside a real Discord Activity - local browser dev only.
    const authResponse = await apiService.devLogin('Demo User');
    const userData = await apiService.getCurrentUser();
    user.value = userData;
    const characterData = await apiService.getMyCharacter();
    character.value = characterData;
    view.value = characterData ? 'casino' : 'character-creation';
    if (characterData) wsService.connect(authResponse.token);
    error.value = null;
    hasRetriedAuth = false;
  } catch (err) {
    console.error('[App] Failed to initialize application:', err);
    error.value =
      err instanceof Error
        ? `Erreur lors de l'initialisation : ${err.message}`
        : "Erreur lors de l'initialisation de l'application.";
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
      apiService.getMyCharacter(),
      refreshEnergy(),
    ]);
    user.value = userData;
    if (characterData) character.value = characterData;
  } catch (err) {
    console.error('[App] Failed to refresh user data:', err);
    error.value = 'Impossible de rafraîchir vos données. Réessayez plus tard.';
  }
};

// Global 401 handling (services/api.ts response interceptor): when any API
// call comes back unauthorized, the token is stale/expired - clear session
// state, surface a clear message, and re-run the init flow to get a fresh
// session instead of leaving the user stuck on silently-failing requests.
// Only one automatic retry is attempted (hasRetriedAuth, reset on success):
// if the retry itself 401s again, re-running init would just reuse the same
// cached token and loop forever, so stop and ask the user to reload instead.
watch(authExpired, async (expired) => {
  if (!expired) return;
  authExpired.value = false;
  wsService.disconnect();
  user.value = null;
  character.value = null;
  if (hasRetriedAuth) {
    error.value = "Votre session a expiré. Veuillez recharger l'application.";
    view.value = 'character-creation';
    return;
  }
  hasRetriedAuth = true;
  view.value = 'loading';
  error.value = 'Votre session a expiré. Reconnexion en cours...';
  await initializeApp();
});
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
