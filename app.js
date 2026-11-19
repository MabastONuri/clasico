'use strict';

const KEY = 'clasico.sessions.v1';
const $ = (id) => document.getElementById(id);
const FIELDS = ['mw', 'zw', 'mg', 'zg']; // Mabast wins, Zmnako wins, Mabast goals, Zmnako goals
const MAX = 9999;

// Bump VERSION and add an entry on top with every release.
const VERSION = '1.6.0';
const CHANGELOG = [
  ['1.6.0', '2026-11-19', ['Tiles now show goals, goal difference and game difference', 'Confetti, glitter and a fanfare when Barça wins a session']],
  ['1.5.0', '2026-11-19', ['Games and goals accept any number from 0 to 9999', 'Version and change log on the install screen']],
  ['1.4.0', '2026-11-19', ['Big numbers shrink to fit, so 3 and 4 digit totals stay inside their box']],
  ['1.3.0', '2026-11-19', ['Delete a session with its own button and a confirm step']],
  ['1.2.0', '2026-11-19', ['Fixed the blank screen when opening from the home screen', 'Updates reach the app the next time it opens online']],
  ['1.1.0', '2026-11-19', ['Dates shown as yyyy-mm-dd', 'Player photos behind each side of the scoreboard']],
  ['1.0.0', '2026-11-19', ['First release: log sessions, totals, PNG export, works offline']],
];
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- install gate ---------- */
function showGate() {
  $('gate').hidden = false;
  $('ver').textContent = `v${VERSION}`;
  $('changelog').innerHTML = CHANGELOG.map(([v, date, notes]) => `<li>
    <p class="log-v"><b>${v}</b><time>${date}</time></p>
    <ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
  </li>`).join('');
  if (isIOS) { $('gateIOS').hidden = false; return; }
  $('gateOther').hidden = false;
  let prompt;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').onclick = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    $('installBtn').hidden = true;
  };
  addEventListener('appinstalled', () => {
    $('installBtn').hidden = true;
    $('otherHint').innerHTML = 'Installed. Open <b>Clásico</b> from your home screen.';
  });
}

/* ---------- data ---------- */
let sessions = [];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(sessions)); return true; }
  catch { alert('Could not save — device storage is full.'); return false; }
}
function totals() {
  const t = { mw: 0, zw: 0, mg: 0, zg: 0, n: sessions.length };
  for (const s of sessions) { t.mw += s.mw; t.zw += s.zw; t.mg += s.mg; t.zg += s.zg; }
  return t;
}
const leader = (d) => (d > 0 ? 'Mabast' : d < 0 ? 'Zmnako' : '');
const diffText = (d) => (d ? `${leader(d)} +${Math.abs(d)}` : 'Level');

function leadText(t) {
  const d = t.mw - t.zw, n = Math.abs(d), g = n === 1 ? 'game' : 'games';
  if (!t.n) return 'No sessions logged yet';
  if (!d) return 'All square on games won';
  return `${d > 0 ? 'Mabast' : 'Zmnako'} leads by ${n} ${g}`;
}

/* ---------- app ---------- */
const ymd = (d) => d.toLocaleDateString('en-CA'); // en-CA = yyyy-mm-dd in local time
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function startApp() {
  sessions = load();
  navigator.storage?.persist?.();
  $('app').hidden = false;
  $('appVer').textContent = `Clásico Ledger v${VERSION}`;
  render();

  const dlg = $('entry'), form = $('entryForm');
  $('addBtn').onclick = () => {
    FIELDS.forEach((f) => ($(f).value = '0'));
    $('err').textContent = '';
    $('entryDate').textContent = ymd(new Date());
    dlg.showModal();
  };
  $('cancelBtn').onclick = () => dlg.close();
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-for]');
    if (!b) return;
    const inp = $(b.dataset.for);
    const v = (parseInt(inp.value, 10) || 0) + Number(b.dataset.d);
    inp.value = String(Math.min(MAX, Math.max(0, v)));
  });
  FIELDS.forEach((f) => $(f).addEventListener('focus', (e) => e.target.select()));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = { id: Date.now(), t: new Date().toISOString() };
    for (const f of FIELDS) {
      const raw = $(f).value.trim();
      if (!/^\d+$/.test(raw) || Number(raw) > MAX) { // 0 is valid; blanks, negatives and decimals are not
        $('err').textContent = `Use whole numbers from 0 to ${MAX}.`;
        $(f).focus();
        return;
      }
      s[f] = Number(raw);
    }
    sessions.unshift(s);
    if (!save()) { sessions.shift(); return; }
    dlg.close();
    render();
    if (s.mw > s.zw) celebrate(s); // Barça (Mabast) won the session
  });

  let doomed = null; // the session the delete sheet is showing
  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('.del');
    doomed = b && sessions.find((x) => x.id === Number(b.dataset.id));
    if (!doomed) return;
    const d = new Date(doomed.t);
    $('delDate').textContent = `${ymd(d)} · ${timeFmt.format(d)}`;
    $('delGames').textContent = `${doomed.mw} – ${doomed.zw}`;
    $('delGoals').textContent = `${doomed.mg} – ${doomed.zg}`;
    $('del').showModal();
  });
  $('delCancel').onclick = () => $('del').close();
  $('delForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!doomed) return;
    const before = sessions;
    sessions = sessions.filter((x) => x.id !== doomed.id);
    if (!save()) { sessions = before; return; } // keep screen and storage in sync
    doomed = null;
    $('del').close();
    render();
  });

  $('exportBtn').onclick = exportPng;
}

