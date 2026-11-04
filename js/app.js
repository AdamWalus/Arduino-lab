import { BOARDS, getBoard, pinLocation, pinTags } from './boards.js';
import { PARTS, partTitle, partDef } from './parts.js';
import { analyze } from './check.js';
import { renderDiagram, renderBoard, connectionRows, usedBoardPins } from './diagram.js';
import { toWokwi } from './wokwi.js';
import { layoutBreadboard, renderBreadboard, breadboardSteps } from './breadboard.js';
import { renderReport } from './report.js';
import { esc, md, highlight, copy, toast, store, getJSON, getText, sha256, fmtDate } from './util.js';

const view = document.getElementById('view');
const cache = { projects: {}, index: null, inventory: null, settings: null };

// ---------- dane
async function loadIndex() {
  if (!cache.index) cache.index = await getJSON('projects/index.json').catch(() => []);
  return cache.index;
}
async function loadInventory() {
  if (!cache.inventory) cache.inventory = await getJSON('data/inventory.json').catch(() => ({ items: [] }));
  return cache.inventory;
}
async function loadSettings() {
  if (!cache.settings) cache.settings = await getJSON('data/settings.json').catch(() => ({}));
  return { ...cache.settings, ...store.get('settings', {}) };
}
async function loadProject(slug) {
  if (cache.projects[slug]) return cache.projects[slug];
  const base = `projects/${slug}/`;
  const p = await getJSON(base + 'project.json');
  if (p.codeFile) p.code = await getText(base + p.codeFile).catch(() => '// nie udało się wczytać ' + p.codeFile);
  p._base = base;
  cache.projects[slug] = p;
  return p;
}

// ---------- router
// Krótkie linki: …/#7 = projekt nr 7, …/#n = najnowszy
async function shortLink(n) {
  const list = await loadIndex();
  const hit = n === 'n' ? list.reduce((a, b) => ((b.n || 0) > (a ? a.n || 0 : -1) ? b : a), null) : list.find((x) => String(x.n) === n);
  if (!hit) throw new Error(`Nie ma projektu nr ${n}.`);
  history.replaceState(null, '', '#/p/' + hit.slug);
  return projectView(hit.slug);
}

