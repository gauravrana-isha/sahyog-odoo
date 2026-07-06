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