function render() {
  const t = totals();
  // --len drives the CSS font size so longer numbers shrink to fit
  const put = (id, v, min) => {
    $(id).textContent = v;
    $(id).style.setProperty('--len', Math.max(min, String(v).length));
  };
  const big = Math.max(2, String(t.mw).length, String(t.zw).length); // both sides share one size
  put('mWins', t.mw, big);
  put('zWins', t.zw, big);
  put('goals', `${t.mg} – ${t.zg}`, 6);
  const diff = (id, d) => { // positive = Mabast ahead
    put(id, d ? `+${Math.abs(d)}` : '0', 6);
    $(`${id}Who`).textContent = leader(d) || 'Level';
    $(`${id}Tile`).dataset.lead = d > 0 ? 'm' : d < 0 ? 'z' : '';
  };
  diff('goalDiff', t.mg - t.zg);
  diff('gameDiff', t.mw - t.zw);
  $('shareBar').style.width = (t.mw + t.zw ? (t.mw / (t.mw + t.zw)) * 100 : 50) + '%';
  $('lead').innerHTML = leadText(t).replace(/^(Mabast|Zmnako)/, '<b>$1</b>');
  $('empty').hidden = t.n > 0;
  $('list').innerHTML = sessions.map((s) => {
    const d = new Date(s.t);
    const w = s.mw > s.zw ? 'm' : s.zw > s.mw ? 'z' : '';
    const who = w === 'm' ? 'Mabast won' : w === 'z' ? 'Zmnako won' : 'Drawn session';
    return `<li class="row ${w}">
      <span class="when"><b>${ymd(d)}</b><small>${timeFmt.format(d)}</small></span>
      <span class="score"><b style="--len:${Math.max(5, `${s.mw}${s.zw}`.length + 4)}">${s.mw}<i>–</i>${s.zw}</b><small>${who} · Goals ${s.mg}–${s.zg}</small></span>
      <button class="del" type="button" data-id="${s.id}" aria-label="Delete ${ymd(d)} session, ${s.mw} to ${s.zw}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </li>`;
  }).join('');
}

/* ---------- Barça-win celebration ---------- */
// Called from the Save tap, so iOS allows the sound to start.
function celebrate(s) {
  try { fanfare(); } catch { /* no audio on this device: the visuals still run */ }
  const msg = document.createElement('div');
  msg.className = 'party-msg';
  msg.setAttribute('role', 'status');
  msg.innerHTML = `<small>FC Barcelona</small><b>Mabast wins</b><span>${s.mw} – ${s.zw}</span>`;
  document.body.append(msg);
  setTimeout(() => msg.remove(), 3500);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) confetti();
}

