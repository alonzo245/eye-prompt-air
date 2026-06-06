import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { logger } from './utils/logger';

logger.connection('=== Eye Prompt App Starting ===');
logger.connection('React app initializing...');

const container = document.getElementById('root');
if (!container) {
  logger.connectionError('Root element not found');
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

logger.connectionSuccess('React app rendered successfully');
