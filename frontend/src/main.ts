import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import App from './App.vue';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const app = createApp(App);
    app.use(PrimeVue, {
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.app-dark' },
      },
    });
    app.mount('#root');
    console.log('[Main] Vue app mounted successfully');
  } catch (error) {
    console.error('[Main] Failed to mount Vue app:', error);
    rootElement.innerHTML = `
      <div style="color: white; padding: 20px; background: #1a1a2e; min-height: 100vh;">
        <h1>Erreur de chargement</h1>
        <p>L'application n'a pas pu démarrer: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        <pre style="background: #333; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : ''}</pre>
      </div>
    `;
  }
} else {
  console.error('[Main] Root element not found');
}
