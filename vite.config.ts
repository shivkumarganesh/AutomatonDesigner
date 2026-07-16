import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
  // so asset URLs need that repo-name prefix - but only for the Pages build
  // (GITHUB_PAGES is set by .github/workflows/deploy-pages.yml), so a plain
  // `npm run dev`/`npm run build` for another host (Vercel, Netlify, ...)
  // still serves correctly from the root.
  base: process.env.GITHUB_PAGES ? '/AutomatonDesigner/' : '/',
})
