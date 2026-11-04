// Eksport projektu do diagram.json dla Wokwi (bez płytki stykowej — kable pin-do-pinu).
import { getBoard } from './boards.js';
import { PARTS } from './parts.js';
import { normWires, parseEnd } from './check.js';

export function toWokwi(project) {
  const board = getBoard(project.board);
  const skipped = [];
  let broken = false;
  if (!board || !board.wokwi) {
    return { diagram: null, skipped: [`Wokwi nie obsługuje płytki ${board ? board.name : project.board}.`], url: null };
  }
  const W = board.wokwi;
  const parts = [{ type: W.type, id: 'mcu', top: 0, left: 0, attrs: {} }];
  const ok = {};
  let i = 0;
  (project.parts || []).forEach((p) => {
    const def = PARTS[p.type];
    if (!def || !def.wokwi) {
      skipped.push(`${p.id} (${def ? def.name : p.type}) — nie ma w Wokwi, pominięte`);
      if (p.type !== 'resistor') broken = true;
      return;
    }
    if (def.wokwi.note) skipped.push(`${p.id}: ${def.wokwi.note}`);
    const col = i % 3;
    const row = Math.floor(i / 3);
    i++;
    parts.push({
      type: def.wokwi.type,
      id: p.id,
      top: -160 - row * 140,
      left: -40 + col * 170,
      attrs: def.wokwi.attrs ? def.wokwi.attrs(p) : {},
    });
    ok[p.id] = def.wokwi.pins;
  });
  let gndIdx = 0;
  const conn = [];
  normWires(project).forEach((w) => {
    const map = (e) => {
      const E = parseEnd(project, e);
      if (E.kind === 'board') return 'mcu:' + W.pin(E.pin, board.gnd.includes(E.pin) ? gndIdx++ : 0);
      if (E.kind === 'part' && ok[E.id] && ok[E.id][E.pin]) return E.id + ':' + ok[E.id][E.pin];
      return null;
    };
    const a = map(w.from);
    const b = map(w.to);
    if (a && b) conn.push([a, b, w.color || 'green', []]);
  });
  return {
    diagram: { version: 1, author: 'arduino-lab', editor: 'wokwi', parts, connections: conn, dependencies: {} },
    skipped,
    broken,
    url: W.newUrl,
  };
}
