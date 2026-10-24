// End-to-end checks (Playwright). Mobile is the primary target.
//   npm run test:e2e      serves ./dist on a random port
//   npm run test:pages    same, served under /coconut-lab/ like GitHub Pages
//   npm run test:live     against https://andreolf.github.io/coconut-lab/
// Env: BASE (url), SUBPATH, NO_SHOTS=1, SHOT_PREFIX, ONLY=comma list of device ids
import { chromium, webkit, devices } from 'playwright';
import { serve } from './static-server.mjs';
const OTHER = 'subak-lab';
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await serve(new URL('../dist/', import.meta.url).pathname, process.env.SUBPATH || ''); BASE = server.url; }
BASE = BASE.replace(/\/$/, '');
const SHOTS = process.env.NO_SHOTS ? null : new URL('../screenshots/', import.meta.url).pathname;
const PFX = process.env.SHOT_PREFIX || '';
console.log('testing', BASE);

const android360 = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent, defaultBrowserType: 'chromium' };
const DEVICES = [
  ['desktop-1280', { viewport: { width: 1280, height: 900 }, defaultBrowserType: 'chromium' }],
  ['iphone13', devices['iPhone 13']],
  ['iphone14', devices['iPhone 14']],
  ['pixel7', devices['Pixel 7']],
  ['android360', android360],
  ['iphone13-landscape', devices['iPhone 13 landscape']],
  ['pixel7-landscape', devices['Pixel 7 landscape']],
].filter(([id]) => !process.env.ONLY || process.env.ONLY.split(',').includes(id));

const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
const browsers = {};
async function browserFor(type) {
  if (!(type in browsers)) { try { browsers[type] = await (type === 'webkit' ? webkit : chromium).launch(); } catch (e) { browsers[type] = null; console.log(`! ${type} unavailable: ${String(e).split('\n')[0]}`); } }
  return browsers[type];
}
function watch(p) {
  p._errs = []; p._bad = [];
  p.on('console', (m) => { if (m.type() === 'error') p._errs.push(m.text()); });
  p.on('pageerror', (e) => p._errs.push(String(e)));
  p.on('response', (r) => { if (r.status() >= 400) p._bad.push(r.status() + ' ' + r.url()); });
  p.on('requestfailed', (r) => { const u = r.url(); if (!/\.(mp4|webm)(\?|$)/.test(u)) p._bad.push('failed ' + u + ' ' + (r.failure()?.errorText || '')); });
  return p;
}
const lab = (p) => p.evaluate(() => window.__lab);
const setRange = (p, id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }, [id, v]);
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = (p, name, opts = {}) => SHOTS ? p.screenshot({ path: SHOTS + PFX + name, ...opts }) : null;
const waitState = async (p, pred, tries = 24) => { let s; for (let i = 0; i < tries; i++) { await p.waitForTimeout(500); s = await lab(p); if (pred(s)) return [true, s]; } return [false, s]; };
// interactive elements that must be ≥44×44 CSS px on touch devices (inline prose links are exempt, as in WCAG 2.5.8)
const SMALL_TARGETS = () => [...document.querySelectorAll('button, .btn, .tabs a, button.chip, a.chip, input[type=range], summary, .toc a, .site-foot ul a, .tool .links a, .steps a, .foot-also, .next a')]
  .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary)'); })
  .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || (r.width < 43.5 && !e.matches('input')); })
  .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].join('.')}"${(e.textContent || '').trim().slice(0, 18)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);

async function commonChecks(p, tag, resp, touch) {
  ok(`${tag}: HTTP 200`, resp && resp.status() === 200, String(resp && resp.status()));
  ok(`${tag}: all assets load`, p._bad.length === 0, p._bad.join(' | '));
  ok(`${tag}: self-hosted font + stylesheet`, await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Archivo') && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'; }));
  const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  ok(`${tag}: no root-absolute links`, !hrefs.some((x) => x.startsWith('/') && !x.startsWith('//')));
  const footerOnly = await p.$$eval(`a[href*="${OTHER}"]`, (as) => as.length === 1 && as.every((a) => a.closest('footer') && a.href === 'https://andreolf.github.io/subak-lab/'));
  ok(`${tag}: standalone, one footer link to subak-lab`, footerOnly && !hrefs.some((x) => /subak\.html/.test(x)));
  ok(`${tag}: nav Lab / Theory / Tools`, (await p.$$eval('.tabs a', (as) => as.map((a) => a.textContent.trim()).join('|'))) === 'Lab|Theory|Tools');
  ok(`${tag}: honest disclaimer`, /simplified, educational approximation/.test(await p.textContent('footer')));
  const og = await p.getAttribute('meta[property="og:image"]', 'content');
  ok(`${tag}: absolute og:image`, og === 'https://andreolf.github.io/coconut-lab/assets/og-coconut.jpg', og);
  ok(`${tag}: no horizontal overflow`, await noOverflow(p));
  if (touch) { const small = await p.evaluate(SMALL_TARGETS); ok(`${tag}: touch targets ≥44px`, small.length === 0, small.slice(0, 6).join(' ; ')); }
}

