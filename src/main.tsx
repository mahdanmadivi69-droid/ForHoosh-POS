import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TenantThemeProvider } from './components/TenantThemeProvider';
import { getActiveTenant } from './config/tenantConfig';
import './index.css';

/**
 * Pre-React tenant theme bootstrap (Modendo Gaming Lounge Edition, v0.16):
 * applies dataset.theme / data-tenant / body theme class before first paint
 * so the Emerald Liquid Glass tokens never flash the 100 HICH carmine defaults.
 */
function bootstrapTenantTheme(): void {
  if (typeof document === 'undefined') return;
  const tenant = getActiveTenant();
  const root = document.documentElement;
  root.dataset.theme = tenant.id; // 'modendo' | '100hich'
  root.setAttribute(
    'data-tenant',
    tenant.id === 'modendo' ? 'tenant-modendo-01' : 'tenant-100hich-01'
  );
  if (document.body) {
    document.body.classList.remove('theme-100hich', 'theme-modendo');
    document.body.classList.add(`theme-${tenant.id}`);
  }
  document.title = `${tenant.brandNameEn} | ${tenant.brandNameFa}`;
}

bootstrapTenantTheme();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <TenantThemeProvider>
      <App />
    </TenantThemeProvider>
  );
}