function confetti() {
  const c = document.createElement('canvas');
  c.className = 'party';
  document.body.append(c);
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const colors = ['#a50044', '#004d98', '#edbb00', '#ffffff', '#ff5c93', '#3b8bff'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const P = [];
  for (let i = 0; i < 170; i++) { // confetti: two cannons firing in from the lower corners
    const left = i % 2 === 0;
    P.push({ kind: 'paper', x: left ? -10 : W + 10, y: H * rnd(0.6, 0.85),
      vx: (left ? 1 : -1) * rnd(3, W / 45), vy: -rnd(9, 17), w: rnd(6, 12), h: rnd(3, 7),
      r: rnd(0, 6.28), vr: rnd(-0.3, 0.3), c: colors[i % colors.length], delay: rnd(0, 350) });
  }
  for (let i = 0; i < 110; i++) { // glitter: twinkling specks drifting down from above
    P.push({ kind: 'glitter', x: rnd(0, W), y: rnd(-H * 0.6, 0), vx: rnd(-0.6, 0.6), vy: rnd(1.2, 3.2),
      s: rnd(1, 2.6), ph: rnd(0, 6.28), c: i % 3 ? '#edbb00' : '#ffffff', delay: rnd(0, 900) });
  }
  const DUR = 3800, start = performance.now();
  let last = start;
  const frame = (now) => {
    const t = now - start, k = Math.min(2, (now - last) / 16.7); // keep speed steady on 60/120Hz screens
    last = now;
    const fade = Math.max(0, Math.min(1, (DUR - t) / 900));
    x.clearRect(0, 0, W, H);
    for (const p of P) {
      if (t < p.delay) continue;
      if (p.kind === 'paper') {
        p.vy += 0.3 * k; p.vx *= 0.985 ** k; p.vy *= 0.985 ** k;
        p.x += p.vx * k; p.y += p.vy * k; p.r += p.vr * k;
        x.save(); x.globalAlpha = fade;
        x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.r * 2)); // flip as it tumbles
        x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        x.restore();
      } else {
        p.x += p.vx * k; p.y += p.vy * k; p.ph += 0.22 * k;
        const tw = Math.abs(Math.sin(p.ph));
        x.globalAlpha = fade * (0.25 + 0.75 * tw);
        x.fillStyle = p.c;
        x.beginPath(); x.arc(p.x, p.y, p.s, 0, 6.283); x.fill();
        if (tw > 0.85) { // brief four-point sparkle
          const L = p.s * 4;
          x.fillRect(p.x - L, p.y - 0.5, L * 2, 1); x.fillRect(p.x - 0.5, p.y - L, 1, L * 2);
        }
      }
    }
    x.globalAlpha = 1;
    if (t < DUR) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// Original fanfare synthesized on the device: rising brass-like arpeggio, a held chord,
// chime sparkles and a crowd-like swell of filtered noise. No audio files needed offline.
function fanfare() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ac = new AC();
  const t0 = ac.currentTime + 0.03;
  const out = ac.createGain();
  out.gain.value = 0.6;
  out.connect(ac.destination);
  const tone = (f, at, dur, type, vol) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(out);
    o.start(at); o.stop(at + dur + 0.05);
  };
  const run = [392, 523.25, 659.25, 783.99, 1046.5]; // G4 C5 E5 G5 C6
  run.forEach((f, i) => {
    tone(f, t0 + i * 0.1, 0.3, 'sawtooth', 0.05);
    tone(f, t0 + i * 0.1, 0.34, 'triangle', 0.18);
  });
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => { // final chord, slightly detuned for width
    tone(f, t0 + 0.52, 1.5, 'triangle', 0.1);
    tone(f * 1.004, t0 + 0.52, 1.5, 'sawtooth', 0.025);
  });
  for (let i = 0; i < 16; i++) tone(1800 + Math.random() * 2600, t0 + 0.5 + i * 0.08 + Math.random() * 0.04, 0.22, 'sine', 0.045);
  const len = 2.4, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
  noise.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.7;
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.16, t0 + 0.6);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  noise.connect(bp); bp.connect(ng); ng.connect(out);
  noise.start(t0);
  setTimeout(() => ac.close(), (len + 0.6) * 1000);
}

/* ---------- PNG export ---------- */
const loadImg = (src) => new Promise((r) => {
  const i = new Image();
  i.onload = () => r(i);
  i.onerror = () => r(null); // photo not added yet → club colours only
  i.src = src;
});

