// Локальная пересборка сайта из content.json (то же самое делает админка при публикации).
// Запуск из корня репозитория:  node tools/build.mjs        (или с --touch, чтобы обновить дату и сбросить кэш)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const R = require(path.join(root, 'assets', 'js', 'render.js'));
const file = path.join(root, 'content.json');
const c = JSON.parse(readFileSync(file, 'utf8'));
if (process.argv.includes('--touch')) { c.meta = c.meta || {}; c.meta.updated = new Date().toISOString(); writeFileSync(file, JSON.stringify(c, null, 1)); }
const files = R.renderAll(c);
for (const [f, s] of Object.entries(files)) { const p = path.join(root, f); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, s); }
console.log('Готово. Сгенерировано файлов:', Object.keys(files).length);
