import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAMES_DIR = path.join(ROOT, 'site', 'games');

export function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(GAMES_DIR, 'games.json'), 'utf8'));
}

export function gameDirs() {
  return fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
