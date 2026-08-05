import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryBase = '/bluearchive-guess/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? repositoryBase : '/',
})
