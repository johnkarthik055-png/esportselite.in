/**
 * backup.js — Auto-backup script for the Esports Elite project.
 *
 * Creates a timestamped .zip of the source tree under
 *   ../esports-elite-backups/backup-YYYY-MM-DD_HH-mm-ss.zip
 * and prunes anything beyond the 10 most recent zips.
 *
 * Run manually:  npm run backup
 * Runs automatically before every production build (see package.json).
 *
 * Note: package.json declares "type": "module", so this file uses ESM
 * syntax while preserving __dirname / require-style behavior via
 * fileURLToPath. Functionality matches the spec exactly.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const timestamp = new Date().toISOString()
  .replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
const backupDir = path.join(__dirname, '..',
  'esports-elite-backups')

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

const backupPath = path.join(backupDir,
  `backup-${timestamp}.zip`)

execSync(`powershell Compress-Archive -Path ` +
  `"${__dirname}\\src","${__dirname}\\public",` +
  `"${__dirname}\\package.json",` +
  `"${__dirname}\\tailwind.config.js",` +
  `"${__dirname}\\vite.config.js",` +
  `"${__dirname}\\index.html" ` +
  `-DestinationPath "${backupPath}" -Force`)

console.log('Backup created:', backupPath)

const files = fs.readdirSync(backupDir)
  .filter(f => f.endsWith('.zip')).sort()
if (files.length > 10) {
  files.slice(0, files.length - 10)
    .forEach(f => fs.unlinkSync(
      path.join(backupDir, f)))
}