async function exportPng() {
  const W = 1080, H = 1350, P = 60;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const t = totals();
  const F = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif';
  const font = (w, s) => (x.font = `${w} ${s}px ${F}`);
  const track = (px) => { if ('letterSpacing' in x) x.letterSpacing = px + 'px'; };
  const text = (s, X, Y, color, align = 'left') => { x.fillStyle = color; x.textAlign = align; x.fillText(s, X, Y); };
  const fit = (s, weight, size, max) => { font(weight, size); while (x.measureText(s).width > max && size > 40) font(weight, (size -= 8)); };

  x.fillStyle = '#0b0d12';
  x.fillRect(0, 0, W, H);

  // header
  track(6); font(700, 24); text('CLÁSICO LEDGER', P, 96, '#edbb00');
  track(0); font(500, 26); text(ymd(new Date()), W - P, 96, '#8a93a6', 'right');

  // board
  const bx = P, by = 150, bw = W - P * 2, bh = 620, half = bw / 2;
  x.save();
  x.beginPath(); x.roundRect(bx, by, bw, bh, 40); x.clip();
  x.fillStyle = '#a50044'; x.fillRect(bx, by, half, bh);
  x.fillStyle = '#004d98';
  x.fillRect(bx + half * 0.25, by, half * 0.125, bh);
  x.fillRect(bx + half * 0.625, by, half * 0.125, bh);
  x.fillStyle = '#f4f2ec'; x.fillRect(bx + half, by, half, bh);
  const photo = async (n) => (await loadImg(`img/${n}.png`)) || loadImg(`img/${n}.jpg`);
  const [messi, ronaldo] = await Promise.all([photo('messi'), photo('ronaldo')]);
  [[messi, bx, '165,0,68'], [ronaldo, bx + half, '244,242,236']].forEach(([im, X, rgb]) => {
    if (im) { // cover-crop, biased toward the top so faces stay in frame
      const s = Math.max(half / im.width, bh / im.height), sw = half / s, sh = bh / s;
      x.drawImage(im, (im.width - sw) / 2, (im.height - sh) * 0.2, sw, sh, X, by, half, bh);
    }
    const g = x.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, `rgba(${rgb},.88)`); g.addColorStop(0.35, `rgba(${rgb},0)`);
    g.addColorStop(0.5, `rgba(${rgb},0)`); g.addColorStop(0.85, `rgba(${rgb},.95)`);
    x.fillStyle = g; x.fillRect(X, by, half, bh);
  });
  x.fillStyle = '#edbb00'; x.fillRect(bx + half, by, 5, bh);
  x.restore();

  track(4); font(700, 22);
  text('FC BARCELONA', bx + 40, by + 96, 'rgba(255,255,255,.78)');
  text('REAL MADRID', bx + bw - 40, by + 96, 'rgba(14,35,80,.7)', 'right');
  track(-1); font(800, 60);
  text('Mabast', bx + 40, by + 160, '#fff');
  text('Zmnako', bx + bw - 40, by + 160, '#0e2350', 'right');
  track(-8);
  fit(String(t.mw), 800, 300, half - 80); text(String(t.mw), bx + 32, by + bh - 50, '#fff');
  fit(String(t.zw), 800, 300, half - 80); text(String(t.zw), bx + bw - 32, by + bh - 50, '#0e2350', 'right');

  // seam label
  track(5); font(700, 20);
  const label = 'GAMES WON', lw = x.measureText(label).width + 48;
  x.fillStyle = '#0b0d12';
  x.beginPath(); x.roundRect(W / 2 - lw / 2, by - 1, lw, 48, [0, 0, 16, 16]); x.fill();
  text(label, W / 2, by + 31, '#edbb00', 'center');

  // share bar
  const sy = by + bh + 26, share = t.mw + t.zw ? t.mw / (t.mw + t.zw) : 0.5;
  x.save();
  x.beginPath(); x.roundRect(P, sy, bw, 12, 6); x.clip();
  x.fillStyle = '#f4f2ec'; x.fillRect(P, sy, bw, 12);
  x.fillStyle = '#a50044'; x.fillRect(P, sy, bw * share, 12);
  x.restore();

  // facts
  const fy = sy + 44, gap = 16, cw = (bw - gap * 2) / 3, ch = 130;
  [['GOALS', `${t.mg} – ${t.zg}`], ['GOAL DIFF', diffText(t.mg - t.zg)], ['GAME DIFF', diffText(t.mw - t.zw)]].forEach(([k, v], i) => {
    const cx = P + i * (cw + gap);
    x.fillStyle = '#141821';
    x.beginPath(); x.roundRect(cx, fy, cw, ch, 24); x.fill();
    track(3); font(600, 19); text(k, cx + 28, fy + 46, '#8a93a6');
    track(-1); fit(v, 800, 52, cw - 56); text(v, cx + 28, fy + 104, '#eef0f4');
  });

  // recent sessions
  let ry = fy + ch + 64;
  track(4); font(700, 20); text('RECENT SESSIONS', P, ry, '#8a93a6');
  track(0);
  ry += 52;
  if (!sessions.length) { font(500, 28); text('No sessions yet', P, ry, '#8a93a6'); }
  sessions.slice(0, 3).forEach((s) => {
    const w = s.mw > s.zw ? '#a50044' : s.zw > s.mw ? '#f4f2ec' : '#8a93a6';
    x.fillStyle = w; x.beginPath(); x.roundRect(P, ry - 28, 6, 34, 3); x.fill();
    font(500, 28); text(ymd(new Date(s.t)), P + 26, ry, '#8a93a6');
    font(800, 32); text(`${s.mw} – ${s.zw}`, W / 2 + 90, ry, '#eef0f4', 'center');
    font(500, 28); text(`Goals ${s.mg}–${s.zg}`, W - P, ry, '#8a93a6', 'right');
    ry += 50;
  });

  // footer
  x.fillStyle = '#262c3b'; x.fillRect(P, H - 96, bw, 2);
  font(700, 28); text(leadText(t), P, H - 46, '#eef0f4');
  font(500, 24); text('Mabast × Zmnako', W - P, H - 46, '#8a93a6', 'right');

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const name = `clasico-${ymd(new Date())}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } // iOS/Android sheet → "Save Image"
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Must stay last: startApp() uses the let/const declarations above.
if (standalone) startApp(); else showGate();
