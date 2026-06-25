import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Baked in at build time so the footer's "Last updated" always reflects the
  // actual Netlify build/deploy, with no manual step needed on every push.
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