const routes = [
  [/^#?\/?$/, home],
  [/^#\/?(\d+|n)$/, shortLink],
  [/^#\/p\/([\w-]+)$/, projectView],
  [/^#\/lab\/([\w-]+)$/, labView],
  [/^#\/raport\/([\w-]+)$/, reportView],
  [/^#\/sciagawka(?:\/([\w-]+))?$/, cheatView],
  [/^#\/magazyn$/, inventoryView],
  [/^#\/nowe$/, newTaskView],
  [/^#\/ustawienia$/, settingsView],
];

async function route() {
  const h = location.hash || '#/';
  document.body.classList.toggle('is-report', h.startsWith('#/raport/'));
  document.title = 'Arduino Lab';
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      view.innerHTML = '<div class="loading">Ładuję…</div>';
      try {
        await fn(...m.slice(1));
      } catch (e) {
        const msg = /project\.json: 404/.test(e.message) ? 'Nie ma takiego projektu.' : e.message;
        view.innerHTML = `<section class="card error-card"><h2>Nie udało się</h2><p>${esc(msg)}</p><a class="btn" href="#/">Wróć do projektów</a></section>`;
      }
      setActiveNav(h);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

function setActiveNav(h) {
  document.querySelectorAll('.nav a').forEach((a) => {
    const t = a.getAttribute('href');
    a.classList.toggle('active', t === '#/' ? h === '#/' || h.startsWith('#/p/') || h.startsWith('#/lab/') : h.startsWith(t));
  });
}

const BADGE = { ok: ['ok', 'OK'], warn: ['warn', 'Uwagi'], error: ['err', 'Błąd'] };
const badge = (s) => (BADGE[s] ? `<span class="badge ${BADGE[s][0]}">${BADGE[s][1]}</span>` : '');

// ---------- widoki
async function home() {
  const list = (await loadIndex()).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.slug > a.slug ? 1 : -1));
  const q = store.get('search', '');
  view.innerHTML = `
    <section class="hero">
      <h1>Projekty</h1>
      <p class="muted">${list.length} ${list.length === 1 ? 'projekt' : 'projektów'} · schemat, kod i instrukcja do każdego</p>
      <a class="btn primary wide" href="#/nowe">+ Nowe zadanie</a>
    </section>
    <input class="search" type="search" placeholder="Szukaj (np. dioda, esp32, czujnik)" value="${esc(q)}" aria-label="Szukaj">
    <div class="plist"></div>`;
  const box = view.querySelector('.plist');
  const draw = (q) => {
    const s = q.trim().toLowerCase();
    const f = list.filter((p) => !s || [p.title, p.summary, p.board, ...(p.tags || [])].join(' ').toLowerCase().includes(s));
    box.innerHTML = f.length
      ? f.map((p) => `
        <a class="pcard" href="#/p/${p.slug}">
          <div class="pcard-top"><span class="num">#${p.n ?? ''}</span><span class="chip">${esc((getBoard(p.board) || {}).short || p.board)}</span>${badge(p.status)}<span class="date">${fmtDate(p.date)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.summary || '')}</p>
        </a>`).join('')
      : '<p class="muted center">Nic nie znaleziono.</p>';
  };
  draw(q);
  view.querySelector('.search').addEventListener('input', (e) => { store.set('search', e.target.value); draw(e.target.value); });
}

async function projectView(slug) {
  const [p, inv, idx] = await Promise.all([loadProject(slug), loadInventory(), loadIndex()]);
  if (p.n == null) { const e = idx.find((x) => x.slug === slug); if (e) p.n = e.n; }
  const board = getBoard(p.board);
  const chk = analyze(p, inv);
  const rows = connectionRows(p);
  const wk = toWokwi(p);
  const labDone = store.get('lab2:' + slug, []).length;
  const Lb = layoutBreadboard(p);
  const stepsN = Lb ? breadboardSteps(Lb).length + 2 : (p.steps || []).length;

  view.innerHTML = `
    <a class="back" href="#/">← Projekty</a>
    <header class="phead">
      <div class="chips">${p.n != null ? `<button class="chip num-chip" data-short title="Kopiuj krótki link">#${p.n} 🔗</button>` : ''}<span class="chip">${esc(board ? board.name : p.board)}</span><span class="chip ghost">${fmtDate(p.date)}</span>${badge(chk.status)}</div>
      <h1>${esc(p.title)}</h1>
      ${p.summary ? `<p class="lead">${md(p.summary)}</p>` : ''}
      <div class="actions">
        <a class="btn primary" href="#/lab/${slug}">▶ Tryb lab${stepsN ? ` <small>${labDone}/${stepsN}</small>` : ''}</a>
        <a class="btn" href="#/raport/${slug}">Sprawozdanie PDF</a>
        <a class="btn" href="#wokwi" data-jump="wokwi">Wokwi</a>
      </div>
    </header>

    ${checkPanel(chk)}

    <section class="card">
      <div class="card-h"><h2>Schemat</h2><button class="btn small" data-zoom>Powiększ</button></div>
      <p class="hint">Na górze szyny zasilania (5V/3V3), na dole GND — tak jak szyny na płytce stykowej.</p>
      <div class="scroll diagram-wrap">${renderDiagram(p)}</div>
    </section>

    ${bbSection(p)}

    <section class="card">
      <h2>Które piny na płytce</h2>
      <div class="scroll">${renderBoard(p.board, usedBoardPins(p))}</div>
      ${board ? `<p class="hint">W Arduino IDE: ${esc(board.ide)}</p>` : ''}
    </section>

    <section class="card">
      <h2>Połączenia</h2>
      <div class="scroll"><table class="conn">
        <thead><tr><th></th><th>Skąd</th><th>Dokąd</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><span class="sw" style="background:${r.color}"></span></td><td>${esc(r.from)}${r.boardPin && board ? `<div class="loc">${esc(pinLocation(board, r.boardPin))}</div>` : ''}</td><td>${esc(r.to)}${r.note ? `<div class="loc">${md(r.note)}</div>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>

    ${(p.steps || []).length ? `<section class="card"><div class="card-h"><h2>Jak złożyć w realu</h2><a class="btn small" href="#/lab/${slug}">Tryb lab</a></div>
      <ol class="steps">${p.steps.map((s) => `<li>${md(s)}</li>`).join('')}</ol>
      <p class="safety">USB odpięte przy podłączaniu · dioda zawsze z rezystorem · 5V nigdy z GND</p></section>` : ''}

    ${p.explain && p.explain.length ? `<section class="card"><h2>Jak to działa</h2>${p.explain.map((s) => `<p>${md(s)}</p>`).join('')}</section>` : ''}

    <section class="card">
      <div class="card-h"><h2>Kod</h2><button class="btn small" data-copy="code">Kopiuj</button></div>
      ${(p.libraries || []).length ? `<p class="hint">Biblioteki (Szkic → Dołącz bibliotekę → Zarządzaj): ${p.libraries.map((l) => `<span class="chip ghost">${esc(l)}</span>`).join(' ')}</p>` : ''}
      <pre class="code"><code>${highlight(p.code || '')}</code></pre>
    </section>

    ${p.expected ? `<section class="card"><h2>Co ma się stać</h2><p>${md(p.expected)}</p></section>` : ''}
    ${(p.troubleshooting || []).length ? `<section class="card"><h2>Nie działa?</h2><ul>${p.troubleshooting.map((s) => `<li>${md(s)}</li>`).join('')}</ul></section>` : ''}

    ${(p.images || []).length ? `<section class="card"><h2>Zdjęcia</h2><div class="gallery">${p.images.map((im) => `<figure><img loading="lazy" src="${p._base}${esc(im.src)}" alt="${esc(im.caption || '')}"><figcaption>${esc(im.caption || '')}</figcaption></figure>`).join('')}</div></section>` : ''}

    <section class="card" id="wokwi">
      <h2>Wokwi (symulacja)</h2>
      ${wk.diagram && wk.broken ? `<p class="hint warn-t">Ten projekt nie zasymuluje się w Wokwi: ${wk.skipped.map(esc).join('; ')}. Rób od razu w realu.</p>` : wk.diagram ? `
        <ol class="steps compact">
          <li>Otwórz <a href="${wk.url}" target="_blank" rel="noopener">nowy projekt w Wokwi</a>.</li>
          <li>Zakładka <code>diagram.json</code> → zaznacz wszystko → wklej: <button class="btn small" data-copy="wokwi">Kopiuj diagram.json</button></li>
          <li>Zakładka <code>sketch.ino</code> → wklej kod: <button class="btn small" data-copy="code">Kopiuj kod</button></li>
          ${(p.libraries || []).length ? `<li>Library Manager (+) → dodaj: ${p.libraries.map(esc).join(', ')}</li>` : ''}
          <li>Zielony ▶.</li>
        </ol>
        ${wk.skipped.length ? `<p class="hint warn-t">Pominięte w Wokwi: ${wk.skipped.map(esc).join('; ')}</p>` : ''}
        <p class="hint">W Wokwi kable idą prosto pin-do-pinu (bez płytki stykowej), więc układ może wyglądać inaczej niż w realu — połączenia są te same.</p>`
        : `<p class="muted">${esc(wk.skipped.join(' '))}</p>`}
    </section>`;

  const sb = view.querySelector('[data-short]');
  if (sb) sb.addEventListener('click', () => copy(location.origin + location.pathname + '#' + p.n));
  view.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy === 'code' ? p.code || '' : JSON.stringify(wk.diagram, null, 2))));
  view.querySelector('[data-zoom]').addEventListener('click', () => zoom(renderDiagram(p)));
  const zb = view.querySelector('[data-zoom-bb]');
  if (zb) zb.addEventListener('click', () => zoom(renderBreadboard(layoutBreadboard(p))));
  view.querySelector('[data-jump]').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('wokwi').scrollIntoView({ behavior: 'smooth' }); });
}

function bbSection(p) {
  const L = layoutBreadboard(p);
  if (!L) return '';
  const steps = breadboardSteps(L);
  return `<section class="card">
      <div class="card-h"><h2>Na płytce stykowej</h2><button class="btn small" data-zoom-bb>Powiększ</button></div>
      <p class="hint">Tak to wpiąć w realu. Dziurki: litera = rząd, liczba = kolumna (np. <b>e12</b>). ${L.rails ? 'Szyny: + czerwona, − niebieska.' : ''}</p>
      <div class="scroll bb-wrap">${renderBreadboard(L)}</div>
      <details class="bb-list" open><summary>Co gdzie wpiąć (${steps.length})</summary><ol class="steps">${steps.map((s) => `<li>${md(s)}</li>`).join('')}</ol></details>
      ${L.notes.length ? `<p class="hint warn-t">${L.notes.map(esc).join(' ')}</p>` : ''}
    </section>`;
}

function checkPanel(chk) {
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
  if (chk.status === 'ok' && !chk.infos.length) return `<div class="check ok">✓ Kontrola bezpieczeństwa: bez uwag</div>`;
  return `<section class="check ${chk.status === 'error' ? 'err' : chk.status === 'warn' ? 'warn' : 'ok'}">
    ${chk.errors.length ? `<h3>Błędy — tak nie podłączaj</h3><ul>${li(chk.errors)}</ul>` : ''}
    ${chk.warnings.length ? `<h3>Uwagi</h3><ul>${li(chk.warnings)}</ul>` : ''}
    ${chk.status === 'ok' ? '<h3>✓ Kontrola bezpieczeństwa: OK</h3>' : ''}
    ${chk.infos.length ? `<details><summary>Wskazówki (${chk.infos.length})</summary><ul>${li(chk.infos)}</ul></details>` : ''}
  </section>`;
}

function zoom(svg) {
  const ov = document.createElement('div');
  ov.className = 'zoom';
  ov.innerHTML = `<div class="zoom-bar"><button class="btn small" data-z="-">−</button><button class="btn small" data-z="+">+</button><button class="btn small" data-z="f">Dopasuj</button><button class="btn small" data-z="x">Zamknij</button></div><div class="zoom-body">${svg}</div>`;
  document.body.appendChild(ov);
  const el = ov.querySelector('svg');
  const w0 = +el.getAttribute('width');
  const h0 = +el.getAttribute('height');
  const fit = () => Math.min(1.6, (window.innerWidth - 24) / w0);
  let s = fit();
  const apply = () => { el.setAttribute('width', w0 * s); el.setAttribute('height', h0 * s); };
  apply();
  ov.addEventListener('click', (e) => {
    const z = e.target.dataset.z;
    if (z === '+') s = Math.min(4, s * 1.3);
    if (z === '-') s = Math.max(0.3, s / 1.3);
    if (z === 'f') s = fit();
    if (z === 'x') { ov.remove(); return; }
    apply();
  });
}

async function labView(slug) {
  const p = await loadProject(slug);
  const board = getBoard(p.board);
  const L = layoutBreadboard(p);
  const steps = L ? [...breadboardSteps(L), `Sprawdź jeszcze raz: nic nie zwiera 5V z GND, dioda ma rezystor.`, `Podłącz USB i wgraj kod (${board ? esc(board.ide) : ''}).`] : p.steps || [];
  const done = new Set(store.get('lab2:' + slug, []));
  const rows = connectionRows(p);
  view.innerHTML = `
    <a class="back" href="#/p/${slug}">← ${esc(p.title)}</a>
    <h1 class="lab-title">Tryb lab</h1>
    <div class="progress"><div class="bar"></div><span class="ptext"></span></div>
    <p class="safety">Najpierw odepnij USB. Podłączasz na końcu.</p>
    ${L ? `<div class="scroll bb-wrap lab-bb">${renderBreadboard(L)}</div>` : ''}
    <ol class="lab-steps">${steps.map((s, i) => `<li><label><input type="checkbox" data-i="${i}" ${done.has(i) ? 'checked' : ''}><span>${md(s)}</span></label></li>`).join('')}</ol>
    <div class="lab-actions"><button class="btn" data-reset>Od nowa</button><a class="btn primary" href="#/p/${slug}">Gotowe</a></div>
    ${L && (p.steps || []).length ? `<details class="card"><summary><h2>Opis krok po kroku</h2></summary><ol class="steps">${p.steps.map((s) => `<li>${md(s)}</li>`).join('')}</ol></details>` : ''}
    <details class="card"><summary><h2>Piny na płytce</h2></summary><div class="scroll">${renderBoard(p.board, usedBoardPins(p))}</div></details>
    <details class="card"><summary><h2>Połączenia</h2></summary>
      <table class="conn">${rows.map((r) => `<tr><td><span class="sw" style="background:${r.color}"></span></td><td>${esc(r.from)}${r.boardPin && board ? `<div class="loc">${esc(pinLocation(board, r.boardPin))}</div>` : ''}</td><td>${esc(r.to)}</td></tr>`).join('')}</table>
    </details>
    <details class="card"><summary><h2>Schemat</h2></summary><div class="scroll">${renderDiagram(p)}</div></details>`;
  const upd = () => {
    const n = steps.length ? Math.round((done.size / steps.length) * 100) : 0;
    view.querySelector('.bar').style.width = n + '%';
    view.querySelector('.ptext').textContent = `${done.size}/${steps.length}`;
    if (steps.length && done.size === steps.length) toast('Wszystko podłączone. Teraz USB i wgraj kod.');
  };
  view.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
    const i = +c.dataset.i;
    c.checked ? done.add(i) : done.delete(i);
    store.set('lab2:' + slug, [...done]);
    upd();
  }));
  view.querySelector('[data-reset]').addEventListener('click', () => {
    done.clear();
    store.del('lab2:' + slug);
    view.querySelectorAll('input[type=checkbox]').forEach((c) => (c.checked = false));
    upd();
  });
  upd();
}

async function reportView(slug) {
  const [p, s] = await Promise.all([loadProject(slug), loadSettings()]);
  view.innerHTML = `
    <div class="report-bar no-print">
      <a class="btn small" href="#/p/${slug}">← Wróć</a>
      <button class="btn primary small" data-print>Zapisz PDF</button>
      <span class="hint">Tekst możesz poprawić palcem przed zapisem. W oknie drukowania wybierz „Zapisz jako PDF”.</span>
    </div>
    <div class="report">${renderReport(p, s)}</div>`;
  view.querySelector('[data-print]').addEventListener('click', () => { if (document.activeElement) document.activeElement.blur(); window.print(); });
  document.title = `Sprawozdanie – ${p.title}`;
}

async function cheatView(which) {
  const id = which && BOARDS[which] ? which : 'nano';
  const b = BOARDS[id];
  const cat = {};
  b.rows.flat().forEach((pin) => {
    const t = pinTags(b, pin);
    cat[pin] = t.includes('GND') ? '#6e7681' : t.some((x) => /^(5V|3V3|VIN)$/.test(x)) ? '#e5484d' : t.some((x) => x.startsWith('I2C')) ? '#2f6fe4' : t.includes('analog') ? '#2fa84f' : t.includes('PWM') ? '#8e4ec6' : t.includes('Serial') ? '#f08c2e' : null;
  });
  Object.keys(cat).forEach((k) => cat[k] === null && delete cat[k]);
  const special = b.rows.flat().filter((v, i, a) => a.indexOf(v) === i).map((pin) => [pin, pinTags(b, pin)]).filter(([, t]) => t.length);
  view.innerHTML = `
    <h1>Ściągawka</h1>
    <div class="tabs">${Object.entries(BOARDS).map(([k, v]) => `<a class="tab${k === id ? ' active' : ''}" href="#/sciagawka/${k}">${esc(v.short)}</a>`).join('')}</div>
    <section class="card">
      <h2>${esc(b.name)}</h2>
      <div class="scroll">${renderBoard(id, cat)}</div>
      <div class="legend"><span><i style="background:#e5484d"></i>zasilanie</span><span><i style="background:#6e7681"></i>GND</span><span><i style="background:#2fa84f"></i>analog</span><span><i style="background:#8e4ec6"></i>PWM</span><span><i style="background:#2f6fe4"></i>I2C</span><span><i style="background:#f08c2e"></i>Serial/USB</span></div>
      <p class="hint">Logika ${b.logic} V · I2C: SDA=${b.i2c.SDA}, SCL=${b.i2c.SCL} · ${esc(b.ide)}</p>
      <details><summary>Wszystkie specjalne piny</summary><table class="conn">${special.map(([pin, t]) => `<tr><td><b>${esc(pin)}</b></td><td>${t.map(esc).join(', ')}</td></tr>`).join('')}</table></details>
    </section>
    <section class="card">
      <h2>Żeby nie jebło</h2>
      <ul>
        <li>Podłączasz przy <b>odpiętym USB</b>, USB wpinasz na końcu.</li>
        <li><b>5V nigdy z GND</b> w jednej kolumnie płytki.</li>
        <li><b>Dioda zawsze z rezystorem</b> (220 Ω).</li>
        <li>Moduły na 3,3V (BMP280, większość czujników do ESP) — <b>nie na 5V</b>.</li>
        <li>Jedna dziurka = jeden kabel. Więcej połączeń → ta sama kolumna (5 dziurek) albo szyna.</li>
        <li>Przycisk i moduły z dwoma rzędami nóżek — <b>nad środkowym rowkiem</b>.</li>
      </ul>
    </section>
    <section class="card">
      <h2>Płytka stykowa</h2>
      <ul>
        <li>Kolumna 5 dziurek (a–e albo f–j) jest połączona w środku. Środkowy rowek rozdziela.</li>
        <li>Szyny przy brzegu (+ czerwona, − niebieska) są połączone wzdłuż całej płytki. Górne i dolne nie są połączone ze sobą, czasem szyna ma przerwę w połowie.</li>
      </ul>
    </section>
    <section class="card">
      <h2>Części</h2>
      ${Object.entries(PARTS).filter(([k]) => k !== 'module').map(([k, d]) => `
        <details class="part-d"><summary><b>${esc(d.name)}</b></summary>
          <p>${md(d.desc || '')}</p>
          ${d.pins.length ? `<p class="hint">Piny: ${d.pins.map((x) => esc(x.label)).join(' · ')}${d.vcc ? ` · zasilanie ${d.vcc[0] === d.vcc[1] ? d.vcc[0] : d.vcc[0] + '–' + d.vcc[1]} V` : ''}</p>` : ''}
          ${(d.tips || []).length ? `<ul>${d.tips.map((t) => `<li>${md(t)}</li>`).join('')}</ul>` : ''}
          ${d.wokwi ? '' : '<p class="hint">Brak w Wokwi — tylko w realu.</p>'}
        </details>`).join('')}
    </section>`;
}

async function inventoryView() {
  const [inv, idx] = await Promise.all([loadInventory(), loadIndex()]);
  const items = inv.items || [];
  const EXTRA = { breadboard: 'Płytka stykowa', jumper: 'Przewody (kabelki)', usb: 'Kabel USB' };
  const label = (it) => it.type === 'resistor' ? `Rezystor ${it.value}` : (BOARDS[it.type] || {}).name || (PARTS[it.type] || {}).name || EXTRA[it.type] || it.name || it.type;
  const missingProj = idx.filter((x) => x.missing && x.missing.length);
  view.innerHTML = `
    <h1>Magazyn części</h1>
    <p class="muted">Co masz pod ręką. Projekty sprawdzają to automatycznie i podpowiadają zamienniki.</p>
    <section class="card"><table class="conn inv">
      <thead><tr><th>Część</th><th>Ile</th><th>Uwagi</th></tr></thead>
      <tbody>${items.map((it) => `<tr><td>${esc(label(it))}</td><td>${it.qty == null ? '∞' : it.qty}</td><td class="muted">${esc(it.note || '')}</td></tr>`).join('')}</tbody>
    </table></section>
    ${missingProj.length ? `<section class="card"><h2>Brakuje do projektów</h2><ul>${missingProj.map((x) => `<li><a href="#/p/${x.slug}">${esc(x.title)}</a>: ${x.missing.map(esc).join(', ')}</li>`).join('')}</ul></section>` : ''}
    <p class="hint">Żeby zmienić magazyn, napisz do Claude np. „dodaj do magazynu 2× serwo SG90”.</p>`;
}

async function newTaskView() {
  const draft = store.get('draft', { text: '', board: 'nano', self: false, report: false });
  view.innerHTML = `
    <h1>Nowe zadanie</h1>
    <p class="muted">Opisz zadanie z labów. Skopiuję gotowe polecenie i otworzę Claude — wklejasz, wysyłasz, po chwili dostajesz link do projektu tutaj.</p>
    <section class="card form">
      <label>Co trzeba zrobić?<textarea rows="5" name="text" placeholder="np. podłączyć czujnik DHT11 i pokazywać temperaturę na LCD">${esc(draft.text)}</textarea></label>
      <label>Płytka<select name="board">${Object.entries(BOARDS).map(([k, v]) => `<option value="${k}" ${k === draft.board ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="row"><input type="checkbox" name="self" ${draft.self ? 'checked' : ''}> Chcę robić sam — daj tylko kierunek</label>
      <label class="row"><input type="checkbox" name="report" ${draft.report ? 'checked' : ''}> Przygotuj też sprawozdanie</label>
      <button class="btn primary wide" data-go>Kopiuj polecenie i otwórz Claude</button>
      <button class="btn wide" data-only>Tylko kopiuj</button>
    </section>
    <p class="hint">Z komputera: Claude Code w repo <code>AdamWalus/Arduino-lab</code> działa tak samo.</p>`;
  const f = view.querySelector('.form');
  const read = () => ({ text: f.querySelector('[name=text]').value.trim(), board: f.querySelector('[name=board]').value, self: f.querySelector('[name=self]').checked, report: f.querySelector('[name=report]').checked });
  f.addEventListener('input', () => store.set('draft', read()));
  const prompt = (d) => [
    'Repo: AdamWalus/Arduino-lab (trzymaj się CLAUDE.md).',
    `Zadanie: ${d.text || '(opisz zadanie)'}`,
    `Płytka: ${d.board}.`,
    d.self ? 'Chcę zrobić to sam: dodaj projekt z podłączeniem i krokami, ale kod tylko jako szkielet z komentarzami/kierunkiem.' : 'Zrób pełny projekt: schemat, kroki w realu, kod.',
    d.report ? 'Dodaj też sekcję report (sprawozdanie).' : '',
    'Sprawdź `node scripts/check.mjs`, wypchnij na main i daj mi link do projektu.',
  ].filter(Boolean).join('\n');
  f.querySelector('[data-go]').addEventListener('click', () => { const text = prompt(read()); window.open('https://claude.ai/code', '_blank'); copy(text); });
  f.querySelector('[data-only]').addEventListener('click', () => copy(prompt(read())));
}

async function settingsView() {
  const s = await loadSettings();
  const fields = [['student', 'Imię i nazwisko'], ['group', 'Grupa'], ['subject', 'Przedmiot'], ['teacher', 'Prowadzący'], ['faculty', 'Wydział']];
  view.innerHTML = `
    <h1>Ustawienia</h1>
    <section class="card form">
      ${fields.map(([k, l]) => `<label>${l}<input name="${k}" value="${esc(s[k] || '')}"></label>`).join('')}
      <p class="hint">Używane na stronie tytułowej sprawozdań. Zapisuje się na tym urządzeniu.</p>
      <button class="btn primary wide" data-save>Zapisz</button>
    </section>
    <section class="card"><h2>Aplikacja</h2>
      <button class="btn wide" data-lock>Zablokuj (PIN)</button>
      <button class="btn wide" data-refresh>Odśwież dane</button>
    </section>`;
  view.querySelector('[data-save]').addEventListener('click', () => {
    const o = {};
    fields.forEach(([k]) => (o[k] = view.querySelector(`[name=${k}]`).value.trim()));
    store.set('settings', o);
    toast('Zapisane');
  });
  view.querySelector('[data-lock]').addEventListener('click', () => { store.del('unlocked'); location.reload(); });
  view.querySelector('[data-refresh]').addEventListener('click', async () => {
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    location.reload();
  });
}

// ---------- PIN
async function gate() {
  const s = await loadSettings();
  if (!s.pinHash || store.get('unlocked') === s.pinHash) return;
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'gate';
    ov.innerHTML = `<div class="gate-box"><div class="logo">⚡</div><h1>Arduino Lab</h1><div class="dots"><i></i><i></i><i></i><i></i></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => `<button ${k === '' ? 'disabled class="blank"' : ''} data-k="${k}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    let code = '';
    const dots = ov.querySelectorAll('.dots i');
    const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < code.length));
    const press = async (k) => {
      if (k === '⌫') code = code.slice(0, -1);
      else if (code.length < 4) code += k;
      show();
      if (code.length === 4) {
        const h = await sha256(code);
        if (h === s.pinHash) {
          store.set('unlocked', h);
          ov.remove();
          resolve();
        } else {
          code = '';
          ov.querySelector('.dots').classList.add('shake');
          setTimeout(() => { ov.querySelector('.dots').classList.remove('shake'); show(); }, 400);
        }
      }
    };
    ov.addEventListener('click', (e) => { const k = e.target.dataset.k; if (k !== undefined && k !== '') press(k); });
    window.addEventListener('keydown', function kd(e) {
      if (!document.body.contains(ov)) return window.removeEventListener('keydown', kd);
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') press('⌫');
    });
  });
}

// ---------- start
(async () => {
  await gate();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

export { partDef };
