import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function copyPublicSkipDesktopIni(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.toLowerCase() === 'desktop.ini') continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyPublicSkipDesktopIni(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-public-skip-desktop-ini',
      closeBundle() {
        copyPublicSkipDesktopIni(path.resolve('public'), path.resolve('dist'))
      }
    }
  ],
  build: {
    copyPublicDir: false,
  },
  base: process.env.NODE_ENV === 'production' ? '/homework-app/' : '/',
})
