// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical production origin (used for sitemap, canonical URLs, OG tags).
  site: 'https://ulianapsy.com',
  integrations: [sitemap()],
  // Keep the original trailing-slash URL shape so old links stay valid.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
