// tiny helpers for hand-drawn looking strokes
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function wobblyPoly(ctx, pts, seed = 1, amp = 1.5, close = true) {
  const r = rng(seed); ctx.beginPath();
  pts.forEach((p, i) => { const x = p[0] + (r() - 0.5) * amp, y = p[1] + (r() - 0.5) * amp; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  if (close) ctx.closePath();
}
export function wobblyLine(ctx, x0, y0, x1, y1, seed = 1, amp = 1.2, n = 8) {
  const r = rng(seed); ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) { const t = i / n; ctx.lineTo(x0 + (x1 - x0) * t + (i < n ? (r() - 0.5) * amp : 0), y0 + (y1 - y0) * t + (i < n ? (r() - 0.5) * amp : 0)); }
}
export function arrow(ctx, x0, y0, x1, y1, head = 8) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function fit(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
}
export function bindSlider(id, fmt, onChange) {
  const el = document.getElementById(id), out = document.getElementById(id + '-v');
  const upd = () => { const v = parseFloat(el.value); if (out) out.textContent = fmt(v); onChange(v); };
  el.addEventListener('input', upd); upd(); return el;
}
export const HAND = '700 17px Caveat, cursive';
