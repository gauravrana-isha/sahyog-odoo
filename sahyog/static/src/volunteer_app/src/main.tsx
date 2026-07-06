import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import { App } from './App';
import { CapabilitiesProvider } from './hooks/useCapabilities';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/karla';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <BrowserRouter basename="/sahyog/app">
        <CapabilitiesProvider>
          <App />
        </CapabilitiesProvider>
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sahyog/static/dist/volunteer_app/sw.js', {
      scope: '/sahyog/',
    }).catch(() => { /* silent */ });
  });
}
