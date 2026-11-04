// Widok płytki stykowej: automatyczne rozmieszczenie części i kabli tak, jak składa się w realu.
// Płytka z szynami (830 pkt, 63 kolumny) albo bez szyn ("mini", 30 kolumn).
// Nano/ESP leży obok płytki (jak na labach) i łączy się kabelkami do dziurek.
import { getBoard, pinRole } from './boards.js';
import { partDef, partTitle, parseOhm, colorPl } from './parts.js';
import { normWires, parseEnd } from './check.js';
import { wireColor } from './diagram.js';

const TOP_ROWS = ['a', 'b', 'c', 'd', 'e'];
const BOT_ROWS = ['f', 'g', 'h', 'i', 'j'];
const SPAN = { resistor: 3, ldr: 1, led: 1, buzzer: 2 };
const TWO_LEG = new Set(['resistor', 'ldr', 'led', 'buzzer']);

export function layoutBreadboard(project) {
  const board = getBoard(project.board);
  if (!board || project.breadboard === false) return null;
  // domyślnie płytka BEZ szyn (taka jest najczęściej na labach); "rails" = z szynami +/−, "mini" = 30 kolumn bez szyn
  const kind = project.breadboard === 'rails' ? 'rails' : project.breadboard === 'mini' ? 'mini' : 'plain';
  const COLS = kind === 'mini' ? 30 : 63;
  const rails = kind === 'rails';
  const parts = project.parts || [];
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const wires = normWires(project).map((w) => ({ ...w, A: parseEnd(project, w.from), B: parseEnd(project, w.to) }))
    .filter((w) => w.A.kind !== 'bad' && w.B.kind !== 'bad');

  // --- sieci (union-find), GND płytki to jedna sieć
  const parent = {};
  const find = (x) => (parent[x] === undefined ? (parent[x] = x) : parent[x] === x ? x : (parent[x] = find(parent[x])));
  wires.forEach((w) => { parent[find(w.A.key)] = find(w.B.key); });
  const netOf = (k) => find(k);

  // kolor sieci = kolor kabla z projektu, który ją dotyka
  const netColor = {};
  wires.forEach((w) => { if (w.color) netColor[netOf(w.A.key)] = netColor[netOf(w.A.key)] || w.color; });

  // rola sieci: GND / zasilanie / sygnał
  const netRole = {};
  Object.keys(parent).forEach((k) => {
    if (!k.startsWith('board:')) return;
    const r = pinRole(board, k.slice(6));
    const n = netOf(k);
    if (r === 'gnd') netRole[n] = 'GND';
    else if (r.startsWith('supply:') && netRole[n] !== 'GND') netRole[n] = r.slice(7);
  });
  const supplies = [...new Set(Object.values(netRole).filter((r) => r !== 'GND'))];
  supplies.sort((a, b) => (a === '5V' ? -1 : b === '5V' ? 1 : a.localeCompare(b)));
  // szyny: góra + = pierwsze zasilanie, góra − = GND, dół + = drugie zasilanie, dół − = GND (mostek)
  const railFor = (role, half) => {
    if (!rails) return null;
    if (role === 'GND') return half === 'B' ? '-B' : '-T';
    const i = supplies.indexOf(role);
    if (i === 0) return supplies.length > 1 ? '+T' : half === 'B' ? '+B' : '+T';
    return '+B';
  };

  // --- stan płytki
  const owner = { T: new Array(COLS + 2).fill(null), B: new Array(COLS + 2).fill(null) };
  const used = {}; // 'T12' -> set of rows
  const stripNet = {}; // 'T12' -> net
  const legs = []; // {part, pin, hole:'e12', x:col, half}
  const takeRow = (half, col, forLeg, prefer) => {
    const k = half + col;
    used[k] = used[k] || new Set();
    const rows = half === 'T' ? TOP_ROWS : BOT_ROWS;
    const order = prefer ? [prefer, ...rows.filter((r) => r !== prefer)] : forLeg ? (half === 'T' ? [...rows].reverse() : rows) : half === 'T' ? rows : [...rows].reverse();
    const r = order.find((x) => !used[k].has(x));
    if (!r) return null;
    used[k].add(r);
    return r + col;
  };
  const freeCols = (half, from, n) => {
    for (let c = from; c + n - 1 <= COLS; c++) {
      let ok = true;
      for (let i = 0; i < n; i++) if (owner[half][c + i]) { ok = false; break; }
      if (ok) return c;
    }
    return null;
  };
  let cursor = { T: 2, B: 2 };
  const place = (half, col, partId, pin, prefer) => {
    owner[half][col] = owner[half][col] || partId;
    const net = netOf(partId + ':' + pin);
    stripNet[half + col] = net;
    const hole = takeRow(half, col, true, prefer);
    legs.push({ part: partId, pin, hole, col, half });
    return hole;
  };

  // kolejność: od płytki po kablach sygnałowych
  const order = [];
  const seen = new Set();
  const q = [];
  wires.forEach((w) => { [[w.A, w.B], [w.B, w.A]].forEach(([e, o]) => { if (e.kind === 'board' && o.kind === 'part' && !seen.has(o.id)) { seen.add(o.id); q.push(o.id); } }); });
  while (q.length) {
    const id = q.shift();
    order.push(id);
    wires.forEach((w) => { [[w.A, w.B], [w.B, w.A]].forEach(([e, o]) => { if (e.kind === 'part' && e.id === id && o.kind === 'part' && !seen.has(o.id)) { seen.add(o.id); q.push(o.id); } }); });
  }
  parts.forEach((p) => { if (!seen.has(p.id)) order.push(p.id); });

  // kolumna z tą samą siecią i wolnymi dziurkami — najbliższa miejsca, w którym teraz układamy
  const findNetStrip = (net, half) => Object.keys(stripNet)
    .filter((k) => stripNet[k] === net && k[0] === half && (used[k] ? used[k].size : 0) < 4)
    .sort((a, b) => Math.abs(+a.slice(1) - cursor.T) - Math.abs(+b.slice(1) - cursor.T))[0];
  const notes = [];

  order.forEach((id) => {
    const p = byId[id];
    const d = partDef(p);
    const pins = d.pins;
    if (TWO_LEG.has(p.type) && pins.length === 2) {
      const span = SPAN[p.type] || 1;
      const MAX = p.type === 'resistor' ? 5 : 2; // na ile kolumn da się rozsunąć nóżki (dioda: max 2, żeby nie wchodziła na inne)
      let placed = false;
      const s0 = findNetStrip(netOf(id + ':' + pins[0].id), 'T');
      const s1 = findNetStrip(netOf(id + ':' + pins[1].id), 'T');
      // obie nóżki w kolumny, gdzie już są ich sieci (np. dioda: A do rezystora, C do kolumny GND) — zero dodatkowych kabli
      if (s0 && s1 && s0 !== s1) {
        const c0 = +s0.slice(1), c1 = +s1.slice(1);
        const dist = Math.abs(c0 - c1);
        if (dist >= 1 && dist <= MAX) {
          place('T', c0, id, pins[0].id);
          place('T', c1, id, pins[1].id);
          placed = true;
        }
      }
      // jedna nóżka do istniejącej kolumny, druga do najbliższej wolnej
      for (let i = 0; i < 2 && !placed; i++) {
        const s = i === 0 ? s0 : s1;
        if (!s) continue;
        const c = +s.slice(1);
        const cand = [];
        for (let dx = span; dx <= MAX; dx++) cand.push(i === 0 ? c + dx : c - dx, i === 0 ? c - dx : c + dx);
        const other = cand.find((x) => x >= 1 && x <= COLS && !owner.T[x]);
        if (other == null) continue;
        place('T', c, id, pins[i].id);
        place('T', other, id, pins[1 - i].id);
        cursor.T = Math.max(cursor.T, other + 1);
        placed = true;
      }
      if (!placed) {
        const c = freeCols('T', cursor.T, span + 1);
        if (c == null) { notes.push(`Brak miejsca na „${partTitle(p)}”.`); return; }
        for (let x = c; x <= c + span; x++) owner.T[x] = id;
        place('T', c, id, pins[0].id);
        place('T', c + span, id, pins[1].id);
        cursor.T = c + span + 2;
      }
      return;
    }
    if (p.type === 'button') {
      const c = freeCols('T', cursor.T, 3);
      if (c == null || owner.B[c] || owner.B[c + 2]) { notes.push('Brak miejsca na przycisk.'); return; }
      for (let x = c; x <= c + 2; x++) { owner.T[x] = id; owner.B[x] = id; }
      place('T', c, id, pins[0].id, 'e');
      place('B', c + 2, id, pins[1].id, 'f');
      p._btn = c;
      cursor.T = c + 4;
      cursor.B = Math.max(cursor.B, c + 4);
      return;
    }
    // moduł: piny w rzędzie a, kolejne kolumny
    const n = pins.length;
    const c = freeCols('T', cursor.T + (cursor.T > 2 ? 1 : 0), n);
    if (c == null) { notes.push(`Brak miejsca na „${partTitle(p)}”.`); return; }
    pins.forEach((pin, i) => { owner.T[c + i] = id; place('T', c + i, id, pin.id, 'a'); });
    p._mod = c;
    cursor.T = c + n + 1;
  });

  // --- kable
  const jumpers = []; // {from:{hole|rail|pin}, to, color, label}
  const railUse = {};
  const railHole = (rail, near) => {
    railUse[rail] = railUse[rail] || new Set();
    for (let dx = 0; dx < COLS; dx++) for (const c of [near + dx, near - dx]) {
      if (c >= 1 && c <= COLS && !railUse[rail].has(c)) { railUse[rail].add(c); return { rail, col: c }; }
    }
    return { rail, col: near };
  };
  const nets = {};
  Object.keys(parent).forEach((k) => { const n = netOf(k); (nets[n] = nets[n] || new Set()).add(k); });
  const railsUsed = new Set();
  const boardWires = [];

  Object.entries(nets).forEach(([net, keys]) => {
    const strips = Object.keys(stripNet).filter((k) => stripNet[k] === net);
    const role = netRole[net];
    const bpins = [...keys].filter((k) => k.startsWith('board:')).map((k) => k.slice(6));
    const col = netColor[net];
    if (rails && role) {
      strips.forEach((s) => {
        const half = s[0];
        const c = +s.slice(1);
        const rail = railFor(role, half);
        const h = takeRow(half, c, false);
        if (!h) { notes.push(`Kolumna ${c} pełna.`); return; }
        jumpers.push({ a: { hole: h }, b: railHole(rail, c), color: col || (role === 'GND' ? 'black' : role === '3V3' ? 'orange' : 'red'), role });
        railsUsed.add(rail);
      });
      return;
    }
    if (!strips.length) return;
    strips.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === 'T' ? -1 : 1) || +a.slice(1) - +b.slice(1));
    // ile kolumn zasilić prosto z płytki: GND — tyle, ile płytka ma pinów GND; reszta przez mostki
    const gndPins = board.rows.flat().filter((x) => x === 'GND').length;
    const direct = role === 'GND' ? Math.min(gndPins, strips.length) : 1;
    // wybierz najbardziej oddalone kolumny jako zasilane z płytki, resztę dopnij do najbliższej
    const fed = role === 'GND' && direct > 1 ? [strips[0], strips[strips.length - 1]] : [strips[0]];
    const wireColorFor = col || (role === 'GND' ? 'black' : role ? 'red' : 'blue');
    fed.forEach((s, i) => {
      const pins2 = role === 'GND' ? ['GND'] : bpins;
      pins2.forEach((pin) => {
        const h = takeRow(s[0], +s.slice(1), false);
        if (h) boardWires.push({ pin, to: { hole: h }, color: wireColorFor });
      });
    });
    const linked = new Set(fed);
    strips.filter((s) => !linked.has(s)).forEach((s) => {
      const near = [...linked].sort((a, b) => Math.abs(+a.slice(1) - +s.slice(1)) - Math.abs(+b.slice(1) - +s.slice(1)) || (a[0] === s[0] ? -1 : 1))[0];
      const h0 = takeRow(near[0], +near.slice(1), false);
      const h1 = takeRow(s[0], +s.slice(1), false);
      if (h0 && h1) jumpers.push({ a: { hole: h0 }, b: { hole: h1 }, color: role === 'GND' ? 'black' : col || 'grey' });
      linked.add(s);
    });
  });

  // zasilanie szyn z płytki
  if (rails) {
    const bySupply = {};
    railsUsed.forEach((r) => (bySupply[r] = true));
    if (bySupply['-B'] && bySupply['-T']) jumpers.push({ a: railHole('-T', 1), b: railHole('-B', 1), color: 'black', role: 'GND', bridge: true });
    else if (bySupply['-B'] && !bySupply['-T']) { /* GND tylko na dole */ }
    const gndRail = bySupply['-T'] ? '-T' : bySupply['-B'] ? '-B' : null;
    if (gndRail) boardWires.push({ pin: 'GND', to: railHole(gndRail, 1), color: 'black' });
    supplies.forEach((s, i) => {
      const rTop = railFor(s, 'T');
      const rBot = railFor(s, 'B');
      const useTop = railsUsed.has(rTop);
      const useBot = rBot !== rTop && railsUsed.has(rBot);
      const pin = board.supplies[s] ? board.supplies[s][0] : s;
      const color = netColor[netOf('board:' + pin)] || (s === '3V3' ? 'orange' : 'red');
      if (useTop) boardWires.push({ pin, to: railHole(rTop, 1), color });
      if (useBot) {
        if (useTop && i === 0) jumpers.push({ a: railHole(rTop, 1), b: railHole(rBot, 1), color, bridge: true });
        else boardWires.push({ pin, to: railHole(rBot, 1), color });
      }
    });
  }

  const maxCol = Math.max(10, ...legs.map((l) => l.col), ...jumpers.flatMap((j) => [j.a, j.b]).map((e) => (e.hole ? +e.hole.slice(1) : e.col || 0)), ...boardWires.map((w) => (w.to.hole ? +w.to.hole.slice(1) : w.to.col)));
  return { kind, COLS, rails, legs, jumpers, boardWires, parts, byId, board, maxCol: Math.min(COLS, maxCol + 2), notes };
}

