import { vi, beforeEach } from 'vitest';
import { config } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';

// Components (e.g. atoms/Input.vue -> PrimeVue's InputText) read $primevue
// from the app context, so every `mount()` in the test suite needs the
// PrimeVue plugin installed, matching main.ts's setup.
config.global.plugins.push([
  PrimeVue,
  { theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } },
]);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});
