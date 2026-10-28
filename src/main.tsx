import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App.tsx';
import Landing from './Landing.tsx';
import './style.css';
import Onboarding from './Onboarding.tsx';
import '@fontsource-variable/manrope';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {location.pathname === '/' ? (
      <Landing />
    ) : location.pathname === '/start' ? (
      <Onboarding />
    ) : location.pathname === '/login' ? (
      <Onboarding signIn />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
