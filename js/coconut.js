import { P, Field, Coconut, protection, numbers, inBoulder, floatGeom } from './coconut-core.js';
import { fit, wobblyPoly, wobblyLine, arrow, bindSlider, HAND } from './sketch.js';

const stage = document.getElementById('stage');
const cvT = document.getElementById('trail'), cvO = document.getElementById('over');
let ctxT, ctxO, W = 0, H = 0, sc = 1, vx0 = 0, vx1 = P.Lx;
const p = { U: 2.5, Ue: 0.35, D: 0.175, s: 0.95 };
const F = new Field(); let builtKey = '';
const c = new Coconut();
let paused = false, surgeT = -1, respawnT = -1, Ueff = p.U, trail = [], simT = 0, errors = 0;

const NPART = matchMedia('(max-width: 640px)').matches ? 800 : 1800;
const px = new Float32Array(NPART), py = new Float32Array(NPART), age = new Float32Array(NPART);
function seed(i, anywhere) {
  do { px[i] = anywhere ? Math.random() * P.Lx : Math.random() * 0.4; py[i] = Math.random() * P.Ly; } while (inBoulder(px[i], py[i], 0.05));
  age[i] = Math.random() * 6;
}
for (let i = 0; i < NPART; i++) seed(i, true);

const X = (x) => (x - vx0) * sc, Y = (y) => (P.Ly - y) * sc;
function resize() {
  W = stage.clientWidth; const narrow = W < 640 && innerHeight > 500; // phones in portrait: zoom on the eddy
  vx0 = narrow ? 0.9 : 0; vx1 = narrow ? 8.7 : P.Lx;
  sc = W / (vx1 - vx0); H = Math.round(P.Ly * sc);
  ctxT = fit(cvT, W, H); ctxO = fit(cvO, W, H); ctxT.fillStyle = '#000'; ctxT.fillRect(0, 0, W, H);
}
let rzT = 0, lastIH = innerHeight; const onResize = () => { if (stage.clientWidth !== W || (innerHeight > 500) !== (lastIH > 500)) { lastIH = innerHeight; clearTimeout(rzT); rzT = setTimeout(resize, 120); } };
addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();

function surgeFactor(t) { // flood surge envelope: ramp 1.5 s, hold 5 s, decay 4 s
  if (t < 0) return 0; if (t < 1.5) return t / 1.5; if (t < 6.5) return 1; if (t < 10.5) return 1 - (t - 6.5) / 4; return 0;
}
function ensureField() {
  const key = Ueff.toFixed(2) + '|' + p.Ue.toFixed(3);
  if (key !== builtKey) { F.build(Ueff, p.Ue, protection(Ueff)); builtKey = key; }
}

// ---------- UI ----------
if (matchMedia('(max-width: 979px)').matches) document.getElementById('more')?.removeAttribute('open');
const fmt1 = (v) => v.toFixed(1), $ = (id) => document.getElementById(id);
bindSlider('U', (v) => v.toFixed(1) + ' m/s', (v) => { p.U = v; });
bindSlider('D', (v) => Math.round(v) + ' cm', (v) => { p.D = v / 100; });
bindSlider('s', (v) => v.toFixed(2), (v) => { p.s = v; });
bindSlider('Ue', (v) => v.toFixed(2) + ' m/s', (v) => { p.Ue = v; });
const setVal = (k, v) => { $(k).value = v; $(k).dispatchEvent(new Event('input')); };
const markChips = () => document.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', Math.abs(+b.dataset.s - p.s) < 0.005));
$('s').addEventListener('input', markChips); markChips();
document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => setVal('s', b.dataset.s)));
// "Break it" challenge cards: set up a scenario, then bring the sim into view
const defaults = () => { for (const [k, v] of [['U', 2.5], ['D', 17.5], ['s', 0.95], ['Ue', 0.35]]) setVal(k, v); surgeT = -1; };
const scenarios = {
  surge: () => { defaults(); c.reset(); trail = []; surgeT = 0; },
  fast: () => { defaults(); setVal('U', 4.5); c.reset(); trail = []; },
  heavy: () => { defaults(); setVal('s', 0.99); c.reset(); trail = []; },
  light: () => { defaults(); setVal('s', 0.80); c.reset(); trail = []; },
};
document.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
  scenarios[b.dataset.try]?.(); if (paused) $('pause').click();
  $('lab').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}));
