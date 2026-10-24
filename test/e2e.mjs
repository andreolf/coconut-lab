// Headless verification (Playwright + Chromium), desktop 1280 and mobile 390.
//   npm run test:e2e                     builds nothing; serves ./dist on a random port and tests it
//   npm run test:pages                   same, but served under /coconut-lab/ like GitHub Pages
//   BASE=https://andreolf.github.io/coconut-lab SHOT_PREFIX=live- node test/e2e.mjs   tests the live site
import { chromium } from 'playwright';
import { serve } from './static-server.mjs';
const OTHER = 'subak-lab';
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await serve(new URL('../dist/', import.meta.url).pathname, process.env.SUBPATH || ''); BASE = server.url; }
BASE = BASE.replace(/\/$/, '');
const SHOTS = process.env.NO_SHOTS ? null : new URL('../screenshots/', import.meta.url).pathname;
const PFX = process.env.SHOT_PREFIX || '';
const shot = (p, name, opts = {}) => SHOTS ? p.screenshot({ path: SHOTS + PFX + name, ...opts }) : null;
console.log('testing', BASE);
const browser = await chromium.launch();
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
async function page(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage(); p._errs = []; p._bad = [];
  p.on('console', (m) => { if (m.type() === 'error') p._errs.push(m.text()); });
  p.on('pageerror', (e) => p._errs.push(String(e)));
  p.on('response', (r) => { if (r.status() >= 400) p._bad.push(r.status() + ' ' + r.url()); });
  p.on('requestfailed', (r) => p._bad.push('failed ' + r.url()));
  return p;
}
const lab = (p) => p.evaluate(() => window.__lab);
const setRange = (p, id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }, [id, v]);
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ---- landing (site root = the lab) + tools page: assets load under the (sub)path, standalone, disclaimer present
for (const [name, url] of [['root /', `${BASE}/`], ['tools', `${BASE}/tools.html`]]) {
  for (const [w, h, m] of [[1280, 900, false], [390, 844, true]]) {
    const p = await page(w, h, m); const resp = await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    const tag = `${name} @${w}`;
    ok(`${tag}: HTTP 200`, resp && resp.status() === 200, String(resp && resp.status()));
    ok(`${tag}: all assets load (no 4xx / failed requests)`, p._bad.length === 0, p._bad.join(' | '));
    const fontOk = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Archivo'); });
    ok(`${tag}: self-hosted font loaded`, fontOk);
    const css = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(`${tag}: stylesheet applied`, css === 'rgb(0, 0, 0)', css);
    const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    const abs = hrefs.filter((x) => x.startsWith('/') && !x.startsWith('//')); ok(`${tag}: no root-absolute links`, abs.length === 0, abs.join(' '));
    const cross = hrefs.filter((x) => /coconut\.html|subak\.html/.test(x) || (x.includes(OTHER) && !x.startsWith(`https://andreolf.github.io/${OTHER}/`)));
    const footerOnly = await p.$$eval(`a[href*="${OTHER}"]`, (as) => as.every((a) => a.closest('footer')));
    ok(`${tag}: standalone (other lab only linked from footer)`, cross.length === 0 && footerOnly, cross.join(' '));
    const txt = await p.textContent('body'); ok(`${tag}: honest educational disclaimer`, /simplified, educational approximation/.test(txt));
    if (name === 'root /') { ok(`${tag}: lab is the landing page`, !!(await lab(p)), ''); if (w === 1280) await shot(p, 'desktop-1280.png'); }
    if (name === 'tools' && w === 1280) await shot(p, 'tools-desktop-1280.png');
    ok(`${tag}: no horizontal overflow`, await noOverflow(p));
    ok(`${tag}: no console errors`, p._errs.length === 0, p._errs.join(' | '));
    await p.context().close();
  }
}

// ---- coconut desktop
{
  const p = await page(1280, 900); await p.goto(`${BASE}/index.html`); await p.waitForTimeout(12000);
  let s = await lab(p); ok('coconut default: trapped after 12 s', s.state === 'trapped', JSON.stringify(s));
  const st = await p.textContent('#status'); ok('coconut: TRAPPED indicator shown', /TRAPPED/.test(st), st);
  const nums = await p.evaluate(() => ['n-re', 'n-fr', 'n-dr'].map((id) => document.getElementById(id).textContent));
  ok('coconut: Re, Fr, drag ratio populated', nums.every((x) => x && x !== '–'), nums.join(' / '));
  await p.locator('#stage').scrollIntoViewIfNeeded(); await shot(p, 'coconut-stage-1280.png');
  await p.click('#surge'); let esc = false;
  for (let i = 0; i < 24 && !esc; i++) { await p.waitForTimeout(500); s = await lab(p); esc = s.state !== 'trapped'; }
  ok('coconut: flood surge -> escaping', esc, JSON.stringify(s));
  ok('coconut: ESCAPING indicator shown', /ESCAP|UNDER|GONE|AWAY/i.test(await p.textContent('#status')), await p.textContent('#status'));
  await shot(p, 'coconut-surge-1280.png');
  await p.waitForTimeout(9000); await p.click('#reset'); await p.waitForTimeout(500);
  await setRange(p, 'U', 4.5); await p.click('#drop'); esc = false;
  for (let i = 0; i < 20 && !esc; i++) { await p.waitForTimeout(500); s = await lab(p); esc = s.state !== 'trapped'; }
  ok('coconut: speed slider U=4.5 m/s -> escaping', esc, JSON.stringify(s));
  await setRange(p, 'U', 2.5); await setRange(p, 's', 0.99); await p.click('#drop'); esc = false;
  for (let i = 0; i < 120 && !esc; i++) { await p.waitForTimeout(500); s = await lab(p); esc = s.state !== 'trapped'; }
  ok('coconut: density slider s=0.99 (near neutral) -> pulled under / escapes within 60 s', esc, JSON.stringify(s));
  const reTxt = await p.textContent('#n-re'); await setRange(p, 'D', 30); await p.waitForTimeout(200);
  ok('coconut: diameter slider changes Re', reTxt !== await p.textContent('#n-re'), reTxt + ' -> ' + await p.textContent('#n-re'));
  ok('coconut desktop: no console errors', p._errs.length === 0 && s.errors === 0, p._errs.join(' | '));
  await p.context().close();
}
// ---- coconut mobile
{
  const p = await page(390, 844, true); await p.goto(`${BASE}/`); await p.waitForTimeout(6000);
  const s = await lab(p); ok('coconut mobile: trapped & running', s.state === 'trapped' && s.t > 3, JSON.stringify(s));
  ok('coconut mobile: no horizontal overflow', await noOverflow(p));
  await shot(p, 'mobile-390.png');
  await p.locator('#stage').scrollIntoViewIfNeeded(); await shot(p, 'coconut-stage-mobile-390.png');
  await p.tap('#surge'); let esc = false, s2;
  for (let i = 0; i < 24 && !esc; i++) { await p.waitForTimeout(500); s2 = await lab(p); esc = s2.state !== 'trapped'; }
  ok('coconut mobile: tap flood surge -> escaping', esc, JSON.stringify(s2));
  ok('coconut mobile: no console errors', p._errs.length === 0 && p._bad.length === 0, [...p._errs, ...p._bad].join(' | '));
  await p.context().close();
}

await browser.close(); if (server) server.close();
for (const r of results) console.log(r.join('  '));
const f = results.filter((r) => r[0] === 'FAIL').length; console.log(`\n${results.length - f}/${results.length} passed`);
process.exit(f ? 1 : 0);
