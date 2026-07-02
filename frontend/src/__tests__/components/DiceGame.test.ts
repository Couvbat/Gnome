import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DiceGame from '../../components/games/DiceGame.vue';

vi.mock('../../services/api', () => ({
  apiService: { getCurrentUser: vi.fn(), rollDice: vi.fn() },
}));

import { apiService } from '../../services/api';

async function selectPrediction(wrapper: ReturnType<typeof mount>, num: number) {
  const buttons = wrapper.findAll('button');
  const target = buttons.find((b) => b.text().startsWith(String(num)));
  await target!.trigger('click');
}

describe('DiceGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 500 } as any);
    vi.stubGlobal('alert', vi.fn());
    vi.useFakeTimers();
  });

  it('fetches the balance on mount', async () => {
    const wrapper = mount(DiceGame);
    await flushPromises();

    expect(apiService.getCurrentUser).toHaveBeenCalled();
    expect(wrapper.text()).toContain('CHOISISSEZ UNE PRÉDICTION');
  });

  it('disables rolling until a prediction is selected', async () => {
    const wrapper = mount(DiceGame);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('button.py-6').attributes('disabled')).toBeDefined();

    await selectPrediction(wrapper, 7);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('button.py-6').attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain('LANCER LES DÉS');
  });

  it('rolls, calls the backend with the selected prediction, and reports a win', async () => {
    vi.mocked(apiService.rollDice).mockResolvedValue({
      result: { dice: [3, 4], outcome: 'win', payout: 60, payoutMultiplier: 6, xpGained: 10, total: 7 },
    } as any);

    const wrapper = mount(DiceGame);
    await flushPromises();
    await selectPrediction(wrapper, 7);
    await wrapper.vm.$nextTick();

    await wrapper.find('button.py-6').trigger('click');
    expect(wrapper.text()).toContain('LANCEMENT');

    await vi.advanceTimersByTimeAsync(1100); // 10 ticks @ 100ms
    await flushPromises();

    expect(apiService.rollDice).toHaveBeenCalledWith(10, 7);
    expect(wrapper.text()).toContain('Gagné!');
    expect(wrapper.text()).toContain('6x');
  });

  it('reports a loss with the rolled total', async () => {
    vi.mocked(apiService.rollDice).mockResolvedValue({
      result: { dice: [1, 2], outcome: 'lose', xpGained: 2, total: 3 },
    } as any);

    const wrapper = mount(DiceGame);
    await flushPromises();
    await selectPrediction(wrapper, 7);
    await wrapper.vm.$nextTick();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1100);
    await flushPromises();

    expect(wrapper.text()).toContain('Perdu!');
    expect(wrapper.text()).toContain('3');
  });

  it('refreshes the balance and emits balanceChange after rolling', async () => {
    vi.mocked(apiService.rollDice).mockResolvedValue({
      result: { dice: [5, 5], outcome: 'win', payout: 120, payoutMultiplier: 12, xpGained: 20, total: 10 },
    } as any);
    vi.mocked(apiService.getCurrentUser)
      .mockResolvedValueOnce({ id: 'me', coins: 500 } as any)
      .mockResolvedValueOnce({ id: 'me', coins: 610 } as any);

    const wrapper = mount(DiceGame);
    await flushPromises();
    await selectPrediction(wrapper, 10);
    await wrapper.vm.$nextTick();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1100);
    await flushPromises();

    expect(wrapper.text()).toContain('610');
    expect(wrapper.emitted('balanceChange')).toBeTruthy();
  });

  it('shows an alert and stops rolling when the backend call fails', async () => {
    vi.mocked(apiService.rollDice).mockRejectedValue(new Error('Bet too low'));

    const wrapper = mount(DiceGame);
    await flushPromises();
    await selectPrediction(wrapper, 7);
    await wrapper.vm.$nextTick();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1100);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(alert).toHaveBeenCalledWith('Bet too low');
    expect(wrapper.text()).not.toContain('LANCEMENT');
  });

  it('emits leave when the header button is clicked', async () => {
    const wrapper = mount(DiceGame);
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('leave')).toBeTruthy();
  });
});
