// Rysowanie schematu połączeń (SVG) i widoku płytki z zaznaczonymi pinami.
// Układ: płytka po lewej, części w kolumnach (wg odległości od płytki),
// zasilanie jako szyny: na górze 5V/3V3, na dole GND — jak szyny na płytce stykowej.
import { getBoard, pinRole } from './boards.js';
import { partDef, partTitle, colorPl } from './parts.js';
import { normWires, parseEnd } from './check.js';

const NAMED = {
  red: '#e5484d', black: '#1f2328', blue: '#2f6fe4', green: '#2fa84f', yellow: '#e3b505', orange: '#f08c2e',
  white: '#f2f2f2', grey: '#8b949e', gray: '#8b949e', purple: '#8e4ec6', violet: '#8e4ec6', brown: '#8a5a3b',
  limegreen: '#5cc44a', gold: '#d9a404', cyan: '#12a5b8', pink: '#e05595', teal: '#12867a',
};
const SIGNAL_PALETTE = ['#2f6fe4', '#2fa84f', '#d9a404', '#8e4ec6', '#f08c2e', '#12a5b8', '#e05595', '#12867a'];
const LED_FILL = { red: '#ff5a5f', green: '#3ecf6a', yellow: '#ffd23f', blue: '#4f8cff', white: '#f5f5f5', orange: '#ff9a3c' };

