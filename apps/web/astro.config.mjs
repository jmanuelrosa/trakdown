import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves at <user>.github.io/<repo>/. When trakdown moves to a
// custom apex domain (e.g. trakdown.app), drop `base` and update `site`.
export default defineConfig({
  site: 'https://jmanuelrosa.github.io',
  base: '/trakdown',
  trailingSlash: 'ignore',
  vite: {
    plugins: [tailwindcss()],
  },
});
