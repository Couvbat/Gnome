<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Character } from '../types';
import { CHARACTER_CLASSES, calculateLevelProgress, GAME_CONFIG } from '../constants';
import type { EnergyInfo } from '../composables/useEnergy';

const props = defineProps<{
  character: Character;
  energy?: EnergyInfo | null;
}>();

const emit = defineEmits<{ close: [] }>();

const activeTab = ref<'stats' | 'abilities' | 'bonuses'>('stats');

const classInfo = computed(() => CHARACTER_CLASSES[props.character.className]);
const currentEnergy = computed(() => props.energy?.current ?? props.character.energy ?? GAME_CONFIG.BASE_ENERGY);
const maxEnergy = computed(() => props.energy?.max ?? props.character.maxEnergy ?? GAME_CONFIG.MAX_ENERGY);
const regenRate = computed(() => props.energy?.regenRate ?? 1);
const xpInfo = computed(() => calculateLevelProgress(props.character.level, props.character.experience));

const statBars = [
  { label: 'Force', key: 'strength', color: 'bg-red-500' },
  { label: 'Intelligence', key: 'intelligence', color: 'bg-blue-500' },
  { label: 'Chance', key: 'luck', color: 'bg-yellow-500' },
  { label: 'Charisme', key: 'charisma', color: 'bg-pink-500' },
  { label: 'Vitalité', key: 'vitality', color: 'bg-green-500' },
  { label: 'Dextérité', key: 'dexterity', color: 'bg-purple-500' },
] as const;

interface AbilityDef { name: string; description: string; cooldown: string; energyCost: number; passive?: boolean }

const abilitiesByClass: Record<string, AbilityDef[]> = {
  warrior: [
    { name: 'Rage de Combat', description: 'Bonus de 15% sur les gains après une série de pertes', cooldown: 'Auto', energyCost: 0, passive: true },
    { name: 'Frénésie de Bataille', description: 'Double les gains potentiels pendant 1 tour', cooldown: '15 min', energyCost: 30 },
  ],
  mage: [
    { name: 'Vision Arcanique', description: 'Révèle la prochaine carte au blackjack', cooldown: '10 min', energyCost: 20 },
    { name: 'Perception des Patterns', description: 'XP doublée pour les paris stratégiques', cooldown: 'Auto', energyCost: 0, passive: true },
  ],
  rogue: [
    { name: 'Tour de Passe-Passe', description: '15% de chance de récupérer la mise perdue', cooldown: 'Auto', energyCost: 0, passive: true },
    { name: 'Manipulation des Probabilités', description: 'Augmente les chances de gagner de 10%', cooldown: '8 min', energyCost: 15 },
  ],
  merchant: [
    { name: 'Sens de la Monnaie', description: '+20% sur tous les gains', cooldown: 'Auto', energyCost: 0, passive: true },
    { name: 'Affaire en Or', description: 'Garantit un gain minimum sur le prochain pari', cooldown: '20 min', energyCost: 40 },
  ],
  bard: [
    { name: 'Chanson Chanceuse', description: 'Bonus de chance pour tous les joueurs à la table', cooldown: '12 min', energyCost: 25 },
    { name: "Boost d'Harmonie", description: 'Bonus croissant basé sur le nombre de paris gagnants', cooldown: 'Auto', energyCost: 0, passive: true },
  ],
  paladin: [
    { name: 'Bénédiction Divine', description: 'Protège des pertes importantes (max 50 pièces)', cooldown: 'Auto', energyCost: 0, passive: true },
    { name: 'Protection Sacrée', description: 'Annule complètement la prochaine perte', cooldown: '30 min', energyCost: 50 },
  ],
};

