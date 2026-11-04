// Kontrola projektu: zwarcia, dioda bez rezystora, złe napięcie, I2C, piny analogowe, magazyn.
// Działa w przeglądarce i w Node (scripts/check.mjs) — bez zależności.
import { getBoard, normPin, allPins, pinRole } from './boards.js';
import { partDef, partTitle, PARTS, parseOhm } from './parts.js';

export function normWires(project) {
  return (project.wires || []).map((w) => {
    if (Array.isArray(w)) return { from: w[0], to: w[1], color: w[2] || null, note: w[3] || '' };
    return { from: w.from, to: w.to, color: w.color || null, note: w.note || '' };
  });
}

// "board:D13" -> {kind:'board', pin:'D13'}; "led1:A" -> {kind:'part', id:'led1', pin:'A'}
export function parseEnd(project, s) {
  const board = getBoard(project.board);
  const str = String(s || '');
  const i = str.indexOf(':');
  if (i < 0) return { kind: 'bad', raw: str };
  const a = str.slice(0, i).trim();
  const b = str.slice(i + 1).trim();
  if (a === 'board' || a === project.board) {
    const pin = board ? normPin(board, b) : b;
    return { kind: 'board', pin, raw: str, key: 'board:' + (board && board.gnd.includes(pin) ? 'GND' : pin) };
  }
  return { kind: 'part', id: a, pin: b, raw: str, key: a + ':' + b };
}

