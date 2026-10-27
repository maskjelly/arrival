import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App.tsx';
import Landing from './Landing.tsx';
import './style.css';
import './fabric.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{location.pathname === '/' ? <Landing /> : <App />}</React.StrictMode>,
);
