import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // For GitHub Pages project sites, set base to /<repo>/
  // If you use a custom domain (CNAME) or user/organization site, base can remain '/'
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const isCI = process.env.CI === 'true'
  const base = isCI && repo ? `/${repo}/` : '/'

  return {
    plugins: [react()],
    base,
  }
})