export function wireColor(c, fallback) {
  if (!c) return fallback;
  return NAMED[String(c).toLowerCase()] || c;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROW = 24;
const HEAD = 38;
const PW = 132;
const BW = 132;

export function buildModel(project) {
  const board = getBoard(project.board);
  const parts = project.parts || [];
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const raw = normWires(project);
  const wires = [];
  let sigIdx = 0;
  raw.forEach((w, i) => {
    const A = parseEnd(project, w.from);
    const B = parseEnd(project, w.to);
    if (A.kind === 'bad' || B.kind === 'bad') return;
    if (A.kind === 'part' && !byId[A.id]) return;
    if (B.kind === 'part' && !byId[B.id]) return;
    let kind = 'signal';
    let rail = null;
    const roleA = A.kind === 'board' ? pinRole(board, A.pin) : null;
    const roleB = B.kind === 'board' ? pinRole(board, B.pin) : null;
    let a = A, b = B;
    if (roleB && roleB !== 'signal' && A.kind === 'part') { a = B; b = A; }
    const roleP = a.kind === 'board' ? pinRole(board, a.pin) : null;
    if (roleP && roleP !== 'signal' && b.kind === 'part') {
      kind = 'power';
      rail = roleP === 'gnd' ? 'GND' : roleP.slice(7);
    }
    let def;
    if (kind === 'power') def = rail === 'GND' ? 'black' : rail === '5V' || rail === 'VIN' ? 'red' : 'orange';
    else def = SIGNAL_PALETTE[sigIdx++ % SIGNAL_PALETTE.length];
    wires.push({ i, a, b, kind, rail, color: wireColor(w.color, wireColor(def)), rawColor: w.color, note: w.note });
  });
  return { board, parts, byId, wires };
}

export function renderDiagram(project) {
  const m = buildModel(project);
  if (!m.board) return '<p>Nieznana płytka</p>';
  const { board, parts, wires } = m;

  // Głębokość części (BFS po kablach sygnałowych)
  const depth = { board: 0 };
  const adj = {};
  const link = (x, y) => { (adj[x] = adj[x] || new Set()).add(y); (adj[y] = adj[y] || new Set()).add(x); };
  wires.filter((w) => w.kind === 'signal').forEach((w) => link(w.a.kind === 'board' ? 'board' : w.a.id, w.b.kind === 'board' ? 'board' : w.b.id));
  const q = ['board'];
  while (q.length) {
    const x = q.shift();
    (adj[x] || []).forEach((y) => { if (depth[y] === undefined) { depth[y] = depth[x] + 1; q.push(y); } });
  }
  parts.forEach((p) => { if (depth[p.id] === undefined) depth[p.id] = 1; });
  const maxDepth = Math.max(1, ...parts.map((p) => depth[p.id]));

  // Rozmieszczenie pinów na częściach
  const info = {};
  parts.forEach((p) => {
    const d = partDef(p);
    info[p.id] = { p, d, left: [], right: [], top: [], bottom: [], free: [] };
  });
  const sidePins = {}; // key part:pin -> set of sides
  const markSide = (pid, pin, side) => { const k = pid + ':' + pin; (sidePins[k] = sidePins[k] || new Set()).add(side); };
  wires.forEach((w) => {
    if (w.kind === 'power') {
      markSide(w.b.id, w.b.pin, w.rail === 'GND' ? 'bottom' : 'top');
      return;
    }
    const ends = [w.a, w.b];
    ends.forEach((e, k) => {
      if (e.kind !== 'part') return;
      const o = ends[1 - k];
      const od = o.kind === 'board' ? 0 : depth[o.id];
      markSide(e.id, e.pin, od > depth[e.id] ? 'right' : 'left');
    });
  });
  parts.forEach((p) => {
    const I = info[p.id];
    I.d.pins.forEach((pin) => {
      const s = sidePins[p.id + ':' + pin.id];
      if (!s) { I.free.push(pin); return; }
      ['left', 'right', 'top', 'bottom'].forEach((side) => { if (s.has(side)) I[side].push(pin); });
    });
  });

  // Zasilania na szynach
  const supplies = [...new Set(wires.filter((w) => w.kind === 'power' && w.rail !== 'GND').map((w) => w.rail))].sort();
  const hasGnd = wires.some((w) => w.kind === 'power' && w.rail === 'GND');
  const railY = {};
  supplies.forEach((s, i) => { railY[s] = 18 + i * 18; });
  const contentTop = 18 + supplies.length * 18 + 30;

  // Płytka
  const boardSig = [...new Set(wires.filter((w) => w.kind === 'signal').flatMap((w) => [w.a, w.b]).filter((e) => e.kind === 'board').map((e) => e.pin))];
  const order = board.rows.flat();
  boardSig.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  const BX = 16;
  const BY = contentTop;
  const BH = HEAD + Math.max(1, boardSig.length) * ROW + 14;
  const pinPos = {}; // 'board:D13:right' -> {x,y}
  boardSig.forEach((pin, i) => { pinPos['board:' + pin + ':right'] = { x: BX + BW, y: BY + HEAD + i * ROW + ROW / 2 }; });

  // Pasy (lanes) między kolumnami
  const gapLanes = {};
  wires.filter((w) => w.kind === 'signal').forEach((w) => {
    const da = w.a.kind === 'board' ? 0 : depth[w.a.id];
    const db = w.b.kind === 'board' ? 0 : depth[w.b.id];
    w.gap = Math.max(da, db, 1);
    (gapLanes[w.gap] = gapLanes[w.gap] || []).push(w);
  });

  // Kolumny
  const colX = { 0: BX };
  const colW = { 0: BW };
  const pLanes = {};
  wires.filter((w) => w.kind === 'power').forEach((w) => { const c = depth[w.b.id]; (pLanes[c] = pLanes[c] || []).push(w); });
  const pW = (c) => ((pLanes[c] || []).length ? 10 + (pLanes[c] || []).length * 9 : 0);
  let x = BX + BW;
  const sizes = {};
  for (let c = 1; c <= maxDepth; c++) {
    const lanes = (gapLanes[c] || []).length;
    x += pW(c - 1) + 30 + lanes * 10;
    colX[c] = x;
    const colParts = parts.filter((p) => depth[p.id] === c);
    let w = PW;
    colParts.forEach((p) => {
      const I = info[p.id];
      const pw = Math.max(PW, Math.max(I.top.length, I.bottom.length) * 34 + 24, measure(partTitle(p)) + 26);
      sizes[p.id] = { w: pw, h: HEAD + Math.max(1, I.left.length + I.free.length, I.right.length) * ROW + 10 + (I.top.length ? 12 : 0) + (I.bottom.length ? 12 : 0) };
      w = Math.max(w, pw);
    });
    colW[c] = w;
    x += w;
  }
  const totalW = x + pW(maxDepth) + 24;

  // Pozycje części w kolumnach (wg wysokości tego, do czego się podpinają)
  const boxes = {};
  for (let c = 1; c <= maxDepth; c++) {
    const colParts = parts.filter((p) => depth[p.id] === c);
    const want = (p) => {
      const ys = wires.filter((w) => w.kind === 'signal' && ((w.a.kind === 'part' && w.a.id === p.id) || (w.b.kind === 'part' && w.b.id === p.id))).map((w) => {
        const o = w.a.kind === 'part' && w.a.id === p.id ? w.b : w.a;
        if (o.kind === 'board') return (pinPos['board:' + o.pin + ':right'] || {}).y;
        return boxes[o.id] ? boxes[o.id].y + sizes[o.id].h / 2 : undefined;
      }).filter((v) => v !== undefined);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : BY;
    };
    colParts.sort((a, b) => want(a) - want(b));
    let cy = contentTop;
    colParts.forEach((p) => {
      const s = sizes[p.id];
      const y = Math.max(cy, want(p) - HEAD - ROW / 2);
      boxes[p.id] = { x: colX[c], y, w: s.w, h: s.h };
      cy = y + s.h + 34;
    });
  }

  // Pozycje pinów części (kolumnami; lewe piny w kolejności tego, do czego idą — mniej krzyżowania)
  const otherY = (pid, pinId) => {
    const ys = wires.filter((w) => w.kind === 'signal').flatMap((w) => {
      const pairs = [[w.a, w.b], [w.b, w.a]];
      return pairs.filter(([e]) => e.kind === 'part' && e.id === pid && e.pin === pinId).map(([, o]) => {
        if (o.kind === 'board') return (pinPos['board:' + o.pin + ':right'] || {}).y;
        const r = pinPos[o.id + ':' + o.pin + ':right'] || pinPos[o.id + ':' + o.pin + ':left'];
        return r ? r.y : undefined;
      });
    }).filter((v) => v !== undefined);
    return ys.length ? Math.min(...ys) : Infinity;
  };
  [...parts].sort((a, b) => depth[a.id] - depth[b.id]).forEach((p) => {
    const I = info[p.id];
    const idx = (pin) => I.d.pins.indexOf(pin);
    I.left.sort((u, v) => otherY(p.id, u.id) - otherY(p.id, v.id) || idx(u) - idx(v));
    const B = boxes[p.id];
    const top0 = B.y + HEAD + (I.top.length ? 12 : 0);
    I.left.forEach((pin, i) => { pinPos[p.id + ':' + pin.id + ':left'] = { x: B.x, y: top0 + i * ROW + ROW / 2 }; });
    I.free.forEach((pin, i) => { pinPos[p.id + ':' + pin.id + ':free'] = { x: B.x, y: top0 + (I.left.length + i) * ROW + ROW / 2 }; });
    I.right.forEach((pin, i) => { pinPos[p.id + ':' + pin.id + ':right'] = { x: B.x + B.w, y: top0 + i * ROW + ROW / 2 }; });
    const spread = (arr, edgeY, side) => arr.forEach((pin, i) => {
      const step = B.w / (arr.length + 1);
      pinPos[p.id + ':' + pin.id + ':' + side] = { x: B.x + step * (i + 1), y: edgeY };
    });
    spread(I.top, B.y, 'top');
    spread(I.bottom, B.y + B.h, 'bottom');
  });

  const contentBottom = Math.max(BY + BH, ...parts.map((p) => boxes[p.id].y + boxes[p.id].h));
  const gndY = contentBottom + 34;
  const totalH = gndY + (hasGnd ? 26 : 0);

  // Zasilania płytki (zakładki na górze / dole płytki)
  const boardSup = {};
  supplies.forEach((s, i) => { boardSup[s] = { x: BX + 28 + i * 34, y: BY }; });
  const boardGnd = { x: BX + 28, y: BY + BH };

  // --- Rysowanie
  const out = [];
  out.push(`<svg class="diagram" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schemat połączeń">`);

  // szyny
  supplies.forEach((s) => {
    const y = railY[s];
    const col = wireColor(s === '3V3' ? 'orange' : 'red');
    out.push(`<line class="rail" x1="${BX}" y1="${y}" x2="${totalW - 12}" y2="${y}" stroke="${col}" />`);
    out.push(`<text class="rail-label" x="${totalW - 14}" y="${y - 5}" text-anchor="end">szyna ${s}</text>`);
  });
  if (hasGnd) {
    out.push(`<line class="rail rail-gnd" x1="${BX}" y1="${gndY}" x2="${totalW - 12}" y2="${gndY}" />`);
    out.push(`<text class="rail-label" x="${totalW - 14}" y="${gndY + 16}" text-anchor="end">szyna GND</text>`);
  }

  const wireSvg = [];
  const dot = (p, c) => wireSvg.push(`<circle class="wdot" cx="${p.x}" cy="${p.y}" r="3.2" fill="${c}"/>`);
  const path = (d, c, cls = '') => {
    if (String(c).toLowerCase() === NAMED.white) cls += ' is-white';
    wireSvg.push(`<path class="wire-case ${cls}" d="${d}"/>`);
    wireSvg.push(`<path class="wire ${cls}" d="${d}" stroke="${c}"/>`);
  };

  // kable zasilania
  const supUsed = new Set();
  Object.entries(pLanes).forEach(([c, list]) => {
    const right = colX[c] + colW[c];
    const pos = (w) => pinPos[w.b.id + ':' + w.b.pin + ':' + (w.rail === 'GND' ? 'bottom' : 'top')];
    const tops = list.filter((w) => w.rail !== 'GND' && pos(w)).sort((u, v) => pos(u).y - pos(v).y);
    const bots = list.filter((w) => w.rail === 'GND' && pos(w)).sort((u, v) => pos(v).y - pos(u).y);
    [...tops, ...bots].forEach((w, k) => {
      const p = pos(w);
      const lane = right + 10 + k * 9;
      const top = w.rail !== 'GND';
      const jy = top ? p.y - 13 : p.y + 13;
      const ry = top ? railY[w.rail] : gndY;
      path(`M${p.x} ${p.y} V${jy} H${lane} V${ry}`, w.color, top ? '' : 'is-gnd');
      dot(p, w.color); dot({ x: lane, y: ry }, w.color);
      supUsed.add(w.rail);
    });
  });
  supUsed.forEach((r) => {
    if (r === 'GND') {
      const c = wireColor('black');
      path(`M${boardGnd.x} ${boardGnd.y} V${gndY}`, c, 'is-gnd');
      dot(boardGnd, c); dot({ x: boardGnd.x, y: gndY }, c);
    } else {
      const bp = boardSup[r];
      const c = wireColor(r === '3V3' ? 'orange' : 'red');
      path(`M${bp.x} ${bp.y} V${railY[r]}`, c);
      dot(bp, c); dot({ x: bp.x, y: railY[r] }, c);
    }
  });

  // kable sygnałowe
  Object.entries(gapLanes).forEach(([gap, list0]) => {
    let list = list0;
    const g = +gap;
    const prevRight = colX[g - 1] + colW[g - 1] + pW(g - 1);
    const ends = (w) => {
      const pos = (e, other) => {
        if (e.kind === 'board') return pinPos['board:' + e.pin + ':right'];
        const od = other.kind === 'board' ? 0 : depth[other.id];
        const side = od > depth[e.id] ? 'right' : 'left';
        return pinPos[e.id + ':' + e.pin + ':' + side];
      };
      return [pos(w.a, w.b), pos(w.b, w.a)];
    };
    const y1 = (w) => (ends(w)[0] || { y: 0 }).y;
    const down = (w) => { const e = ends(w); return e[0] && e[1] && e[1].y >= e[0].y; };
    const dn = list.filter(down).sort((u, v) => y1(v) - y1(u));
    const up = list.filter((w) => !down(w)).sort((u, v) => y1(u) - y1(v));
    list = [...dn, ...up];
    list.forEach((w, li) => {
      const [p1, p2] = ends(w);
      if (!p1 || !p2) return;
      const lane = prevRight + 16 + li * 10;
      path(`M${p1.x} ${p1.y} H${lane} V${p2.y} H${p2.x}`, w.color);
      dot(p1, w.color); dot(p2, w.color);
    });
  });

  // płytka
  out.push(`<g class="board"><rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="8"/>`);
  out.push(`<text class="title" x="${BX + 10}" y="${BY + 20}">${esc(board.short)}</text>`);
  out.push(`<text class="sub" x="${BX + 10}" y="${BY + 32}">${board.logic} V logika</text>`);
  boardSig.forEach((pin) => {
    const p = pinPos['board:' + pin + ':right'];
    out.push(`<text class="pin" x="${p.x - 8}" y="${p.y + 4}" text-anchor="end">${esc(pin)}</text>`);
  });
  out.push('</g>');
  supplies.forEach((s) => {
    const bp = boardSup[s];
    out.push(`<text class="rail-label" x="${bp.x + 6}" y="${bp.y - 6}">${s}</text>`);
  });
  if (hasGnd) out.push(`<text class="rail-label" x="${boardGnd.x + 6}" y="${boardGnd.y + 14}">GND</text>`);

  // części
  parts.forEach((p) => {
    const I = info[p.id];
    const B = boxes[p.id];
    const unknown = !I.d.known;
    out.push(`<g class="part${unknown ? ' unknown' : ''}"><rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="7"/>`);
    const ty = B.y + (I.top.length ? 12 : 0);
    out.push(`<text class="title" x="${B.x + 10}" y="${ty + 19}">${esc(partTitle(p))}</text>`);
    out.push(`<text class="sub" x="${B.x + 10}" y="${ty + 31}">${esc(p.id)}${p.type === 'led' && p.color ? ' · ' + esc(colorPl(p.color)) : ''}</text>`);
    if (p.type === 'led') out.push(`<circle class="led-dot" cx="${B.x + B.w - 14}" cy="${ty + 15}" r="7" fill="${LED_FILL[p.color] || '#ff5a5f'}"/>`);
    I.left.forEach((pin) => { const q = pinPos[p.id + ':' + pin.id + ':left']; out.push(`<text class="pin" x="${q.x + 8}" y="${q.y + 4}">${esc(pin.id)}</text>`); });
    I.free.forEach((pin) => { const q = pinPos[p.id + ':' + pin.id + ':free']; out.push(`<text class="pin free" x="${q.x + 8}" y="${q.y + 4}">${esc(pin.id)} · wolny</text>`); });
    I.right.forEach((pin) => { const q = pinPos[p.id + ':' + pin.id + ':right']; out.push(`<text class="pin" x="${q.x - 8}" y="${q.y + 4}" text-anchor="end">${esc(pin.id)}</text>`); });
    I.top.forEach((pin) => { const q = pinPos[p.id + ':' + pin.id + ':top']; out.push(`<text class="pin small" x="${q.x}" y="${q.y + 12}" text-anchor="middle">${esc(pin.id)}</text>`); });
    I.bottom.forEach((pin) => { const q = pinPos[p.id + ':' + pin.id + ':bottom']; out.push(`<text class="pin small" x="${q.x}" y="${q.y - 5}" text-anchor="middle">${esc(pin.id)}</text>`); });
    out.push('</g>');
  });

  out.push(...wireSvg);
  out.push('</svg>');
  return out.join('');
}

function measure(s) {
  return String(s).length * 7.4;
}

// Widok płytki: dwa rzędy pinów, użyte zaznaczone kolorem kabla.
export function renderBoard(boardId, used = {}) {
  const board = getBoard(boardId);
  if (!board) return '';
  const n = Math.max(...board.rows.map((r) => r.length));
  const PX = 30;
  const W = 70 + n * PX + 20;
  const H = 150;
  const o = [`<svg class="boardview" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Płytka ${esc(board.name)}">`];
  o.push(`<rect class="pcb" x="40" y="22" width="${W - 50}" height="${H - 44}" rx="8"/>`);
  o.push(`<rect class="usb" x="6" y="${H / 2 - 18}" width="44" height="36" rx="4"/><text class="usb-t" x="28" y="${H / 2 + 4}" text-anchor="middle">USB</text>`);
  o.push(`<text class="bname" x="${(W + 40) / 2}" y="${H / 2 + 5}" text-anchor="middle">${esc(board.name)}</text>`);
  board.rows.forEach((row, r) => {
    const y = r === 0 ? 40 : H - 40;
    row.forEach((pin, i) => {
      const x = 70 + i * PX;
      const u = used[pin];
      o.push(`<circle class="hole${u ? ' used' : ''}" cx="${x}" cy="${y}" r="${u ? 8 : 6}" ${u ? `style="fill:${u}"` : ''}/>`);
      const ly = r === 0 ? y - 13 : y + 21;
      o.push(`<text class="plabel${u ? ' used' : ''}" x="${x}" y="${ly}" text-anchor="middle">${esc(pin)}</text>`);
    });
  });
  o.push('</svg>');
  return o.join('');
}

// Lista połączeń do tabeli / instrukcji
export function connectionRows(project) {
  const m = buildModel(project);
  return m.wires.map((w) => {
    const name = (e) => (e.kind === 'board' ? `${m.board.short} ${e.pin}` : `${partTitle(m.byId[e.id])} ${e.pin}`);
    return { from: name(w.a), to: name(w.b), color: w.color, colorName: w.rawColor || '', boardPin: w.a.kind === 'board' ? w.a.pin : w.b.kind === 'board' ? w.b.pin : null, kind: w.kind, rail: w.rail, note: w.note };
  });
}

export function usedBoardPins(project) {
  const m = buildModel(project);
  const used = {};
  m.wires.forEach((w) => [w.a, w.b].forEach((e) => {
    if (e.kind !== 'board') return;
    if (m.board.gnd.includes(e.pin)) {
      // zaznacz pierwszy GND
      used.GND = used.GND || w.color;
    } else used[e.pin] = used[e.pin] || w.color;
  }));
  return used;
}