const abilities = computed(() => abilitiesByClass[props.character.className] ?? []);
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-gradient-to-br from-gnome-dark to-gnome-blue border-2 border-gnome-gold/40 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
      <div class="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-4xl">{{ classInfo.emoji }}</div>
          <div>
            <h2 class="text-xl font-bold text-gnome-gold">{{ character.name }}</h2>
            <p class="text-sm text-white/70">{{ classInfo.name }} - Niveau {{ character.level }}</p>
          </div>
        </div>
        <button class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" @click="emit('close')">✕</button>
      </div>

      <div class="p-4 bg-white/5 border-b border-white/10">
        <div class="flex justify-between text-xs mb-2">
          <span class="text-white/70">Expérience</span>
          <span class="text-gnome-gold">{{ character.experience }} XP ({{ xpInfo.xpNeeded }} XP pour niveau {{ character.level + 1 }})</span>
        </div>
        <div class="h-3 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-gnome-gold to-yellow-400 transition-all duration-500" :style="{ width: `${xpInfo.xpProgress}%` }" />
        </div>
      </div>

      <div class="flex border-b border-white/10">
        <button v-for="tab in ['stats', 'abilities', 'bonuses'] as const" :key="tab" :class="['flex-1 py-3 text-sm font-medium transition-colors', activeTab === tab ? 'text-gnome-gold border-b-2 border-gnome-gold bg-white/5' : 'text-white/60 hover:text-white']" @click="activeTab = tab">
          {{ tab === 'stats' ? '📊 Statistiques' : tab === 'abilities' ? '⚡ Capacités' : '🎰 Bonus Casino' }}
        </button>
      </div>

      <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 240px)">
        <div v-if="activeTab === 'stats'" class="grid grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-bold text-gnome-gold mb-4">Stats de Base</h3>
            <div v-for="stat in statBars" :key="stat.key" class="mb-2">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-white/70">{{ stat.label }}</span>
                <span class="text-white">{{ character.stats[stat.key] }}</span>
              </div>
              <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                <div :class="['h-full transition-all duration-300', stat.color]" :style="{ width: `${Math.min(100, (character.stats[stat.key] / 30) * 100)}%` }" />
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gnome-gold mb-4">Ressources</h3>
            <div class="space-y-4">
              <div class="bg-white/5 rounded-lg p-4 border border-white/10">
                <div class="flex items-center gap-2 mb-2"><span class="text-2xl">⚡</span><span class="text-white font-medium">Énergie</span></div>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-bold text-gnome-gold">{{ Math.round(currentEnergy * 10) / 10 }}</span>
                  <span class="text-white/50">/ {{ maxEnergy }}</span>
                </div>
                <p class="text-xs text-white/50 mt-1">Régénère {{ regenRate }} point par minute</p>
              </div>
              <div class="bg-white/5 rounded-lg p-4 border border-white/10">
                <div class="flex items-center gap-2 mb-2"><span class="text-2xl">⭐</span><span class="text-white font-medium">Points de Stat</span></div>
                <span class="text-2xl font-bold text-gnome-gold">{{ Math.floor(character.level / 5) }}</span>
                <p class="text-xs text-white/50 mt-1">+1 point tous les 5 niveaux</p>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'abilities'" class="space-y-4">
          <h3 class="text-lg font-bold text-gnome-gold mb-4">Capacités de {{ classInfo.name }}</h3>
          <div v-for="ability in abilities" :key="ability.name" :class="['bg-white/5 rounded-lg p-4 border', ability.passive ? 'border-green-500/30' : 'border-blue-500/30']">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-bold text-white">{{ ability.name }}</h4>
                  <span v-if="ability.passive" class="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Passif</span>
                </div>
                <p class="text-sm text-white/70">{{ ability.description }}</p>
              </div>
              <div class="text-right text-xs">
                <div class="text-white/50 mb-1"><span class="text-blue-400">⏱</span> {{ ability.cooldown }}</div>
                <div class="text-white/50"><span class="text-yellow-400">⚡</span> {{ ability.energyCost }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <h3 class="text-lg font-bold text-gnome-gold mb-4">Bonus de Classe au Casino</h3>
          <p class="text-white/70 mb-4">{{ classInfo.description }}</p>
          <div class="grid gap-3">
            <div v-for="(bonus, i) in classInfo.bonuses" :key="i" class="bg-white/5 rounded-lg p-4 border border-white/10 flex items-start gap-3">
              <span class="text-gnome-gold text-xl">✦</span>
              <span class="text-white">{{ bonus }}</span>
            </div>
          </div>
          <div class="mt-6 pt-6 border-t border-white/10">
            <h4 class="text-md font-bold text-gnome-gold mb-3">Bonus par Niveau</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div v-for="[label, value] in [['Bonus de Chance', `+${Math.floor(character.level / 5)}`], ['Énergie Max', `+${character.level * 2}`], ['Bonus XP', `+${character.level}%`], ['Bonus Réputation', `+${Math.floor(character.level / 3)}%`]]" :key="label" class="bg-white/5 rounded-lg p-3 border border-white/10">
                <span class="text-white/50">{{ label }}:</span>
                <span class="ml-2 text-gnome-gold">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
