// Zero-dependency static build: src/ -> dist/ (inlines partials, copies assets)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
const src = 'src', out = 'dist';
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const part = (n) => readFileSync(`${src}/partials/${n}.html`, 'utf8');
const head = part('head'), nav = part('nav'), foot = part('footer');
for (const f of readdirSync(src).filter((f) => f.endsWith('.html'))) {
  const key = f.replace('.html', '');
  let h = readFileSync(`${src}/${f}`, 'utf8').replace('<!--HEAD-->', head).replace('<!--FOOTER-->', foot)
    .replace('<!--NAV-->', nav.replace(`data-k="${key}"`, `data-k="${key}" class="on" aria-current="page"`));
  writeFileSync(`${out}/${f}`, h);
}
for (const d of ['js', 'assets']) cpSync(`${src}/${d}`, `${out}/${d}`, { recursive: true });
cpSync(`${src}/style.css`, `${out}/style.css`);
writeFileSync(`${out}/404.html`, readFileSync(`${out}/index.html`, 'utf8'));
console.log('built ->', out, readdirSync(out).join(' '));
