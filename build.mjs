// Zero-runtime-dependency static build: src/ -> dist/
//  - inlines partials (<!--HEAD-->, <!--NAV-->, <!--FOOTER-->) and figures (<!--FIG:name-->)
//  - pre-renders math with KaTeX at build time: <tex>…</tex> inline, <texd>…</texd> display
//    (only CSS + woff2 fonts ship to the browser, no math JS at runtime)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const katex = createRequire(import.meta.url)('katex');
const src = 'src', out = 'dist';
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const part = (n) => readFileSync(`${src}/partials/${n}.html`, 'utf8');
const head = part('head'), nav = part('nav'), foot = part('footer');
const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let mathCount = 0;
const tex = (s, displayMode) => { mathCount++; return katex.renderToString(dec(s.trim()), { displayMode, throwOnError: true, output: 'html', strict: 'ignore' }); };
for (const f of readdirSync(src).filter((f) => f.endsWith('.html'))) {
  const key = f.replace('.html', '');
  let h = readFileSync(`${src}/${f}`, 'utf8');
  const usesMath = /<texd?>/.test(h);
  h = h.replace('<!--HEAD-->', head + (usesMath ? '\n<link rel="stylesheet" href="vendor/katex/katex.min.css">' : ''))
    .replace('<!--FOOTER-->', foot)
    .replace('<!--NAV-->', nav.replace(`data-k="${key}"`, `data-k="${key}" aria-current="page"`))
    .replace(/<!--FIG:([\w-]+)-->/g, (_, n) => readFileSync(`${src}/figs/${n}.svg`, 'utf8'))
    .replace(/<texd>([\s\S]*?)<\/texd>/g, (_, s) => `<div class="math-display">${tex(s, true)}</div>`)
    .replace(/<tex>([\s\S]*?)<\/tex>/g, (_, s) => tex(s, false));
  writeFileSync(`${out}/${f}`, h);
}
for (const d of ['js', 'assets']) cpSync(`${src}/${d}`, `${out}/${d}`, { recursive: true });
cpSync(`${src}/style.css`, `${out}/style.css`);
// KaTeX: CSS (woff2 only) + fonts
const kd = 'node_modules/katex/dist';
mkdirSync(`${out}/vendor/katex/fonts`, { recursive: true });
const css = readFileSync(`${kd}/katex.min.css`, 'utf8').replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)|,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '');
writeFileSync(`${out}/vendor/katex/katex.min.css`, css);
for (const f of readdirSync(`${kd}/fonts`).filter((f) => f.endsWith('.woff2'))) cpSync(`${kd}/fonts/${f}`, `${out}/vendor/katex/fonts/${f}`);
cpSync('node_modules/katex/LICENSE', `${out}/vendor/katex/LICENSE`);
writeFileSync(`${out}/404.html`, readFileSync(`${out}/index.html`, 'utf8'));
console.log('built ->', out, readdirSync(out).join(' '), `| ${mathCount} formulas`);
