// @ts-check
import { defineConfig } from 'astro/config';

// A fully static site (dist/). Set `site` to the real address once the domain is known,
// so canonical and social-preview links become absolute.
export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