// real-footage loop: respect reduced motion, offer pause
const clip = $('clip'), clipBtn = $('clip-toggle');
if (clip && clipBtn) {
  const sync = () => { const on = !clip.paused; clipBtn.textContent = on ? '❚❚ Pause' : '▶ Play'; clipBtn.setAttribute('aria-pressed', String(!on)); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { clip.removeAttribute('autoplay'); clip.pause(); }
  clip.addEventListener('play', sync); clip.addEventListener('pause', sync); sync();
  clipBtn.onclick = () => { if (clip.paused) clip.play().catch(() => {}); else clip.pause(); };
}
$('surge').onclick = () => { surgeT = 0; };
$('drop').onclick = () => { c.reset(); trail = []; respawnT = -1; };
$('pause').onclick = (e) => { paused = !paused; e.target.setAttribute('aria-pressed', paused); e.target.textContent = paused ? '▶ Play' : '❚❚ Pause'; };
$('reset').onclick = () => { defaults(); c.reset(); trail = []; };

// ---------- loop ----------
let last = performance.now(), onScreen = true;
new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(stage);
document.addEventListener('visibilitychange', () => { last = performance.now(); });
function frame(now) {
  if (!onScreen || document.hidden) { last = now; requestAnimationFrame(frame); return; }
  let dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  try {
    if (!paused) {
      if (surgeT >= 0) { surgeT += dt; if (surgeT > 10.5) surgeT = -1; }
      Ueff = p.U * (1 + 1.3 * surgeFactor(surgeT));
      ensureField();
      const n = Math.max(1, Math.round(dt * 120));
      if (dt > 0) for (let k = 0; k < n; k++) c.step(dt / n, F, { ...p, U: Ueff });
      simT += dt;
      if (trail.length === 0 || simT - trail[trail.length - 1][2] > 0.08) { trail.push([c.x, c.y, simT]); if (trail.length > 90) trail.shift(); }
      if (c.state !== 'trapped' && respawnT < 0 && (c.out || c.x > vx1 + 0.3)) respawnT = 2.5;
      if (respawnT >= 0) { respawnT -= dt; if (respawnT < 0) { c.reset(); trail = []; } }
      advect(dt);
    }
    draw(); hud();
  } catch (e) { errors++; console.error(e); }
  requestAnimationFrame(frame);
}
function advect(dt) {
  ctxT.fillStyle = 'rgba(0,0,0,0.085)'; ctxT.fillRect(0, 0, W, H);
  const buckets = [[], [], []];
  for (let i = 0; i < NPART; i++) {
    const x = px[i], y = py[i];
    const u = F.sample(F.u, x, y), v = F.sample(F.v, x, y);
    const xm = x + 0.5 * dt * u, ym = y + 0.5 * dt * v;
    const u2 = F.sample(F.u, xm, ym), v2 = F.sample(F.v, xm, ym);
    const nx = x + dt * u2 + (Math.random() - 0.5) * 0.004, ny = y + dt * v2 + (Math.random() - 0.5) * 0.004;
    age[i] -= dt;
    const sp = Math.hypot(u2, v2);
    if (nx > P.Lx || nx < 0 || ny < 0 || ny > P.Ly || age[i] < 0 || inBoulder(nx, ny)) { seed(i, age[i] < 0); continue; }
    buckets[sp < 0.6 ? 0 : sp < 1.8 ? 1 : 2].push(X(x), Y(y), X(nx), Y(ny));
    px[i] = nx; py[i] = ny;
  }
  const cols = ['rgba(90,190,255,0.9)', 'rgba(200,230,255,0.75)', 'rgba(238,255,65,0.85)'];
  ctxT.lineWidth = 1.3;
  buckets.forEach((b, k) => { ctxT.strokeStyle = cols[k]; ctxT.beginPath(); for (let j = 0; j < b.length; j += 4) { ctxT.moveTo(b[j], b[j + 1]); ctxT.lineTo(b[j + 2], b[j + 3]); } ctxT.stroke(); });
}
function draw() {
  const g = ctxO; g.clearRect(0, 0, W, H);
  // banks
  g.fillStyle = '#1b1b1b'; g.strokeStyle = '#666'; g.lineWidth = 1.5;
  const bank = Math.max(6, 0.12 * sc);
  g.fillRect(0, H - bank, W, bank); g.fillRect(0, 0, W, bank);
  wobblyLine(g, 0, H - bank, W, H - bank, 3, 2, 30); g.stroke(); wobblyLine(g, 0, bank, W, bank, 4, 2, 30); g.stroke();
  // eddy outline + labels
  g.setLineDash([6, 6]); g.strokeStyle = 'rgba(238,255,65,0.55)'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(X(P.xe0 + P.Le / 2), Y(P.W / 2), P.Le / 2 * sc, P.W / 2 * sc, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.font = HAND; g.fillStyle = '#EEFF41'; g.textAlign = 'left';
  const small = W < 640;
  g.font = (small ? '700 14px' : '700 18px') + ' Caveat, cursive';
  g.fillText(`lateral eddy ≈ ${p.Ue.toFixed(2)} m/s`, X(P.xe0 + 0.2), Y(P.W + 0.42));
  g.fillText(`fast chute ≈ ${Ueff.toFixed(1)} m/s →`, X(Math.max(vx0 + 0.3, 4.5)), Y(3.2));
  g.fillStyle = '#bbb'; g.fillText('shear layer', X(P.xe1 + 0.5), Y(P.ys + 0.25));
  g.fillText('boulder drop', X(P.xb - 0.9), Y(P.yb + P.rby + 0.25));
  g.fillStyle = '#777'; g.fillText('near bank', 6, H - bank - 4);
  // boulder
  const bp = []; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, rr = 1 + 0.08 * Math.sin(3 * a) + 0.05 * Math.cos(5 * a); bp.push([X(P.xb + P.rbx * rr * Math.cos(a)), Y(Math.max(-0.05, P.yb + P.rby * rr * Math.sin(a)))]); }
  g.fillStyle = '#5a5a5a'; wobblyPoly(g, bp, 7, 2); g.fill(); g.strokeStyle = '#EEFF41'; g.lineWidth = 2; wobblyPoly(g, bp, 8, 3); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { wobblyLine(g, X(P.xb - 0.4 + k * 0.2), Y(P.yb + 0.3), X(P.xb - 0.2 + k * 0.25), Y(P.yb - 0.2), 20 + k, 2, 4); g.stroke(); }
  // coconut trail
  if (trail.length > 1) { g.strokeStyle = 'rgba(255,170,90,0.55)'; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath(); trail.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke(); g.setLineDash([]); }
  // coconut
  const R = Math.max(5, p.D / 2 * sc * 1.0);
  g.save(); g.translate(X(c.x), Y(c.y)); g.rotate(-c.ang); g.globalAlpha = c.under ? 0.4 : 1;
  g.fillStyle = '#8a5a2b'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d9a066'; g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(0, 0, R * (0.35 + 0.13 * k), k, k + 2.2); g.stroke(); }
  g.strokeStyle = '#ff3b30'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, R + 2.5, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.font = (small ? '700 15px' : '700 19px') + ' Caveat, cursive'; g.fillStyle = '#ff3b30';
  g.fillText(c.under ? 'pulled under!' : 'coconut', X(c.x) + R + 4, Y(c.y) - R);
  // surge banner
  const sf = surgeFactor(surgeT);
  if (sf > 0) { g.fillStyle = `rgba(63,169,245,${0.18 * sf})`; g.fillRect(0, 0, W, H); g.fillStyle = '#3fa9f5'; g.font = '900 ' + (small ? 16 : 22) + 'px Archivo, sans-serif'; g.fillText('FLOOD SURGE  ×' + (1 + 1.3 * sf).toFixed(1), 12, bank + 26); }
  // side-view inset: buoyancy vs downwelling
  const iw = small ? 104 : 140, ih = small ? 70 : 96, ix = W - iw - 8, iy = bank + 6;
  g.fillStyle = 'rgba(0,0,0,0.78)'; g.strokeStyle = '#444'; g.lineWidth = 1; g.fillRect(ix, iy, iw, ih); g.strokeRect(ix, iy, iw, ih);
  const wl = iy + ih * 0.38; g.fillStyle = 'rgba(63,169,245,0.35)'; g.fillRect(ix + 1, wl, iw - 2, iy + ih - wl - 1);
  g.strokeStyle = '#3fa9f5'; g.beginPath(); g.moveTo(ix, wl); g.lineTo(ix + iw, wl); g.stroke();
  const Gm = floatGeom(p.D, p.s), rr = ih * 0.17 * (p.D / 0.175) ** 0.5;
  const sub = Math.min(1.3, (Gm.d + c.zeta) / (2 * Gm.R)); const cy = wl - rr + 2 * rr * sub;
  g.fillStyle = '#8a5a2b'; g.beginPath(); g.arc(ix + iw * 0.45, Math.min(cy, iy + ih - rr - 2), rr, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EEFF41'; g.strokeStyle = '#EEFF41'; g.lineWidth = 2; arrow(g, ix + iw * 0.78, wl + 22, ix + iw * 0.78, wl + 6, 6);
  g.fillStyle = '#ff9f1c'; g.strokeStyle = '#ff9f1c'; arrow(g, ix + iw * 0.9, wl + 4, ix + iw * 0.9, wl + 20, 6);
  g.fillStyle = '#ddd'; g.font = '600 10px Archivo, sans-serif'; g.fillText('side view', ix + 5, iy + 12);
  g.font = (small ? '600 9px' : '600 10px') + ' Archivo, sans-serif'; g.fillText(small ? `↑w_b ${Gm.wb.toFixed(2)} ↓w_d ${c.wd.toFixed(2)}` : `↑w_b ${Gm.wb.toFixed(2)}  ↓w_d ${c.wd.toFixed(2)} m/s`, ix + 4, iy + ih - 5);
}
function hud() {
  const n = numbers({ ...p, U: Ueff });
  const st = $('status');
  if (c.state === 'trapped') { st.className = 'status ok'; st.textContent = 'TRAPPED · ' + c.t.toFixed(0) + ' s'; }
  else { st.className = 'status bad'; st.textContent = (c.out ? 'ESCAPED' : 'ESCAPING') + ' after ' + (c.escT ?? c.t).toFixed(1) + ' s'; }
  $('n-re').textContent = (n.Re / 1e3).toFixed(0) + 'k';
  $('n-fr').textContent = n.Fr.toFixed(2);
  $('n-dr').textContent = n.dragRatio > 999 ? '∞' : n.dragRatio.toFixed(0) + '×';
  const bm = n.wb / Math.max(1e-6, c.wd); $('n-bm').textContent = bm > 9.9 ? '>10' : bm.toFixed(2); $('n-bm').style.color = bm < 1 ? '#ff9f1c' : bm < 1.5 ? '#ffd166' : '';
  $('n-wd').textContent = (n.wb / n.wd).toFixed(2);
  $('n-frt').textContent = n.FrToe.toFixed(1);
  $('n-tx').textContent = n.Tex.toFixed(0) + ' s';
  $('n-m').textContent = n.mass.toFixed(2) + ' kg';
  $('n-prot').textContent = Math.round(protection(Ueff) * 100) + '%';
  $('n-fb').textContent = (n.freeboard * 100).toFixed(1) + ' cm';
  $('n-u').textContent = Math.hypot(c.vx, c.vy).toFixed(2) + ' m/s';
  window.__lab = { state: c.state, t: c.t, x: c.x, y: c.y, under: c.under, Ueff, errors, p: { ...p } };
}
requestAnimationFrame(frame);
