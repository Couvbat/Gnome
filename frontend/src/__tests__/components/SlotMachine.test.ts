import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SlotMachine from '../../components/games/SlotMachine.vue';

vi.mock('../../services/api', () => ({
  apiService: { getCurrentUser: vi.fn(), spinSlots: vi.fn() },
}));

import { apiService } from '../../services/api';

describe('SlotMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 500 } as any);
    vi.stubGlobal('alert', vi.fn());
    vi.useFakeTimers();
  });

  it('fetches the balance on mount', async () => {
    const wrapper = mount(SlotMachine);
    await flushPromises();

    expect(apiService.getCurrentUser).toHaveBeenCalled();
    expect(wrapper.text()).toContain('TOURNER');
  });

  it('disables the spin button when the bet exceeds the balance', async () => {
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({ id: 'me', coins: 5 } as any);
    const wrapper = mount(SlotMachine);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('FONDS INSUFFISANTS');
    expect(wrapper.find('button.py-6').attributes('disabled')).toBeDefined();
  });

  it('spins the reels, calls the backend, and reports a win', async () => {
    vi.mocked(apiService.spinSlots).mockResolvedValue({
      result: { reels: ['7️⃣', '7️⃣', '7️⃣'], outcome: 'win', payout: 100, xpGained: 15 },
    } as any);

    const wrapper = mount(SlotMachine);
    await flushPromises();

    await wrapper.find('button.py-6').trigger('click');
    expect(wrapper.text()).toContain('ROTATION');

    // 15 animation ticks at 100ms each before the backend call fires
    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();

    expect(apiService.spinSlots).toHaveBeenCalledWith(10, 'dragon');
    expect(wrapper.text()).toContain('Gagné!');
    expect(wrapper.text()).toContain('+100');
  });

  it('reports a jackpot outcome distinctly from a regular win', async () => {
    vi.mocked(apiService.spinSlots).mockResolvedValue({
      result: { reels: ['7️⃣', '7️⃣', '7️⃣'], outcome: 'jackpot', payout: 5000, xpGained: 50 },
    } as any);

    const wrapper = mount(SlotMachine);
    await flushPromises();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();

    expect(wrapper.text()).toContain('Jackpot!');
  });

  it('reports a loss outcome', async () => {
    vi.mocked(apiService.spinSlots).mockResolvedValue({
      result: { reels: ['🍒', '🍋', '🍊'], outcome: 'lose', xpGained: 2 },
    } as any);

    const wrapper = mount(SlotMachine);
    await flushPromises();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();

    expect(wrapper.text()).toContain('Perdu!');
  });

  it('refetches the balance and does not double-spin while already spinning', async () => {
    vi.mocked(apiService.spinSlots).mockResolvedValue({
      result: { reels: ['🍒', '🍒', '🍒'], outcome: 'win', payout: 20, xpGained: 5 },
    } as any);
    vi.mocked(apiService.getCurrentUser)
      .mockResolvedValueOnce({ id: 'me', coins: 500 } as any)
      .mockResolvedValueOnce({ id: 'me', coins: 510 } as any);

    const wrapper = mount(SlotMachine);
    await flushPromises();

    const spinBtn = wrapper.find('button.py-6');
    await spinBtn.trigger('click');
    await spinBtn.trigger('click'); // ignored: already spinning

    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();

    expect(apiService.spinSlots).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('510');
    expect(wrapper.emitted('balanceChange')).toBeTruthy();
  });

  it('shows an alert and stops spinning when the backend call fails', async () => {
    vi.mocked(apiService.spinSlots).mockRejectedValue(new Error('Insufficient funds'));

    const wrapper = mount(SlotMachine);
    await flushPromises();
    await wrapper.find('button.py-6').trigger('click');
    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(alert).toHaveBeenCalledWith('Insufficient funds');
    expect(wrapper.text()).toContain('TOURNER');
  });

  it('emits leave when the header button is clicked', async () => {
    const wrapper = mount(SlotMachine);
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('leave')).toBeTruthy();
  });
});
