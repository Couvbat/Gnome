import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CharacterCreation from '../../components/CharacterCreation.vue';

vi.mock('../../services/api', () => ({
  apiService: { createCharacter: vi.fn(), deleteCharacter: vi.fn() },
}));

import { apiService } from '../../services/api';

async function selectClass(wrapper: ReturnType<typeof mount>, className: string) {
  const buttons = wrapper.findAll('button');
  const target = buttons.find((b) => b.text().includes(className));
  await target!.trigger('click');
}

describe('CharacterCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.deleteCharacter).mockResolvedValue(undefined as any);
  });

  it('renders all six character classes', () => {
    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });

    // Class display names are in French (CHARACTER_CLASSES in constants/index.ts)
    expect(wrapper.text()).toContain('Guerrier');
    expect(wrapper.text()).toContain('Mage');
    expect(wrapper.text()).toContain('Voleur');
    expect(wrapper.text()).toContain('Marchand');
    expect(wrapper.text()).toContain('Barde');
    expect(wrapper.text()).toContain('Paladin');
  });

  it('keeps the submit button disabled until a name is entered', async () => {
    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });
    await selectClass(wrapper, 'Guerrier');

    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeDefined();
    expect(apiService.createCharacter).not.toHaveBeenCalled();
  });

  it('requires a class before creating a character', async () => {
    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });
    await wrapper.find('#character-name').setValue('Aragorn');

    // The submit button stays disabled without a class selected, but the
    // handler itself should also refuse to proceed if invoked directly.
    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeDefined();
    expect(apiService.createCharacter).not.toHaveBeenCalled();
  });

  it('rejects a name shorter than 3 characters', async () => {
    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });
    await wrapper.find('#character-name').setValue('Al');
    await selectClass(wrapper, 'Guerrier');

    await wrapper.find('button.btn-primary').trigger('click');

    expect(wrapper.text()).toContain('entre 3 et 20 caractères');
    expect(apiService.createCharacter).not.toHaveBeenCalled();
  });

  it('creates a character with a valid name and class, and emits characterCreated', async () => {
    const createdCharacter = { id: 'char-1', name: 'Aragorn', className: 'warrior' };
    vi.mocked(apiService.createCharacter).mockResolvedValue(createdCharacter as any);

    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });
    await wrapper.find('#character-name').setValue('Aragorn');
    await selectClass(wrapper, 'Guerrier');

    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(apiService.createCharacter).toHaveBeenCalledWith({ name: 'Aragorn', class: 'warrior' });
    expect(wrapper.emitted('characterCreated')).toEqual([[createdCharacter]]);
  });

  it('shows an error and re-enables the form when creation fails', async () => {
    vi.mocked(apiService.createCharacter).mockRejectedValue(new Error('Name already taken'));

    const wrapper = mount(CharacterCreation, { props: { userId: 'user-1' } });
    await wrapper.find('#character-name').setValue('Aragorn');
    await selectClass(wrapper, 'Guerrier');

    await wrapper.find('button.btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Erreur lors de la création');
    expect(wrapper.emitted('characterCreated')).toBeFalsy();
    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeUndefined();
  });
});
