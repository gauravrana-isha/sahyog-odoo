import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import { App } from './App';
import { PRProvider } from './hooks/usePR';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/karla';
import './styles/global.css';

// Register the Vaani PWA service worker (served from /pr/ so it can claim
// that scope — see the /pr/sw.js controller route).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/pr/sw.js', { scope: '/pr/' })
      .catch(() => { /* silent — PWA install just won't be offered */ });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <BrowserRouter basename="/pr/app">
        <PRProvider>
          <App />
        </PRProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);
