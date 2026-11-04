// Sprawozdanie: strona tytułowa UBB + sekcje. Drukowane do PDF przez przeglądarkę.
import { getBoard } from './boards.js';
import { partTitle } from './parts.js';
import { renderDiagram, connectionRows } from './diagram.js';
import { esc, md, fmtDate } from './util.js';

export function renderReport(p, s) {
  const r = p.report || {};
  const board = getBoard(p.board);
  const date = fmtDate(r.date || p.date) || '…';
  const ph = (x, fallback) => (x ? md(x) : `<span class="ph">${esc(fallback)}</span>`);

  // Co było potrzebne
  const needed = r.needed || (() => {
    const counts = {};
    (p.parts || []).forEach((x) => { const t = partTitle(x); counts[t] = (counts[t] || 0) + 1; });
    return [board ? board.name : p.board, ...Object.entries(counts).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)), 'płytka stykowa i przewody', 'kabel USB'];
  })();

  const pinTable = connectionRows(p).filter((x) => x.boardPin);
  const imgs = (where) => (p.images || []).filter((im) => (im.report || '') === where)
    .map((im, i) => `<figure class="r-fig"><img src="${p._base}${esc(im.src)}" alt=""><figcaption>${esc(im.caption || '')}</figcaption></figure>`).join('');

  const results = (r.results || []).map((x) => `
    ${x.text ? `<p>${md(x.text)}</p>` : ''}
    ${x.table ? `<table class="r-table"><thead><tr>${x.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.table.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
    ${x.image ? `<figure class="r-fig"><img src="${p._base}${esc(x.image)}" alt=""><figcaption>${esc(x.caption || '')}</figcaption></figure>` : ''}`).join('');

  return `
  <section class="r-title">
    <img class="r-logo" src="assets/ubb-logo.png" alt="Uniwersytet Bielsko-Bialski">
    <div class="r-faculty" contenteditable>${esc(s.faculty || 'Wydział Budowy Maszyn i Informatyki')}</div>
    <div class="r-subject" contenteditable>${esc(s.subject || '')}</div>
    <div class="r-lab" contenteditable>(Laboratorium${r.lab ? ' №' + esc(r.lab) : ''})</div>
    <div class="r-topic" contenteditable>Temat ćwiczenia: ${esc(r.topic || p.title)}</div>
    <div class="r-date" contenteditable>Data wykonania ćwiczenia: ${esc(date)}</div>
    <div class="r-who" contenteditable>${esc(s.student || 'Imię Nazwisko')}<br>Grupa ${esc(s.group || '…')}<br>Prowadzący: ${esc(s.teacher || '…')}</div>
  </section>

  <section class="r-body" contenteditable>
    <h2>1. Cel ćwiczenia</h2>
    <p>${ph(r.goal, '(cel ćwiczenia — uzupełnij)')}</p>

    <h2>2. Co było potrzebne</h2>
    <ul>${needed.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

    <h2>3. Podłączenie</h2>
    ${r.connection ? `<p>${md(r.connection)}</p>` : ''}
    ${pinTable.length ? `<table class="r-table"><thead><tr><th>Element</th><th>${esc(board ? board.short : 'Płytka')}</th></tr></thead><tbody>${pinTable.map((x) => {
      const part = x.from.startsWith(board.short + ' ') ? x.to : x.from;
      return `<tr><td>${esc(part)}</td><td>${esc(x.boardPin)}</td></tr>`;
    }).join('')}</tbody></table>` : ''}
    ${r.diagram === false ? '' : `<figure class="r-fig r-diagram">${renderDiagram(p)}<figcaption>Schemat połączeń</figcaption></figure>`}
    ${imgs('connection')}

    <h2>4. Program</h2>
    ${r.program ? `<p>${md(r.program)}</p>` : ''}
    <pre class="r-code">${esc(p.code || '')}</pre>
    ${r.programAfter ? `<p>${md(r.programAfter)}</p>` : ''}

    <h2>5. Wyniki</h2>
    ${results || `<p><span class="ph">(wyniki — uzupełnij)</span></p>`}
    ${imgs('results')}

    <h2>6. Wnioski</h2>
    ${(r.conclusions || []).length ? r.conclusions.map((c) => `<p>${md(c)}</p>`).join('') : '<p><span class="ph">(wnioski — uzupełnij)</span></p>'}
  </section>`;
}
