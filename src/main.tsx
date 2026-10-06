import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './lib/store';
import { FeedbackProvider } from './components/feedback';
// Fonts are bundled with the app (no third-party font requests), which also lets
// share-card PNG export embed them reliably.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/figtree';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/screens.css';
import './styles/share.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </StoreProvider>
  </StrictMode>,
);
