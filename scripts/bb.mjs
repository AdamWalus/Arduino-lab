#!/usr/bin/env node
// Wypisuje rozmieszczenie na płytce stykowej dla projektu (to samo, co rysuje strona).
// Użycie: node scripts/bb.mjs <slug>
import { readFileSync } from 'node:fs';
import { layoutBreadboard, breadboardSteps } from '../js/breadboard.js';
const slug = process.argv[2];
if (!slug) { console.log('Użycie: node scripts/bb.mjs <slug>'); process.exit(1); }
const p = JSON.parse(readFileSync(new URL(`../projects/${slug}/project.json`, import.meta.url), 'utf8'));
const L = layoutBreadboard(p);
if (!L) { console.log('Brak widoku płytki (breadboard: false albo nieznana płytka).'); process.exit(0); }
breadboardSteps(L).forEach((s, i) => console.log(`${i + 1}. ${s.replace(/\*\*/g, '')}`));
if (L.notes.length) console.log('\nUwagi:', L.notes.join(' '));
