#!/usr/bin/env node
// Sprawdza wszystkie projekty i buduje projects/index.json.
// Użycie: node scripts/check.mjs           (sprawdź + zapisz index.json, nadaj numery nowym projektom)
//         node scripts/check.mjs --ci      (jak wyżej, ale niczego nie zapisuje do projektów, tylko index)
// Kod wyjścia 1 = jest błąd (zwarcie, dioda bez rezystora, zły plik...). Wtedy NIE wypychaj.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, validateShape } from '../js/check.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ci = process.argv.includes('--ci');
const dir = join(root, 'projects');
const inventory = JSON.parse(readFileSync(join(root, 'data/inventory.json'), 'utf8'));
const red = (s) => `\x1b[31m${s}\x1b[0m`, yel = (s) => `\x1b[33m${s}\x1b[0m`, grn = (s) => `\x1b[32m${s}\x1b[0m`;

const slugs = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort();
const loaded = [];
let failed = false;

for (const slug of slugs) {
  const f = join(dir, slug, 'project.json');
  if (!existsSync(f)) { console.log(red(`✗ ${slug}: brak project.json`)); failed = true; continue; }
  let p;
  try { p = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.log(red(`✗ ${slug}: zły JSON — ${e.message}`)); failed = true; continue; }
  const shapeInput = { ...p, code: p.code ?? (p.codeFile ? '' : undefined) };
  const shape = validateShape(shapeInput);
  if (p.slug !== slug) shape.push(`slug „${p.slug}” ≠ nazwa folderu „${slug}”.`);
  if (p.codeFile && !existsSync(join(dir, slug, p.codeFile))) shape.push(`Brak pliku z kodem ${p.codeFile}.`);
  (p.images || []).forEach((im) => { if (!existsSync(join(dir, slug, im.src))) shape.push(`Brak zdjęcia ${im.src}.`); });
  (p.report?.results || []).forEach((r) => { if (r.image && !existsSync(join(dir, slug, r.image))) shape.push(`Brak zdjęcia ${r.image}.`); });
  if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) shape.push('date ma być RRRR-MM-DD.');
  const res = shape.length ? { errors: [], warnings: [], infos: [], status: 'error', missing: [] } : analyze(p, inventory);
  const errs = [...shape, ...res.errors];
  const bad = errs.length && !p.allowErrors;
  if (bad) failed = true;
  const head = errs.length ? red('✗') : res.warnings.length ? yel('!') : grn('✓');
  console.log(`${head} ${slug}${p.n ? ` (#${p.n})` : ''}`);
  errs.forEach((e) => console.log(red('   błąd: ' + e)));
  res.warnings.forEach((e) => console.log(yel('   uwaga: ' + e)));
  res.infos.forEach((e) => console.log('   info: ' + e));
  loaded.push({ slug, f, p, status: errs.length ? 'error' : res.status, missing: (res.missing || []).map((m) => m.name) });
}

// Numery (krótkie linki …/#N) — stałe, nadawane raz.
let max = Math.max(0, ...loaded.map((x) => x.p.n || 0));
const seen = new Set();
loaded
  .sort((a, b) => (a.p.date || '').localeCompare(b.p.date || '') || a.slug.localeCompare(b.slug))
  .forEach((x) => {
    if (!x.p.n || seen.has(x.p.n)) {
      if (ci) { console.log(red(`✗ ${x.slug}: brak numeru „n” — uruchom node scripts/check.mjs lokalnie`)); failed = true; return; }
      x.p.n = ++max;
      writeFileSync(x.f, JSON.stringify(x.p, null, 2) + '\n');
      console.log(`  nadano numer #${x.p.n} → ${x.slug}`);
    }
    seen.add(x.p.n);
  });

const index = loaded
  .map(({ p, status, missing }) => ({ n: p.n, slug: p.slug, title: p.title, board: p.board, date: p.date, summary: p.summary || '', tags: p.tags || [], status, missing }))
  .sort((a, b) => a.n - b.n);
writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`\n${index.length} projektów → projects/index.json`);
if (failed) { console.log(red('\nSą błędy. Popraw zanim wypchniesz.')); process.exit(1); }
console.log(grn('Wszystko OK.'));
