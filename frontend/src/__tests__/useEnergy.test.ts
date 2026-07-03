import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

vi.mock('../services/api', () => ({
  apiService: {
    getEnergy: vi.fn(),
  },
}));

import { apiService } from '../services/api';
import { useEnergy } from '../composables/useEnergy';

// useEnergy relies on onMounted/onUnmounted, so it needs a real component
// instance to run inside — mount a minimal host component that exposes it.
function mountUseEnergy(refreshInterval = 1000, fetchInterval = 60000) {
  let exposed: ReturnType<typeof useEnergy>;
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useEnergy(refreshInterval, fetchInterval);
        return () => h('div');
      },
    })
  );
  return { wrapper, get state() { return exposed; } };
}

describe('useEnergy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches energy on mount and exposes it', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 80,
      max: 100,
      regenRate: 1,
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 20,
    });

    const { state } = mountUseEnergy();
    expect(state.isLoading.value).toBe(true);

    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(apiService.getEnergy).toHaveBeenCalledTimes(1);
    expect(state.energy.value).toMatchObject({ current: 80, max: 100 });
    expect(state.error.value).toBeNull();
  });

  it('sets an error message when the fetch fails', async () => {
    vi.mocked(apiService.getEnergy).mockRejectedValue(new Error('network down'));

    const { state } = mountUseEnergy();

    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    expect(state.error.value).toBe('Failed to fetch energy data');
  });

  it('interpolates current energy between fetches based on regen rate', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 50,
      max: 100,
      regenRate: 2, // 2 energy per minute
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 25,
    });

    const { state } = mountUseEnergy(1000, 60000);
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    // Advance 5 minutes of wall-clock time and let the 1s recalculation timer fire
    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(1000);

    // 50 + (5 * 2) = 60
    expect(state.energy.value?.current).toBe(60);
  });

  it('caps interpolated energy at the max', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 95,
      max: 100,
      regenRate: 5,
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 1,
    });

    const { state } = mountUseEnergy(1000, 60000);
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    // Way more time than needed to hit max
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(state.energy.value?.current).toBe(100);
    expect(state.energy.value?.minutesUntilFull).toBe(0);
  });

  it('falls back to the last known minutesUntilFull instead of Infinity when regenRate is 0', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 50,
      max: 100,
      regenRate: 0,
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 999,
    });

    const { state } = mountUseEnergy(1000, 60000);
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(1000);

    // No regen occurs, so current stays put and minutesUntilFull must not become Infinity.
    expect(state.energy.value?.current).toBe(50);
    expect(state.energy.value?.minutesUntilFull).toBe(999);
    expect(Number.isFinite(state.energy.value?.minutesUntilFull)).toBe(true);
  });

  it('refresh() re-fetches and toggles isLoading', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 10,
      max: 100,
      regenRate: 1,
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 90,
    });

    const { state } = mountUseEnergy();
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));
    expect(apiService.getEnergy).toHaveBeenCalledTimes(1);

    const refreshPromise = state.refresh();
    expect(state.isLoading.value).toBe(true);
    await refreshPromise;

    expect(apiService.getEnergy).toHaveBeenCalledTimes(2);
    expect(state.isLoading.value).toBe(false);
  });

  it('stops recalculating energy after the component unmounts', async () => {
    vi.mocked(apiService.getEnergy).mockResolvedValue({
      current: 50,
      max: 100,
      regenRate: 2,
      lastRegen: new Date().toISOString(),
      minutesUntilFull: 25,
    });

    const { wrapper, state } = mountUseEnergy(1000, 60000);
    await vi.waitFor(() => expect(state.isLoading.value).toBe(false));

    wrapper.unmount();
    await nextTick();

    const valueAtUnmount = state.energy.value?.current;

    vi.setSystemTime(Date.now() + 10 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(5000);

    // No more recalculation timers should be running post-unmount
    expect(state.energy.value?.current).toBe(valueAtUnmount);
  });
});