export function analyze(project, inventory) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const board = getBoard(project.board);
  if (!board) {
    errors.push(`Nieznana płytka „${project.board}”. Dostępne: nano, uno, esp32, esp8266.`);
    return { errors, warnings, infos, status: 'error', nets: [] };
  }
  const boardPins = allPins(board);
  const parts = project.parts || [];
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  const wires = normWires(project);

  // --- Union-find
  const parent = {};
  const find = (x) => (parent[x] === undefined ? (parent[x] = x) : parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    parent[find(a)] = find(b);
  };

  const ends = [];
  wires.forEach((w, wi) => {
    const A = parseEnd(project, w.from);
    const B = parseEnd(project, w.to);
    let ok = true;
    for (const E of [A, B]) {
      if (E.kind === 'bad') {
        errors.push(`Kabel ${wi + 1}: zły zapis „${E.raw}” (ma być np. board:D13 albo led1:A).`);
        ok = false;
      } else if (E.kind === 'board' && !boardPins.has(E.pin)) {
        errors.push(`Kabel ${wi + 1}: ${board.short} nie ma pinu „${E.pin}”.`);
        ok = false;
      } else if (E.kind === 'part') {
        const p = byId[E.id];
        if (!p) {
          errors.push(`Kabel ${wi + 1}: nie ma części o id „${E.id}”.`);
          ok = false;
        } else if (!partDef(p).pins.some((x) => x.id === E.pin)) {
          errors.push(`Kabel ${wi + 1}: ${partTitle(p)} nie ma pinu „${E.pin}” (są: ${partDef(p).pins.map((x) => x.id).join(', ')}).`);
          ok = false;
        }
      }
    }
    if (ok) {
      union(A.key, B.key);
      ends.push(A, B);
    }
  });

  // --- Sieci
  const nets = {};
  const add = (k) => {
    const r = find(k);
    (nets[r] = nets[r] || new Set()).add(k);
  };
  ends.forEach((e) => add(e.key));
  const netOf = (k) => (parent[k] === undefined ? null : nets[find(k)]);
  const netHas = (net, pred) => !!net && [...net].some(pred);
  const isGnd = (k) => k === 'board:GND';
  const supplyOf = (k) => {
    if (!k.startsWith('board:')) return null;
    const r = pinRole(board, k.slice(6));
    return r.startsWith('supply:') ? r.slice(7) : null;
  };
  const volts = (s) => (s === '5V' ? 5 : s === '3V3' ? 3.3 : s === 'VIN' ? (board.logic === 5 ? 7 : 5) : null);

  // 1. Zwarcia zasilania
  Object.values(nets).forEach((net) => {
    const sups = new Set([...net].map(supplyOf).filter(Boolean));
    if (netHas(net, isGnd) && sups.size) errors.push(`ZWARCIE: ${[...sups].join('/')} połączone z GND (${[...net].join(', ')}).`);
    if (sups.size > 1) errors.push(`ZWARCIE: połączone ze sobą różne zasilania ${[...sups].join(' i ')}.`);
  });

  // 2. Części
  const usedTypes = {};
  parts.forEach((p) => {
    const d = partDef(p);
    const title = partTitle(p);
    const t = p.type === 'resistor' ? `resistor:${parseOhm(p.value || '220')}` : p.type;
    usedTypes[t] = (usedTypes[t] || 0) + 1;
    if (!PARTS[p.type]) infos.push(`„${title}”: nieznany typ „${p.type}” — rysuję jako ogólny moduł.`);
    const pinNets = Object.fromEntries(d.pins.map((x) => [x.id, netOf(p.id + ':' + x.id)]));
    const connected = d.pins.filter((x) => pinNets[x.id]);
    if (!connected.length) warnings.push(`„${title}” nie ma żadnego kabla.`);

    // VCC i GND modułu w jednej sieci
    const vccPins = d.pins.filter((x) => x.role === 'vcc');
    const gndPins = d.pins.filter((x) => x.role === 'gnd');
    vccPins.forEach((v) =>
      gndPins.forEach((g) => {
        if (pinNets[v.id] && pinNets[v.id] === pinNets[g.id]) errors.push(`ZWARCIE w „${title}”: ${v.id} połączone z ${g.id}.`);
      })
    );

    // Napięcie zasilania
    vccPins.forEach((v) => {
      const net = pinNets[v.id];
      if (!net) {
        warnings.push(`„${title}”: pin ${v.id} (zasilanie) nie jest podłączony.`);
        return;
      }
      const s = [...net].map(supplyOf).find(Boolean);
      if (!s) return;
      const V = volts(s);
      if (d.vcc && V > d.vcc[1] + 0.2) errors.push(`„${title}” jest na ${d.vcc[0] === d.vcc[1] ? d.vcc[0] : d.vcc[0] + '–' + d.vcc[1]} V, a dostaje ${s}. Przepnij na ${d.vcc[1] < 5 ? '3V3' : '5V'}.`);
      if (d.vcc && V < d.vcc[0] - 0.2) warnings.push(`„${title}” potrzebuje ${d.vcc[0]} V, a dostaje ${s} — może nie działać.`);
    });
    gndPins.forEach((g) => {
      if (!pinNets[g.id]) warnings.push(`„${title}”: pin ${g.id} (GND) nie jest podłączony.`);
      else if (!netHas(pinNets[g.id], isGnd)) warnings.push(`„${title}”: pin ${g.id} nie dochodzi do GND płytki.`);
    });

    // I2C
    d.pins.forEach((x) => {
      if (x.role !== 'sda' && x.role !== 'scl') return;
      const want = board.i2c[x.role.toUpperCase()];
      const net = pinNets[x.id];
      if (!net) errors.push(`„${title}”: ${x.id} (I2C) niepodłączone — ma iść do ${want}.`);
      else if (!net.has('board:' + want)) errors.push(`„${title}”: ${x.id} musi iść do ${want} (I2C w ${board.short}).`);
    });

    // Wyjście analogowe -> pin analogowy
    d.pins.forEach((x) => {
      if (x.role !== 'analog' || !pinNets[x.id]) return;
      const bp = [...pinNets[x.id]].filter((k) => k.startsWith('board:')).map((k) => k.slice(6));
      bp.forEach((pin) => {
        if (!board.analog.includes(pin)) errors.push(`„${title}”: ${x.id} daje sygnał analogowy, a ${pin} nie jest pinem analogowym (${board.analog.slice(0, 4).join(', ')}…).`);
        else if (board.adc2 && board.adc2.includes(pin)) infos.push(`${pin} w ESP32 to ADC2 — nie działa razem z WiFi. Bezpieczniej D32–D35.`);
      });
    });

    // Diody
    const ledPins = p.type === 'led' ? [['A', 'C']] : p.type === 'rgb-led' ? [['R', 'COM'], ['G', 'COM'], ['B', 'COM']] : [];
    ledPins.forEach(([a, c]) => {
      const na = pinNets[a];
      const nc = pinNets[c];
      if (!na && !nc) return;
      const hasRes = [na, nc].some((n) => netHas(n, (k) => byId[k.split(':')[0]] && byId[k.split(':')[0]].type === 'resistor'));
      if (!hasRes) errors.push(`„${title}”${p.type === 'rgb-led' ? ' (' + a + ')' : ''} bez rezystora — spalisz diodę albo pin. Dodaj 220 Ω.`);
      if (netHas(na, isGnd) || netHas(nc, (k) => !!supplyOf(k))) warnings.push(`„${title}” wygląda na odwrotnie wpiętą (A ma iść w stronę pinu/plusa, C do GND).`);
    });

    // Goły fotorezystor: dzielnik
    if (p.type === 'ldr') {
      const ok = d.pins.some((x) => netHas(pinNets[x.id], (k) => k.startsWith('board:') && board.analog.includes(k.slice(6))));
      if (!ok) warnings.push(`„${title}”: jedna nóżka powinna iść do pinu analogowego (z rezystorem 10 kΩ do GND).`);
    }

    // Logika 5V na płytce 3.3V
    if (board.logic < 5 && d.vcc && d.vcc[0] >= 5) {
      d.pins
        .filter((x) => x.role === 'signal' && pinNets[x.id] && netHas(pinNets[x.id], (k) => k.startsWith('board:')))
        .forEach((x) => warnings.push(`„${title}”: ${x.id} może podawać 5V na pin ${board.short} (3,3V). Daj dzielnik napięcia.`));
    }
  });

  // 3. Piny płytki
  const boardUse = {};
  wires.forEach((w) =>
    [w.from, w.to].forEach((e) => {
      const E = parseEnd(project, e);
      if (E.kind === 'board') boardUse[E.pin] = (boardUse[E.pin] || 0) + 1;
    })
  );
  Object.entries(boardUse).forEach(([pin, n]) => {
    if (board.serial.includes(pin)) warnings.push(`${pin} to pin od USB/Serial — może przeszkadzać przy wgrywaniu. Weź inny.`);
    if (board.strapping && board.strapping.includes(pin)) infos.push(`${pin} w ${board.short} wpływa na start płytki — jak nie chce się wgrać, odepnij go.`);
    const physical = board.gnd.includes(pin) ? board.rows.flat().filter((x) => x === 'GND').length : 1;
    if (n > physical) infos.push(`Do ${pin} idzie ${n} kabli, a na płytce ${physical === 1 ? 'jest jeden taki pin' : 'są ' + physical + ' takie piny'} — w realu wyprowadź ${pin} na kolumnę/szynę płytki stykowej i stamtąd rozdziel.`);
  });

  // 4. Magazyn
  const missing = [];
  if (inventory && Array.isArray(inventory.items)) {
    const have = {};
    inventory.items.forEach((it) => {
      const t = it.type === 'resistor' ? `resistor:${parseOhm(it.value || '0')}` : it.type;
      have[t] = (have[t] || 0) + (it.qty == null ? 99 : it.qty);
    });
    const boardKey = project.board;
    if (!have[boardKey]) missing.push({ type: boardKey, need: 1, have: 0, name: board.name });
    Object.entries(usedTypes).forEach(([t, need]) => {
      const h = have[t] || 0;
      if (h < need) {
        const base = t.split(':')[0];
        const name = t.startsWith('resistor:') ? `Rezystor ${t.split(':')[1]} Ω` : (PARTS[base] || {}).name || base;
        const sub = (PARTS[base] || {}).substitute;
        missing.push({ type: t, need, have: h, name, substitute: sub && have[sub] ? (PARTS[sub] || {}).name : null });
      }
    });
    missing.forEach((m) =>
      warnings.push(`Magazyn: brakuje „${m.name}” (potrzeba ${m.need}, masz ${m.have})${m.substitute ? ` — zamiennik: ${m.substitute}` : ''}.`)
    );
  }

  const status = errors.length ? 'error' : warnings.length ? 'warn' : 'ok';
  return { errors, warnings, infos, status, missing, nets: Object.values(nets).map((s) => [...s]) };
}

// Prosta walidacja struktury pliku projektu.
export function validateShape(p) {
  const e = [];
  ['slug', 'title', 'board', 'parts', 'wires', 'code'].forEach((k) => {
    if (p[k] === undefined) e.push(`Brak pola „${k}”.`);
  });
  if (p.slug && !/^[a-z0-9-]+$/.test(p.slug)) e.push('slug: tylko małe litery, cyfry i myślniki.');
  const ids = new Set();
  (p.parts || []).forEach((x) => {
    if (!x.id) e.push('Część bez id.');
    if (ids.has(x.id)) e.push(`Powtórzone id części „${x.id}”.`);
    ids.add(x.id);
    if (x.id === 'board') e.push('id „board” jest zarezerwowane dla płytki.');
  });
  return e;
}
