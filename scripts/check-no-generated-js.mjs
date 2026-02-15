#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_ROOT = path.resolve('src/renderer/src/simulation')

async function collectJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const found = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      found.push(...(await collectJsFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      found.push(fullPath)
    }
  }

  return found
}

const jsFiles = await collectJsFiles(SOURCE_ROOT)

if (jsFiles.length > 0) {
  console.error('Generated JavaScript files are not allowed in src/renderer/src/simulation. Use TypeScript source files and emit build artifacts to out/ or dist/.')
  for (const file of jsFiles.sort()) {
    console.error(` - ${path.relative(process.cwd(), file)}`)
  }
  process.exit(1)
}

console.log('No generated JavaScript files found in src/renderer/src/simulation.')