// --- rysowanie
const BAND = ['#111', '#8a4b1c', '#d42a2a', '#f07a17', '#f2c516', '#2c9c44', '#2f5fe0', '#7d3fbf', '#888', '#f4f4f4'];
function bands(ohm) {
  const s = String(Math.round(ohm));
  const d1 = +s[0], d2 = +(s[1] || 0);
  const mult = Math.max(0, s.length - 2);
  return [BAND[d1], BAND[d2], BAND[mult] || '#111'];
}
const LED = { red: '#ff4d4f', green: '#35d06a', yellow: '#ffd23f', blue: '#4f8cff', white: '#f5f5f5', orange: '#ff9a3c' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderBreadboard(L) {
  if (!L) return '';
  const P = 16;
  const hasMod = L.parts.some((p) => p._mod !== undefined);
  const X0 = 40;
  const cols = L.maxCol;
  const W = X0 + cols * P + 30;
  const top = 18 + (hasMod ? 84 : 22);
  const yRail = { '+T': top + 8, '-T': top + 8 + P };
  const yA = top + (L.rails ? 2 * P + 22 : 14);
  const rowY = {};
  TOP_ROWS.forEach((r, i) => (rowY[r] = yA + i * P));
  BOT_ROWS.forEach((r, i) => (rowY[r] = yA + 4 * P + 2.4 * P + i * P));
  const yJ = rowY.j;
  yRail['-B'] = yJ + 22 + 8;
  yRail['+B'] = yJ + 22 + 8 + P;
  const bbBottom = L.rails ? yRail['+B'] + 16 : yJ + 18;
  const cx = (c) => X0 + (c - 1) * P + P / 2;
  const hxy = (h) => (h.hole ? { x: cx(+h.hole.slice(1)), y: rowY[h.hole[0]] } : { x: cx(h.col), y: yRail[h.rail] });

  // płytka MCU pod spodem
  const b = L.board;
  const n = Math.max(...b.rows.map((r) => r.length));
  const mcuX = X0 + P;
  const mcuY = bbBottom + 90;
  const mcuW = n * P + 50;
  const mcuH = 74;
  const pinXY = {};
  b.rows.forEach((row, r) => row.forEach((pin, i) => {
    const pt = { x: mcuX + 40 + i * P + P / 2, y: r === 0 ? mcuY + 14 : mcuY + mcuH - 14 };
    if (!pinXY[pin]) pinXY[pin] = pt;
    else if (pin === 'GND') pinXY['GND#2'] = pt;
  }));
  const H = mcuY + mcuH + 30;
  const Wt = Math.max(W, mcuX + mcuW + 20);

  const o = [`<svg class="bb" viewBox="0 0 ${Wt} ${H}" width="${Wt}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Płytka stykowa">`];
  // ciało płytki
  o.push(`<rect class="bb-body" x="${X0 - 26}" y="${top - 6}" width="${cols * P + 46}" height="${bbBottom - top + 12}" rx="6"/>`);
  o.push(`<rect class="bb-gap" x="${X0 - 4}" y="${rowY.e + P * 0.62}" width="${cols * P + 8}" height="${P * 1.15}" rx="2"/>`);
  if (L.rails) {
    [['+T', 'rail-p'], ['-T', 'rail-n'], ['-B', 'rail-n'], ['+B', 'rail-p']].forEach(([r, cls]) => {
      const y = yRail[r];
      const ly = r.endsWith('T') ? (r[0] === '+' ? y - 9 : y + 9) : r[0] === '+' ? y + 9 : y - 9;
      o.push(`<line class="${cls}" x1="${X0}" y1="${ly}" x2="${X0 + cols * P}" y2="${ly}"/>`);
      o.push(`<text class="bb-rl ${cls}" x="${X0 - 14}" y="${y + 4}" text-anchor="middle">${r[0] === '+' ? '+' : '−'}</text>`);
      for (let c = 1; c <= cols; c++) if (c % 6 !== 0) o.push(`<rect class="bb-h" x="${cx(c) - 2.6}" y="${y - 2.6}" width="5.2" height="5.2" rx="1"/>`);
    });
  }
  [...TOP_ROWS, ...BOT_ROWS].forEach((r) => {
    o.push(`<text class="bb-lab" x="${X0 - 12}" y="${rowY[r] + 3.5}" text-anchor="middle">${r}</text>`);
    for (let c = 1; c <= cols; c++) o.push(`<rect class="bb-h" x="${cx(c) - 2.6}" y="${rowY[r] - 2.6}" width="5.2" height="5.2" rx="1"/>`);
  });
  for (let c = 1; c <= cols; c++) {
    if (c === 1 || c % 5 === 0) {
      o.push(`<text class="bb-num" x="${cx(c)}" y="${rowY.a - 9}" text-anchor="middle">${c}</text>`);
      o.push(`<text class="bb-num" x="${cx(c)}" y="${rowY.j + 15}" text-anchor="middle">${c}</text>`);
    }
  }

  // MCU
  o.push(`<rect class="bb-mcu" x="${mcuX}" y="${mcuY}" width="${mcuW}" height="${mcuH}" rx="6"/>`);
  o.push(`<rect class="bb-usb" x="${mcuX - 14}" y="${mcuY + mcuH / 2 - 12}" width="26" height="24" rx="3"/>`);
  o.push(`<text class="bb-mcu-t" x="${mcuX + mcuW / 2 + 10}" y="${mcuY + mcuH / 2 + 4}" text-anchor="middle">${esc(b.short)}</text>`);
  const usedPins = new Set(L.boardWires.map((w) => w.pin));
  b.rows.forEach((row, r) => row.forEach((pin, i) => {
    const x = mcuX + 40 + i * P + P / 2;
    const y = r === 0 ? mcuY + 14 : mcuY + mcuH - 14;
    o.push(`<circle class="bb-mpin" cx="${x}" cy="${y}" r="3.4"/>`);
    o.push(`<text class="bb-mlab${usedPins.has(pin) ? ' on' : ''}" x="${x}" y="${r === 0 ? y + 14 : y - 8}" text-anchor="middle">${esc(pin)}</text>`);
  }));

  // nóżki i części
  const legXY = {};
  L.legs.forEach((l) => { if (l.hole) legXY[l.part + ':' + l.pin] = hxy({ hole: l.hole }); });
  const partSvg = [];
  L.parts.forEach((p) => {
    const d = partDef(p);
    const pts = d.pins.map((x) => legXY[p.id + ':' + x.id]).filter(Boolean);
    if (!pts.length) return;
    if (p.type === 'resistor') {
      const [a, c] = pts;
      partSvg.push(`<line class="leg" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`);
      const mx = (a.x + c.x) / 2;
      partSvg.push(`<rect class="res" x="${mx - 14}" y="${a.y - 5}" width="28" height="10" rx="4"/>`);
      bands(parseOhm(p.value || '220')).forEach((col, i) => partSvg.push(`<rect x="${mx - 9 + i * 6}" y="${a.y - 5}" width="3" height="10" fill="${col}"/>`));
      partSvg.push(`<rect x="${mx + 9}" y="${a.y - 5}" width="2.5" height="10" fill="#c9a227"/>`);
    } else if (p.type === 'led') {
      const [a, c] = pts;
      const mx = (a.x + c.x) / 2;
      const by = a.y - 20;
      partSvg.push(`<line class="leg" x1="${a.x}" y1="${a.y}" x2="${a.x}" y2="${by + 4}"/><line class="leg" x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${by + 6}"/>`);
      partSvg.push(`<path class="ledb" d="M${mx - 8} ${by + 6} V${by - 3} A8 8 0 0 1 ${mx + 8} ${by - 3} V${by + 6} Z" fill="${LED[p.color] || LED.red}"/>`);
      partSvg.push(`<text class="leg-t" x="${a.x - 3}" y="${a.y - 5}" text-anchor="end">+</text>`);
    } else if (p.type === 'ldr') {
      const [a, c] = pts;
      const mx = (a.x + c.x) / 2;
      partSvg.push(`<line class="leg" x1="${a.x}" y1="${a.y}" x2="${mx}" y2="${a.y - 14}"/><line class="leg" x1="${c.x}" y1="${c.y}" x2="${mx}" y2="${a.y - 14}"/>`);
      partSvg.push(`<circle class="ldr" cx="${mx}" cy="${a.y - 18}" r="7"/><path d="M${mx - 4} ${a.y - 21} q2 3 4 0 q2 -3 4 0" class="ldr-z"/>`);
    } else if (p.type === 'buzzer') {
      const [a, c] = pts;
      const mx = (a.x + c.x) / 2;
      partSvg.push(`<circle class="buzz" cx="${mx}" cy="${a.y - 2}" r="13"/><circle cx="${mx}" cy="${a.y - 2}" r="3" class="buzz-h"/><text class="leg-t w" x="${a.x}" y="${a.y - 6}" text-anchor="middle">+</text>`);
    } else if (p.type === 'button') {
      const c = p._btn;
      const x = cx(c) - 4;
      const y = rowY.e - 4;
      const w = cx(c + 2) - cx(c) + 8;
      const h = rowY.f - rowY.e + 8;
      partSvg.push(`<rect class="btn-b" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><circle class="btn-c" cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2 - 5}"/>`);
    } else {
      // moduł: korpus nad płytką, nóżki do rzędu a
      const c0 = p._mod;
      const n = d.pins.length;
      const x1 = cx(c0) - 8;
      const x2 = cx(c0 + n - 1) + 8;
      const bw = Math.max(x2 - x1, 80);
      const bx = x1 - (bw - (x2 - x1)) / 2;
      const by = 14;
      const bh = top - 34;
      pts.forEach((pt) => partSvg.push(`<line class="leg" x1="${pt.x}" y1="${pt.y}" x2="${pt.x}" y2="${by + bh}"/>`));
      partSvg.push(`<rect class="mod" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="5"/>`);
      partSvg.push(`<text class="mod-t" x="${bx + bw / 2}" y="${by + 14}" text-anchor="middle">${esc(shortName(p))}</text>`);
      d.pins.forEach((pin, i) => { const tx = cx(c0 + i) + 3; const ty = by + bh - 4; partSvg.push(`<text class="mod-p" x="${tx}" y="${ty}" transform="rotate(-90 ${tx} ${ty})">${esc(pin.id)}</text>`); });
    }
  });

  // kable
  const wireSvg = [];
  const arc = (a, b2, color, lift) => {
    const dx = Math.abs(b2.x - a.x);
    const h = lift ?? Math.min(60, 10 + dx * 0.25);
    const my = Math.min(a.y, b2.y) - h;
    const d = `M${a.x} ${a.y} C${a.x} ${my} ${b2.x} ${my} ${b2.x} ${b2.y}`;
    const c = wireColor(color, '#2f6fe4');
    const white = c.toLowerCase() === '#f2f2f2';
    wireSvg.push(`<path class="j-case${white ? ' is-white' : ''}" d="${d}"/><path class="j" d="${d}" stroke="${c}"/>`);
    [a, b2].forEach((pt) => wireSvg.push(`<rect class="j-end" x="${pt.x - 3}" y="${pt.y - 3}" width="6" height="6" fill="${c}"/>`));
  };
  L.jumpers.forEach((j) => arc(hxy(j.a), hxy(j.b), j.color, j.bridge ? 0 : undefined));
  const gndSeen = { n: 0 };
  L.boardWires.forEach((w) => {
    let key = w.pin;
    if (w.pin === 'GND') key = gndSeen.n++ % 2 ? 'GND#2' : 'GND';
    const a = pinXY[key] || pinXY[w.pin];
    if (!a) return;
    const t = hxy(w.to);
    const c = wireColor(w.color, '#2f6fe4');
    const white = c.toLowerCase() === '#f2f2f2';
    const d = `M${a.x} ${a.y} C${a.x} ${a.y - 70} ${t.x} ${t.y + 90} ${t.x} ${t.y}`;
    wireSvg.push(`<path class="j-case${white ? ' is-white' : ''}" d="${d}"/><path class="j" d="${d}" stroke="${c}"/>`);
    wireSvg.push(`<rect class="j-end" x="${t.x - 3}" y="${t.y - 3}" width="6" height="6" fill="${c}"/><rect class="j-end" x="${a.x - 3.5}" y="${a.y - 3.5}" width="7" height="7" fill="${c}"/>`);
  });
  o.push(...partSvg, ...wireSvg, '</svg>');
  return o.join('');
}

function shortName(p) {
  const t = partTitle(p);
  return t.replace(/^Czujnik odległości /, '').replace(/^Czujnik /, '').replace(/ \(.*\)$/, '');
}

const RAIL_PL = { '+T': 'szyna + (góra)', '-T': 'szyna − (góra)', '+B': 'szyna + (dół)', '-B': 'szyna − (dół)' };
const COLOR_PL = { red: 'czerwony', black: 'czarny', blue: 'niebieski', green: 'zielony', yellow: 'żółty', orange: 'pomarańczowy', white: 'biały', grey: 'szary', gray: 'szary', purple: 'fioletowy', violet: 'fioletowy', brown: 'brązowy', limegreen: 'zielony', gold: 'żółty', cyan: 'turkusowy', pink: 'różowy' };

// Instrukcja „co gdzie wpiąć” wygenerowana z rozmieszczenia
export function breadboardSteps(L) {
  if (!L) return [];
  const s = [];
  const where = (e) => (e.hole ? `**${e.hole}**` : RAIL_PL[e.rail]);
  const done = new Set();
  L.parts.forEach((p) => {
    if (done.has(p.id)) return;
    done.add(p.id);
    const ls = L.legs.filter((l) => l.part === p.id && l.hole);
    if (!ls.length) return;
    const d = partDef(p);
    const lbl = (pin) => (p.type === 'led' ? (pin === 'A' ? 'dłuższa (+)' : 'krótsza (−)') : (d.pins.find((x) => x.id === pin) || {}).label || pin);
    if (p.type === 'resistor' || p.type === 'ldr') s.push(`${partTitle(p)}: nóżki w ${ls.map((l) => `**${l.hole}**`).join(' i ')}`);
    else s.push(`${partTitle(p)}: ${ls.map((l) => `${lbl(l.pin)} → **${l.hole}**`).join(', ')}`);
  });
  L.jumpers.forEach((j) => s.push(`Kabel ${COLOR_PL[j.color] || ''}: ${where(j.a)} → ${where(j.b)}`.replace('  ', ' ')));
  L.boardWires.forEach((w) => s.push(`Kabel ${COLOR_PL[w.color] || ''}: ${L.board.short} **${w.pin}** → ${where(w.to)}`.replace('  ', ' ')));
  return s;
}
