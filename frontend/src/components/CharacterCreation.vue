<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Character, CharacterClass } from '../types';
import { apiService } from '../services/api';
import { CHARACTER_CLASSES } from '../constants';

defineProps<{ userId: string }>();
const emit = defineEmits<{ characterCreated: [character: Character] }>();

type ClassKey = CharacterClass;

const name = ref('');
const selectedClass = ref<ClassKey | null>(null);
const isCreating = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  const isDevMode =
    import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.MODE === 'development';
  if (isDevMode) {
    try { await apiService.deleteCharacter(); }
    catch { /* ignore */ }
  }
});

async function handleCreate() {
  if (!name.value.trim()) { error.value = 'Veuillez entrer un nom pour votre personnage'; return; }
  if (!selectedClass.value) { error.value = 'Veuillez sélectionner une classe'; return; }
  if (name.value.length < 3 || name.value.length > 20) { error.value = 'Le nom doit contenir entre 3 et 20 caractères'; return; }

  isCreating.value = true;
  error.value = null;
  try {
    const character = await apiService.createCharacter({ name: name.value.trim(), class: selectedClass.value });
    emit('characterCreated', character);
  } catch (e) {
    console.error('Character creation error:', e);
    error.value = 'Erreur lors de la création du personnage. Veuillez réessayer.';
    isCreating.value = false;
  }
}

const classEntries = Object.entries(CHARACTER_CLASSES) as [ClassKey, typeof CHARACTER_CLASSES[ClassKey]][];
</script>

<template>
  <div class="w-full max-w-7xl mx-auto px-4 py-8">
    <div class="text-center mb-12">
      <h2 class="text-4xl md:text-5xl font-bold text-gnome-gold drop-shadow-lg mb-4">
        🎭 Création de Personnage
      </h2>
      <p class="text-base md:text-lg text-white/90 leading-relaxed max-w-3xl mx-auto">
        Bienvenue à La Taverne Dorée du Gnome ! Avant de pouvoir jouer au casino,
        vous devez créer votre personnage RPG. Chaque classe offre des bonus uniques
        pour les différents jeux.
      </p>
    </div>

    <div class="mb-10 max-w-md mx-auto">
      <label for="character-name" class="block mb-3 text-sm font-medium text-white/90">
        Nom du personnage :
      </label>
      <input
        id="character-name"
        v-model="name"
        type="text"
        placeholder="Entrez un nom (3-20 caractères)"
        :maxlength="20"
        :disabled="isCreating"
        class="input-field w-full"
      />
    </div>

    <h3 class="text-2xl font-bold text-gnome-gold text-center mb-8">Sélectionnez votre classe :</h3>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
      <button
        v-for="[classKey, classInfo] in classEntries"
        :key="classKey"
        type="button"
        :disabled="isCreating"
        :class="[
          'bg-white/5 backdrop-blur-sm border-2 rounded-2xl p-6 shadow-xl group relative overflow-hidden transition-all duration-300 text-left',
          selectedClass === classKey
            ? 'border-gnome-gold shadow-2xl shadow-gnome-gold/30 scale-105'
            : 'border-white/20 hover:border-gnome-gold/60 hover:scale-[1.02]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ]"
        @click="!isCreating && (selectedClass = classKey)"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-gnome-gold/10 to-gnome-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div class="relative z-10 space-y-3">
          <div class="text-5xl text-center mb-2 transform group-hover:scale-110 transition-transform duration-300">
            {{ classInfo.emoji }}
          </div>
          <h4 class="text-xl font-bold text-gnome-gold text-center">{{ classInfo.name }}</h4>
          <p class="text-sm text-white/90 leading-relaxed min-h-[2.5rem]">{{ classInfo.description }}</p>
          <div class="pt-3 border-t border-white/20">
            <ul class="space-y-1.5 text-xs text-white/90">
              <li v-for="(bonus, i) in classInfo.bonuses" :key="i" class="flex items-start gap-2">
                <span class="text-gnome-gold mt-0.5 flex-shrink-0">•</span>
                <span class="flex-1">{{ bonus }}</span>
              </li>
            </ul>
          </div>
          <div v-if="selectedClass === classKey" class="absolute top-4 right-4 w-8 h-8 bg-gnome-gold rounded-full flex items-center justify-center shadow-lg">
            <span class="text-gnome-dark text-lg font-bold">✓</span>
          </div>
        </div>
      </button>
    </div>

    <div v-if="error" class="px-6 py-4 mb-6 bg-red-500/15 border-2 border-red-500/40 rounded-xl text-red-400 text-center font-medium max-w-2xl mx-auto">
      {{ error }}
    </div>

    <div class="text-center">
      <button
        :disabled="isCreating || !name.trim() || !selectedClass"
        class="btn-primary px-10 py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        @click="handleCreate"
      >
        {{ isCreating ? 'Création en cours...' : '✨ Créer mon personnage' }}
      </button>
    </div>
  </div>
</template>
