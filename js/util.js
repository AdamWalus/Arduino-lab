export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mini-markdown: **pogrubienie**, `kod`, [link](url)
export function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

const KW = new Set(('void int long float double char bool boolean byte unsigned const static return if else for while do switch case break continue ' +
  'true false HIGH LOW INPUT OUTPUT INPUT_PULLUP include define struct class new delete uint8_t uint16_t uint32_t int16_t String auto').split(' '));
const FN = new Set(('setup loop pinMode digitalWrite digitalRead analogWrite analogRead delay delayMicroseconds millis micros map constrain tone noTone ' +
  'pulseIn Serial begin print println available read write random randomSeed abs min max attach').split(' '));

export function highlight(code) {
  const out = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])')|(#\s*\w+[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[1]) out.push(`<span class="c-com">${esc(m[1])}</span>`);
    else if (m[2]) out.push(`<span class="c-str">${esc(m[2])}</span>`);
    else if (m[3]) out.push(`<span class="c-pre">${esc(m[3])}</span>`);
    else if (m[4]) out.push(`<span class="c-num">${esc(m[4])}</span>`);
    else if (m[5]) out.push(KW.has(m[5]) ? `<span class="c-kw">${m[5]}</span>` : FN.has(m[5]) ? `<span class="c-fn">${m[5]}</span>` : esc(m[5]));
    else out.push(esc(m[6]));
  }
  return out.join('');
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch {}
    t.remove();
  }
  toast('Skopiowane');
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

export const store = {
  get(k, d) {
    try { const v = localStorage.getItem('al:' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('al:' + k, JSON.stringify(v)); } catch {}
  },
  del(k) {
    try { localStorage.removeItem('al:' + k); } catch {}
  },
};

export async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function getText(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}
