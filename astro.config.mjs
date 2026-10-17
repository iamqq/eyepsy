// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical production origin (used for sitemap, canonical URLs, OG tags).
  site: 'https://www.eyepsy.ru',
  integrations: [sitemap()],
  // The original Bitrix site serves /ulyana/ and /anastasiya/ with a trailing
  // slash; keep that shape so old links and the sitemap stay valid.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
