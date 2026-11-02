import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const isGitHubPages = process.env.GITHUB_PAGES === 'true';
  const basePath = isGitHubPages ? '/ForHoosh-POS/' : '/';

  // Determine active tenant branding
  const tenantId = process.env.VITE_TENANT_ID || (mode === 'modendo' ? 'tenant-modendo-01' : 'tenant-100hich-01');
  const isModendo = tenantId === 'tenant-modendo-01';

  const appName = isModendo
    ? 'Modendo POS — سامانه کافه بردگیم و گیمینگ مودندو'
    : 'Cafe OS — سامانه صندوق کافه ۱۰۰هیچ';
  const shortName = isModendo ? 'Modendo POS' : '100 Hich POS';
  const description = isModendo
    ? 'سامانه مدیریت سفارشات، میزهای بازی، اتاق کنسول PS5 و حسابداری کافه مودندو'
    : 'سامانه ابری و هوشمند مدیریت صندوق، شیفت، رسپی و گزارشات مالی کافه ۱۰۰هیچ';
  const themeColor = isModendo ? '#0B0D11' : '#0F223D';
  const bgColor = isModendo ? '#0B0D11' : '#121417';

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_TENANT_ID': JSON.stringify(tenantId),
    },
    build: {
      outDir: isModendo ? 'dist/modendo' : 'dist/100hich',
      emptyOutDir: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: basePath,
          name: appName,
          short_name: shortName,
          description: description,
          theme_color: themeColor,
          background_color: bgColor,
          display: 'standalone',
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
