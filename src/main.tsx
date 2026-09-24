import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';

async function prepareApp(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start({
        onUnhandledRequest: 'bypass'
      });
    } catch (err) {
      console.error('Failed to initialize MSW browser worker:', err);
    }
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  prepareApp().finally(() => {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
