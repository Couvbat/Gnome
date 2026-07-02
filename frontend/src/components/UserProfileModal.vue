<script setup lang="ts">
import { computed } from 'vue';
import type { User, Character } from '../types';
import { CHARACTER_CLASSES, calculateLevelProgress, GAME_CONFIG } from '../constants';
import type { EnergyInfo } from '../composables/useEnergy';
import Modal from './atoms/Modal.vue';
import Card from './atoms/Card.vue';
import Button from './atoms/Button.vue';
import ProgressBar from './atoms/ProgressBar.vue';
import EnergyDisplay from './organisms/EnergyDisplay.vue';

const props = defineProps<{
  isOpen: boolean;
  user: User | null;
  character: Character | null;
  energy?: EnergyInfo | null;
}>();

const emit = defineEmits<{ close: [] }>();

const classInfo = computed(() =>
  props.character?.className ? CHARACTER_CLASSES[props.character.className] : null
);

const xpInfo = computed(() =>
  calculateLevelProgress(props.user?.level ?? 0, props.user?.experience ?? 0)
);

const statBars = [
  { label: 'Force', key: 'strength', color: 'bg-red-500' },
  { label: 'Intelligence', key: 'intelligence', color: 'bg-blue-500' },
  { label: 'Chance', key: 'luck', color: 'bg-yellow-500' },
  { label: 'Charisme', key: 'charisma', color: 'bg-pink-500' },
  { label: 'Vitalité', key: 'vitality', color: 'bg-green-500' },
  { label: 'Dextérité', key: 'dexterity', color: 'bg-purple-500' },
] as const;

const bonusColorClasses: Record<string, string> = {
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
};
</script>

<template>
  <Modal
    v-if="user"
    :is-open="isOpen"
    title="Profil Utilisateur"
    title-icon="👤"
    size="lg"
    @close="emit('close')"
  >
    <div class="p-6 space-y-6">
      <Card variant="default" padding="md" :bordered="true" class="border-white/10">
        <h3 class="text-xl font-bold text-gnome-gold mb-4">📊 Informations Générales</h3>

        <div v-if="user.avatarUrl" class="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
          <img :src="user.avatarUrl" :alt="user.discordUsername || user.username" class="w-16 h-16 rounded-full border-2 border-gnome-gold shadow-lg" />
          <div>
            <div class="text-xl font-bold text-white">{{ user.discordGlobalName || user.username }}</div>
            <div v-if="user.discordUsername && user.discordGlobalName !== user.discordUsername" class="text-sm text-white/60">@{{ user.discordUsername }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-white/70 mb-1">Nom d'utilisateur</div>
            <div class="text-lg font-bold text-white">{{ user.discordGlobalName || user.username }}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-white/70 mb-1">Pièces</div>
            <div class="text-lg font-bold text-yellow-400">💰 {{ user.coins }}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-white/70 mb-1">Niveau</div>
            <div class="text-lg font-bold text-gnome-gold">⭐ {{ user.level }}</div>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex justify-between text-sm text-white/70 mb-2">
            <span>Expérience</span>
            <span class="text-gnome-gold font-bold">{{ user.experience || 0 }} XP ({{ xpInfo.xpNeeded }} XP pour niveau {{ user.level + 1 }})</span>
          </div>
          <ProgressBar :value="xpInfo.xpProgress" :max="100" color="gold" size="lg" />
        </div>
      </Card>

      <template v-if="character">
        <Card variant="default" padding="md" :bordered="true" class="border-white/10">
          <h3 class="text-xl font-bold text-gnome-gold mb-4">🎭 Personnage</h3>
          <div class="flex items-center gap-4 mb-6">
            <div :class="['text-6xl', classInfo?.color]">{{ classInfo?.emoji }}</div>
            <div>
              <div class="text-2xl font-bold text-white">{{ character.name }}</div>
              <div :class="['text-lg capitalize', classInfo?.color]">{{ classInfo?.name || character.className }}</div>
              <div class="text-sm text-white/70">Niveau {{ character.level }}</div>
            </div>
          </div>
          <div v-if="character.stats" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div v-for="stat in statBars.slice(0, 3)" :key="stat.key" class="mb-3">
                <div class="flex justify-between text-sm mb-1"><span class="text-white/70">{{ stat.label }}</span><span class="text-white font-medium">{{ character.stats[stat.key] }}</span></div>
                <div class="h-2.5 bg-white/10 rounded-full overflow-hidden"><div :class="['h-full transition-all duration-500', stat.color]" :style="{ width: `${Math.min(100, (character.stats[stat.key] / 30) * 100)}%` }" /></div>
              </div>
            </div>
            <div>
              <div v-for="stat in statBars.slice(3)" :key="stat.key" class="mb-3">
                <div class="flex justify-between text-sm mb-1"><span class="text-white/70">{{ stat.label }}</span><span class="text-white font-medium">{{ character.stats[stat.key] }}</span></div>
                <div class="h-2.5 bg-white/10 rounded-full overflow-hidden"><div :class="['h-full transition-all duration-500', stat.color]" :style="{ width: `${Math.min(100, (character.stats[stat.key] / 30) * 100)}%` }" /></div>
              </div>
            </div>
          </div>
        </Card>

        <Card v-if="character.casinoBonus" variant="default" padding="md" :bordered="true" class="border-white/10">
          <h3 class="text-xl font-bold text-gnome-gold mb-4">🎰 Bonus Casino</h3>
          <div class="space-y-3">
            <div v-for="[label, value, color] in [['Bonus de Chance', `+${character.casinoBonus.luckBonus}%`, 'green'], ['Bonus d\'Énergie', `+${character.casinoBonus.energyBonus}`, 'blue']]" :key="label" :class="['border rounded-lg p-4', bonusColorClasses[color]]">
              <div class="flex items-center justify-between"><div class="text-sm text-white/90">{{ label }}</div><div class="text-lg font-bold">{{ value }}</div></div>
            </div>
            <div v-if="character.casinoBonus.specialAbility" class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div class="text-sm text-white/90 mb-1">Capacité Spéciale</div>
              <div class="text-base font-bold text-purple-400 capitalize">{{ character.casinoBonus.specialAbility.replace(/_/g, ' ') }}</div>
              <div v-if="character.casinoBonus.description" class="text-xs text-white/70 mt-2">{{ character.casinoBonus.description }}</div>
            </div>
          </div>
        </Card>

        <EnergyDisplay
          :current="energy?.current ?? character.energy ?? GAME_CONFIG.BASE_ENERGY"
          :max="energy?.max ?? character.maxEnergy ?? GAME_CONFIG.MAX_ENERGY"
          :regen-rate="energy?.regenRate ?? GAME_CONFIG.ENERGY_REGEN_RATE"
          :minutes-until-full="energy?.minutesUntilFull ?? 0"
        />
      </template>

      <Card v-else variant="default" padding="md" :bordered="true" class="border-white/10 text-center">
        <div class="text-4xl mb-4">🎭</div>
        <div class="text-white/70">Aucun personnage créé</div>
        <div class="text-sm text-white/50 mt-2">Créez un personnage pour débloquer les fonctionnalités RPG!</div>
      </Card>
    </div>

    <div class="sticky bottom-0 bg-gradient-to-r from-gnome-dark to-gnome-blue border-t-2 border-gnome-gold p-4">
      <Button variant="primary" size="lg" :full-width="true" @click="emit('close')">Fermer</Button>
    </div>
  </Modal>
</template>
