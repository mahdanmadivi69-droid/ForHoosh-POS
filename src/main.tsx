import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TenantThemeProvider } from './components/TenantThemeProvider';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <TenantThemeProvider>
      <App />
    </TenantThemeProvider>
  );
}


