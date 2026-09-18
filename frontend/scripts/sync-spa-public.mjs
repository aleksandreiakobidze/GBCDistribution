import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(root, '..', 'backend', 'public', 'app')
const publicDir = path.join(root, '..', 'backend', 'public')

const names = [
  'assets',
  'icons',
  'favicon.svg',
  'registerSW.js',
  'sw.js',
  'manifest.webmanifest',
  'manifest.json',
  'icons.svg',
]

if (!fs.existsSync(appDir)) {
  throw new Error(`SPA build missing: ${appDir}`)
}

for (const name of names) {
  const src = path.join(appDir, name)
  const dest = path.join(publicDir, name)
  if (!fs.existsSync(src)) {
    continue
  }
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(src, dest, { recursive: true })
}

for (const file of fs.readdirSync(appDir)) {
  if (!file.startsWith('workbox-') || !file.endsWith('.js')) {
    continue
  }
  fs.cpSync(path.join(appDir, file), path.join(publicDir, file), { force: true })
}

console.log('Synced SPA assets to backend/public for same-origin / and /api')