for (const [id, dev] of DEVICES) {
  const type = dev.defaultBrowserType || 'chromium'; const b = await browserFor(type);
  if (!b) { results.push(['SKIP', `${id}: ${type} not available on this host`, '']); continue; }
  const { defaultBrowserType, ...opts } = dev; const touch = !!opts.hasTouch; const land = id.includes('landscape'); const desk = id.startsWith('desktop');
  const ctx = await b.newContext(opts); const vh = opts.viewport.height;

  // ---- lab (landing page)
  {
    const p = watch(await ctx.newPage()); const resp = await p.goto(`${BASE}/`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    const tag = `lab @${id}`; await commonChecks(p, tag, resp, touch);
    const s0 = await lab(p); ok(`${tag}: sim running`, s0 && s0.t > 0.3, JSON.stringify(s0 && { t: s0.t }));
    const geo = await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { stage: r('#stage'), surge: r('#surge'), status: r('#status') }; });
    ok(`${tag}: sim visible in first screen`, geo.stage.top < vh * 0.5 && geo.stage.height > 120, `stageTop=${Math.round(geo.stage.top)} h=${Math.round(geo.stage.height)} vh=${vh}`);
    ok(`${tag}: status + flood-surge visible without scrolling`, geo.surge.bottom <= vh && geo.status.top >= 0, `surgeBottom=${Math.round(geo.surge.bottom)} vh=${vh}`);
    const imgs = await p.$$eval('img', (is) => is.map((i) => [i.getAttribute('src'), i.complete, i.naturalWidth]));
    await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => i.scrollIntoView())); await p.waitForTimeout(800);
    ok(`${tag}: photos load`, (await p.$$eval('img', (is) => is.every((i) => i.complete && i.naturalWidth > 0))), JSON.stringify(imgs));
    ok(`${tag}: coconut highlighted in red on the photo`, (await p.$$eval('.shot svg.anno circle[stroke="#ff3b30"]', (c) => c.length)) >= 2);
    if (type === 'chromium') ok(`${tag}: real-footage loop plays`, await p.evaluate(async () => { const v = document.getElementById('clip'); for (let i = 0; i < 20 && v.readyState < 2; i++) await new Promise((r) => setTimeout(r, 250)); return v.readyState >= 2 && !v.error; }));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
    if (!land) await shot(p, `lab-${id}.png`);
    // sim reacts: tap / click flood surge
    if (touch) await p.tap('#surge'); else await p.click('#surge');
    let [esc, s] = await waitState(p, (s) => s.state !== 'trapped');
    ok(`${tag}: flood surge frees the coconut`, esc, JSON.stringify(s));
    ok(`${tag}: ESCAPING indicator`, /ESCAP/.test(await p.textContent('#status')));
    if (land) await shot(p, `lab-${id}.png`);
    // pause off-screen: scroll to the footer, simulated time must stop
    await p.evaluate(() => document.querySelector('footer').scrollIntoView()); await p.waitForTimeout(600);
    const t1 = (await lab(p)).t; await p.waitForTimeout(1500); const t2 = (await lab(p)).t;
    ok(`${tag}: sim pauses off-screen`, Math.abs(t2 - t1) < 0.05, `${t1.toFixed(2)} -> ${t2.toFixed(2)}`);
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
    ok(`${tag}: sim resumes on-screen`, (await lab(p)).t > t2 + 0.3);
    // swiping over the canvas scrolls the page (no scroll hijack); CDP gesture = chromium only
    if (touch && type === 'chromium') {
      const cdp = await ctx.newCDPSession(p); const r = geo.stage;
      const x = Math.round(r.left + r.width / 2); let y = Math.round(r.top + r.height / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 0; i < 12; i++) { y -= 18; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(600); ok(`${tag}: swipe on the sim scrolls the page`, (await p.evaluate(() => scrollY)) > 100, String(await p.evaluate(() => scrollY)));
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    if (desk) {
      await p.waitForTimeout(10000); await p.click('#reset'); await p.waitForTimeout(12000);
      s = await lab(p); ok(`${tag}: default coconut stays trapped 12 s`, s.state === 'trapped', JSON.stringify(s));
      const nums = await p.evaluate(() => ['n-re', 'n-fr', 'n-dr', 'n-frt'].map((i) => document.getElementById(i).textContent));
      ok(`${tag}: Re, Fr, drag ratio, Fr_toe populated`, nums.every((x) => x && x !== '–') && nums[3] === '5.1', nums.join(' / '));
      await shot(p, `lab-stage-${id}.png`);
      await setRange(p, 'U', 4.5); await p.click('#drop'); [esc, s] = await waitState(p, (s) => s.state !== 'trapped', 20);
      ok(`${tag}: U = 4.5 m/s -> escaping`, esc, JSON.stringify(s));
      await p.click('[data-try="heavy"]'); [esc, s] = await waitState(p, (s) => s.state !== 'trapped', 120);
      ok(`${tag}: challenge "ρ = 0.99" -> pulled under / escapes`, esc && Math.abs(s.p.s - 0.99) < 1e-6, JSON.stringify(s));
      const re = await p.textContent('#n-re'); await setRange(p, 'D', 30); await p.waitForTimeout(250);
      ok(`${tag}: diameter slider changes Re`, re !== await p.textContent('#n-re'));
      ok(`${tag}: sim error counter 0`, s.errors === 0);
    }
    ok(`${tag}: no console errors`, p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }
  // ---- theory
  {
    const p = watch(await ctx.newPage()); const resp = await p.goto(`${BASE}/theory.html`, { waitUntil: 'load' }); await p.waitForTimeout(800);
    const tag = `theory @${id}`; await commonChecks(p, tag, resp, touch);
    const m = await p.evaluate(async () => { await document.fonts.ready; return { n: document.querySelectorAll('.katex').length, err: document.querySelectorAll('.katex-error').length, font: document.fonts.check('16px KaTeX_Main') && document.fonts.check('16px KaTeX_Math') }; });
    ok(`${tag}: math rendered by KaTeX (local fonts)`, m.n >= 100 && m.err === 0 && m.font, JSON.stringify(m));
    const figs = await p.$$eval('figure.fig svg.fig-svg', (s) => s.map((e) => Math.round(e.getBoundingClientRect().width)));
    ok(`${tag}: 8 figures render`, figs.length === 8 && figs.every((w) => w > 250), figs.join(','));
    const eqBox = await p.$$eval('.math-display', (ds) => ds.every((d) => getComputedStyle(d).overflowX === 'auto'));
    ok(`${tag}: equations scroll inside their own box`, eqBox);
    const toc = await p.$$eval('.toc a', (as) => as.every((a) => document.getElementById(a.getAttribute('href').slice(1))));
    ok(`${tag}: table of contents targets exist`, toc);
    ok(`${tag}: honest section on recalibrating 2.67 kg`, /2\.67/.test(await p.textContent('#honest')) && /recalibrat/i.test(await p.textContent('#honest')));
    if (!land) await shot(p, `theory-${id}.png`);
    await p.evaluate(() => document.getElementById('buoyancy').scrollIntoView()); await p.waitForTimeout(400);
    if (!land && (desk || id === 'iphone13')) await shot(p, `theory-section-${id}.png`);
    ok(`${tag}: no console errors`, p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }
  // ---- tools
  {
    const p = watch(await ctx.newPage()); const resp = await p.goto(`${BASE}/tools.html`, { waitUntil: 'load' }); await p.waitForTimeout(600);
    const tag = `tools @${id}`; await commonChecks(p, tag, resp, touch);
    ok(`${tag}: 9 tool cards + 5-step recipe`, (await p.$$eval('.tool', (t) => t.length)) === 9 && (await p.$$eval('.timeline li', (t) => t.length)) === 5);
    if (!land) await shot(p, `tools-${id}.png`);
    ok(`${tag}: no console errors`, p._errs.length === 0, p._errs.join(' | '));
    await p.close();
  }
  await ctx.close();
}
// ---- reduced motion: real-footage loop must not autoplay
{
  const b = await browserFor('chromium'); const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  const p = watch(await ctx.newPage()); await p.goto(`${BASE}/`); await p.waitForTimeout(1500);
  ok('reduced motion: video does not autoplay', await p.evaluate(() => document.getElementById('clip').paused));
  ok('reduced motion: no console errors', p._errs.length === 0, p._errs.join(' | '));
  await ctx.close();
}
for (const b of Object.values(browsers)) if (b) await b.close();
if (server) server.close();
for (const r of results) console.log(r.join('  '));
const f = results.filter((r) => r[0] === 'FAIL').length, sk = results.filter((r) => r[0] === 'SKIP').length;
console.log(`\n${results.length - f - sk}/${results.length - sk} passed${sk ? `, ${sk} skipped` : ''}`);
process.exit(f ? 1 : 0);
