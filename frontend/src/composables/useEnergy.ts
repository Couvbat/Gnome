import { ref, onMounted, onUnmounted } from 'vue';
import { apiService } from '../services/api';

export interface EnergyInfo {
  current: number;
  max: number;
  regenRate: number;
  lastRegen: string;
  minutesUntilFull: number;
}

export function useEnergy(refreshInterval = 1000, fetchInterval = 60000) {
  const energy = ref<EnergyInfo | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  let baseEnergy: EnergyInfo | null = null;
  let lastFetchTime = 0;
  let fetchTimer: ReturnType<typeof setInterval> | null = null;
  let calcTimer: ReturnType<typeof setInterval> | null = null;

  const fetchEnergy = async () => {
    try {
      const data = await apiService.getEnergy();
      baseEnergy = data;
      lastFetchTime = Date.now();
      energy.value = data;
      error.value = null;
    } catch {
      error.value = 'Failed to fetch energy data';
    } finally {
      isLoading.value = false;
    }
  };

  const calculateCurrentEnergy = () => {
    if (!baseEnergy) return;
    const minutesSinceFetch = (Date.now() - lastFetchTime) / 60000;
    const regenSinceFetch = minutesSinceFetch * baseEnergy.regenRate;
    const newCurrent = Math.min(baseEnergy.max, baseEnergy.current + regenSinceFetch);
    energy.value = {
      ...baseEnergy,
      current: Math.round(newCurrent * 10) / 10,
      minutesUntilFull:
        newCurrent >= baseEnergy.max
          ? 0
          // regenRate <= 0 means "not regenerating" - dividing by it produced
          // Infinity. Fall back to the last value the backend itself reported
          // rather than presenting an infinite/nonsensical estimate.
          : baseEnergy.regenRate > 0
            ? Math.ceil((baseEnergy.max - newCurrent) / baseEnergy.regenRate)
            : baseEnergy.minutesUntilFull,
    };
  };

  const refresh = async () => {
    isLoading.value = true;
    await fetchEnergy();
  };

  onMounted(() => {
    fetchEnergy();
    fetchTimer = setInterval(fetchEnergy, fetchInterval);
    calcTimer = setInterval(calculateCurrentEnergy, refreshInterval);
  });

  onUnmounted(() => {
    if (fetchTimer) clearInterval(fetchTimer);
    if (calcTimer) clearInterval(calcTimer);
  });

  return { energy, isLoading, error, refresh };
}

export default useEnergy;
