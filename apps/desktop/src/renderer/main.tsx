import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
// Self-hosted fonts (bundled — no Google Fonts CDN, works fully offline).
// Family names registered as 'Manrope' / 'Inter' to match the CSS font stacks.
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import { AuthProvider } from './store/AuthContext';
import { ToastProvider } from './components/Toast';
import { App } from './App';
import './styles/global.css';
import './lib/sync';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
