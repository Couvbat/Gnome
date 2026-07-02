<script setup lang="ts">
import { useDiscordSdk } from '../composables/useDiscordSdk';

defineProps<{ onInviteClick?: () => void }>();

const { humanParticipants, inviteFriends, isReady, user } = useDiscordSdk();

async function handleInvite() {
  await inviteFriends();
}
</script>

<template>
  <div class="bg-gnome-dark/50 backdrop-blur-md rounded-xl p-4 border border-white/10">
    <p v-if="!isReady" class="text-white/60 text-sm">Connexion à Discord...</p>
    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-gnome-gold font-semibold flex items-center gap-2">
          <span class="text-lg">🎤</span>
          <span>Dans le salon vocal</span>
          <span class="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">{{ humanParticipants.length }}</span>
        </h3>
        <button class="bg-gnome-gold/20 hover:bg-gnome-gold/30 text-gnome-gold text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5" @click="handleInvite">
          <span>➕</span><span>Inviter</span>
        </button>
      </div>

      <p v-if="humanParticipants.length === 0" class="text-white/50 text-sm">
        Personne d'autre dans le salon vocal. Invite tes amis !
      </p>
      <div v-else class="space-y-2">
        <div
          v-for="participant in humanParticipants"
          :key="participant.id"
          :class="[
            'flex items-center gap-3 p-2 rounded-lg transition-colors',
            participant.id === user?.id ? 'bg-gnome-gold/10 border border-gnome-gold/30' : 'bg-white/5 hover:bg-white/10',
          ]"
        >
          <div class="relative">
            <img v-if="participant.avatar" :src="`https://cdn.discordapp.com/avatars/${participant.id}/${participant.avatar}.png?size=64`" :alt="participant.username" class="w-10 h-10 rounded-full" />
            <div v-else class="w-10 h-10 rounded-full bg-gnome-blue flex items-center justify-center text-white font-bold">
              {{ participant.username.charAt(0).toUpperCase() }}
            </div>
            <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gnome-dark" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white font-medium truncate">
              {{ participant.globalName || participant.username }}
              <span v-if="participant.id === user?.id" class="text-gnome-gold/70 text-xs ml-1.5">(toi)</span>
            </p>
            <p class="text-white/40 text-xs truncate">@{{ participant.username }}</p>
          </div>
          <div class="text-xs px-2 py-1 rounded bg-white/5 text-white/60">En ligne</div>
        </div>
      </div>

      <p class="text-white/40 text-xs mt-3">💡 Les joueurs dans ce salon peuvent rejoindre tes parties !</p>
    </template>
  </div>
</template>
