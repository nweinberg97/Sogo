import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './lib/store';
import { FeedbackProvider } from './components/feedback';
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
