"""Generate the theory-page figures as site-style inline SVG (black, lime, red = coconut).
Run: python3 scripts/figures.py  -> src/figs/*.svg  (numbers mirror the offline analysis, all estimates)."""
import math, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'figs'); os.makedirs(OUT, exist_ok=True)
LIME, RED, MUT, FG, WATER, BLUE = '#EEFF41', '#ff3b30', '#8a8a8a', '#e8e8e8', '#0d2a3d', '#5abeff'
g, R, CD = 9.81, 0.0875, 0.5

def svg(name, w, h, body, title):
    import re
    cols = sorted(set(re.findall(r'MARK\[(#[0-9a-fA-F]+)\]', body)))
    defs = ''.join(f'<marker id="ah-{name}-{c[1:]}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{c}"/></marker>' for c in cols)
    body = re.sub(r'MARK\[#([0-9a-fA-F]+)\]', lambda m: f'url(#ah-{name}-{m.group(1)})', body)
    s = (f'<svg class="fig-svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="t-{name}" xmlns="http://www.w3.org/2000/svg">'
         f'<title id="t-{name}">{title}</title><defs>{defs}</defs>' + body + '</svg>\n')
    open(os.path.join(OUT, name + '.svg'), 'w').write(s)

FS = 1.3  # text scale so labels stay legible when the figure shrinks to a 360px phone
def t(x, y, s, cls='', anchor='start', fill=FG, size=None, extra=''):
    sz = f' font-size="{round(size * FS)}"' if size else ''
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{cls}" text-anchor="{anchor}" fill="{fill}"{sz} {extra}>{s}</text>'
def line(x0, y0, x1, y1, c=FG, w=2.5, arrow=False, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    a = f' marker-end="MARK[{c}]"' if arrow else ''
    return f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"{d}{a}/>'
def path(d, c=FG, w=2.5, fill='none', arrow=False, dash=None, op=1):
    da = f' stroke-dasharray="{dash}"' if dash else ''
    a = f' marker-end="MARK[{c}]"' if arrow else ''
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="{fill}" stroke-linecap="round" stroke-linejoin="round" opacity="{op}"{da}{a}/>'
def coconut(x, y, r):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#7a4a22" stroke="{RED}" stroke-width="3"/>'
            f'<path d="M{x-r*.5} {y-r*.2} q{r*.5} {-r*.5} {r} 0" stroke="#c48a55" stroke-width="1.6" fill="none"/>')

# ---------- 1. plan view: boulder, jet, lateral eddy, shear layer ----------
b = []
b.append(f'<rect x="0" y="0" width="640" height="400" fill="{WATER}" opacity=".55"/>')
b.append(f'<rect x="0" y="372" width="640" height="28" fill="#1a1a1a"/><rect x="0" y="0" width="640" height="22" fill="#1a1a1a"/>')
b.append(t(10, 392, 'near bank', size=15, fill=MUT)); b.append(t(10, 16, 'far bank', size=15, fill=MUT))
b.append(path('M88 372 C 80 300, 120 250, 175 252 C 230 255, 250 310, 245 372 Z', MUT, 2.5, '#5a5a5a'))
b.append(t(166, 330, 'boulder', 'hand', 'middle', size=24))
for y in [70, 120, 170, 215]:
    b.append(line(20, y, 610, y + (12 if y > 160 else 0), LIME, 2.5, True))
b.append(t(330, 60, 'fast jet / chute  U ≈ 2.5 m/s', 'hand', 'middle', LIME, 25))
b.append(path('M250 258 C 330 250, 420 252, 520 262', '#ffffff', 2, dash='7 7'))
b.append(t(528, 258, 'shear layer', 'hand', fill='#ffffff', size=22))
b.append(path('M300 340 C 280 300, 330 278, 400 280 C 470 282, 500 310, 480 340 C 460 362, 330 366, 300 340', LIME, 2.2, arrow=True, op=.75))
b.append(t(520, 330, 'lateral eddy', 'hand', fill=LIME, size=22)); b.append(t(520, 352, 'Uₑ ≈ 0.35 m/s', fill=LIME, size=15))
b.append(coconut(352, 318, 11)); b.append(t(352, 304, 'coconut', 'hand', 'middle', RED, 21))
b.append(line(258, 372, 258, 262, '#bbb', 1.5, True)); b.append(line(258, 262, 258, 372, '#bbb', 1.5, True))
b.append(t(266, 368, 'W ≈ 1.2 m', size=15, fill='#bbb'))
b.append(path('M245 384 L 520 384', '#bbb', 1.5)); b.append(t(382, 398, 'L ≈ 2.5 m (≈ 2 boulder sizes) to reattachment', 'small', 'middle', '#bbb', 13))
b.append(t(612, 140, 'flow', 'hand', 'end', LIME, 20))
svg('plan', 640, 400, ''.join(b), 'Plan view: the boulder blocks the near bank, the fast jet separates from it, and a slow lateral eddy of width W fills its lee. The coconut circles inside the eddy, bounded by the shear layer.')

# ---------- 2. cross-section at the shear line: convergence + downwelling ----------
b = []
b.append(f'<rect x="0" y="120" width="640" height="230" fill="{WATER}" opacity=".7"/>')
b.append(line(0, 120, 640, 120, BLUE, 2.5)); b.append(t(10, 112, 'free surface', size=15, fill=BLUE))
b.append(path('M0 350 L640 350', MUT, 3)); b.append(t(630, 372, 'river bed', size=15, fill=MUT, anchor='end'))
for x in [40, 90, 140]: b.append(line(x, 140, x + 40, 140, '#bbb', 2, True))
b.append(t(24, 175, 'eddy side (slow)', size=16, fill='#bbb'))
for x in [440, 520]: b.append(line(x + 110, 140, x + 20, 140, LIME, 3, True))
b.append(t(616, 175, 'jet side (fast)', size=16, fill=LIME, anchor='end'))
b.append(path('M330 140 C 330 200, 330 250, 300 320', LIME, 3, arrow=True))
b.append(path('M360 140 C 362 200, 370 250, 410 320', LIME, 3, arrow=True))
b.append(t(372, 245, 'downwelling', 'hand', fill=LIME, size=24)); b.append(t(372, 268, 'w_d ≈ 0.3 U ≈ 0.75 m/s', size=15, fill=LIME))
b.append(path('M300 330 C 200 345, 100 330, 60 300', '#bbb', 2, arrow=True, dash='5 6'))
b.append(path('M420 330 C 500 345, 580 335, 620 320', '#bbb', 2, arrow=True, dash='5 6'))
b.append(t(160, 300, 'underflow', 'hand', 'middle', '#bbb', 21))
b.append(coconut(255, 118, 28))
b.append(line(225, 92, 225, 40, LIME, 3, True)); b.append(t(218, 50, 'rise speed w_b', anchor='end', size=16, fill=LIME))
b.append(line(290, 60, 290, 100, RED, 3, True)); b.append(t(298, 56, 'pull-down', size=16, fill=RED))
b.append(t(20, 228, 'coconut on the shear line', 'hand', 'start', RED, 21))
svg('downwelling', 640, 380, ''.join(b), 'Cross-section through the shear line: slow eddy water and fast jet water converge at the surface and dive down at w_d, then leave as underflow. A floating coconut resists with its buoyant rise speed w_b.')

# ---------- chart helper ----------
def chart(name, title, xr, yr, xl, yl, series, ann, w=640, h=400, xticks=None, yticks=None, log=False):
    L, Rm, T, B = 66, 20, 20, 58
    pw, ph = w - L - Rm, h - T - B
    X = lambda x: L + (x - xr[0]) / (xr[1] - xr[0]) * pw
    Y = lambda y: T + ph - (y - yr[0]) / (yr[1] - yr[0]) * ph
    o = [f'<rect x="{L}" y="{T}" width="{pw}" height="{ph}" fill="#070707" stroke="#2a2a2a"/>']
    for xt in xticks: o.append(line(X(xt), T, X(xt), T + ph, '#1d1d1d', 1)); o.append(t(X(xt), T + ph + 22, f'{xt:g}', anchor='middle', size=15, fill=MUT))
    for yt in yticks: o.append(line(L, Y(yt), L + pw, Y(yt), '#1d1d1d', 1)); o.append(t(L - 8, Y(yt) + 5, f'{yt:g}', anchor='end', size=15, fill=MUT))
    o.append(t(L + pw / 2, h - 10, xl, anchor='middle', size=16, fill='#cfcfcf'))
    o.append(t(16, T + ph / 2, yl, anchor='middle', size=16, fill='#cfcfcf', extra=f'transform="rotate(-90 16 {T + ph / 2})"'))
    for s in series: o.append(s(X, Y))
    for a in ann: o.append(a(X, Y))
    svg(name, w, h, ''.join(o), title)
    return X, Y
def poly(pts, X, Y): return 'M' + ' L'.join(f'{X(x):.1f} {Y(y):.1f}' for x, y in pts)

# ---------- 3. residence time ----------
W, clip = 1.2, 13.8
Us = [1 + i * 0.05 for i in range(91)]
lbm = [(1, 20.4), (1.5, 14.8), (2, 11.4), (2.5, 9.95), (3, 10.1), (4, 7.2), (5, 6.6)]
def band(X, Y):
    up = [(u, min(60, W / (0.015 * u))) for u in Us]; lo = [(u, W / (0.04 * u)) for u in Us[::-1]]
    return path(poly(up + lo, X, Y) + ' Z', 'none', 0, LIME, op=.13)
chart('residence', 'Residence time in the eddy versus jet speed: T = W/(kU). At 2.5 m/s the estimate is about 19 s; escaping within the 13.8 s clip needs U of about 3.5 m/s (2.2 to 5.8 m/s across the plausible range of k).',
      (1, 5.5), (0, 60), 'jet speed U [m/s]', 'residence time T [s]',
      [band, lambda X, Y: path(poly([(u, min(60, W / (0.025 * u))) for u in Us], X, Y), LIME, 3),
       lambda X, Y: ''.join(f'<circle cx="{X(u):.1f}" cy="{Y(v):.1f}" r="5" fill="{BLUE}"/>' for u, v in lbm),
       lambda X, Y: line(X(1), Y(clip), X(5.5), Y(clip), '#ffffff', 1.8, dash='7 6')],
      [lambda X, Y: t(X(5.45), Y(clip) - 8, 'clip length 13.8 s', anchor='end', size=15, fill='#fff'),
       lambda X, Y: f'<circle cx="{X(2.5)}" cy="{Y(19.2)}" r="7" fill="none" stroke="{RED}" stroke-width="3"/>' + t(X(2.5) + 12, Y(19.2) - 10, 'filmed: T ≈ 19 s', size=15, fill=RED),
       lambda X, Y: line(X(3.48), Y(clip), X(3.48), Y(0), LIME, 1.5, dash='3 5') + t(X(3.48) + 6, Y(3), 'U ≈ 3.5 m/s', size=15, fill=LIME),
       lambda X, Y: t(X(1.25), Y(52), 'k = 0.025 (band: 0.015–0.04)', size=15, fill=LIME),
       lambda X, Y: f'<circle cx="{X(1.3)}" cy="{Y(46.5)}" r="5" fill="{BLUE}"/>' + t(X(1.3) + 12, Y(45.2), '2-D lattice-Boltzmann + particles (mean)', size=15, fill=BLUE)],
      xticks=[1, 2, 3, 4, 5], yticks=[0, 10, 20, 30, 40, 50, 60])

# ---------- 4. rise speed vs density ratio ----------
ss = [0.5 + i * 0.005 for i in range(100)]
wb = lambda s: math.sqrt(8 / 3 * g * R * (1 - s) / CD)
sstar = 1 - 0.75 ** 2 * CD / (8 / 3 * g * R)
chart('rise', 'Buoyant rise speed of a 17.5 cm sphere versus density ratio s, compared with the 0.75 m/s downwelling. Below s* ≈ 0.88 it wins; at the assumed s = 0.95 it rises at only 0.48 m/s.',
      (0.5, 1.0), (0, 1.6), 'density ratio s = ρ_c / ρ_w', 'speed [m/s]',
      [lambda X, Y: path(poly([(s, 0.75) for s in [sstar, 1.0]], X, Y) + f' L{X(1.0)} {Y(0)} L{X(sstar)} {Y(0)} Z', 'none', 0, '#ffffff', op=.06),
       lambda X, Y: path(poly([(s, wb(s)) for s in ss], X, Y), LIME, 3),
       lambda X, Y: line(X(0.5), Y(0.75), X(1.0), Y(0.75), '#ffffff', 2, dash='7 6')],
      [lambda X, Y: t(X(0.52), Y(0.75) - 10, 'downwelling w_d ≈ 0.75 m/s', size=15, fill='#fff'),
       lambda X, Y: t(X(0.63), Y(1.5), 'rise speed w_b = √(8gR(1−s)/(3C_D))', size=15, fill=LIME),
       lambda X, Y: line(X(sstar), Y(0), X(sstar), Y(0.75), LIME, 1.5, dash='3 5') + t(X(sstar) - 6, Y(0.08), f's* ≈ {sstar:.2f}', anchor='end', size=15, fill=LIME),
       lambda X, Y: f'<circle cx="{X(0.95)}" cy="{Y(wb(0.95))}" r="7" fill="none" stroke="{RED}" stroke-width="3"/>' + t(X(0.95) - 24, Y(wb(0.95)) + 40, 'assumed s = 0.95 → 0.48 m/s', anchor='end', size=15, fill=RED),
       lambda X, Y: t(X(0.94), Y(1.0), 'pulled', anchor='middle', size=15, fill='#bbb') + t(X(0.94), Y(0.92), 'under', anchor='middle', size=15, fill='#bbb')],
      xticks=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0], yticks=[0, 0.4, 0.8, 1.2, 1.6])

# ---------- 5. free-body diagram ----------
b = []
cx, cy, r = 300, 200, 70
b.append(f'<rect x="0" y="{cy - 22}" width="640" height="{450 - cy + 22}" fill="{WATER}" opacity=".7"/>')
b.append(line(0, cy - 22, 640, cy - 22, BLUE, 2.5)); b.append(t(14, cy - 32, 'free surface', size=15, fill=BLUE))
b.append(coconut(cx, cy, r)); b.append(f'<circle cx="{cx}" cy="{cy}" r="4" fill="#fff"/>'); b.append(t(cx + 8, cy + 20, 'G', size=16))
b.append(line(cx, cy, cx, 40, LIME, 3.5, True)); b.append(t(cx + 10, 52, 'buoyancy F_B = ρ g V_sub', size=16, fill=LIME))
b.append(line(cx, cy, cx, 390, '#ffffff', 3.5, True)); b.append(t(cx - 12, 386, 'weight W = m g', anchor='end', size=16, fill='#fff'))
b.append(line(cx, cy + 22, cx + 170, cy + 22, LIME, 3.5, True)); b.append(t(cx + 176, cy + 28, 'jet drag F_D', size=16, fill=LIME))
b.append(line(cx, cy + 4, cx - 165, cy + 4, '#bbb', 3, True)); b.append(t(cx - 172, cy + 10, 'return drag', anchor='end', size=16, fill='#bbb'))
b.append(line(cx + 30, cy + 40, cx + 100, cy + 150, RED, 3.5, True)); b.append(t(cx + 60, cy + 186, 'downwelling drag F_down', size=16, fill=RED))
b.append(path(f'M{cx - 40} {cy + 92} A 98 98 0 0 1 {cx - 98} {cy + 30}', '#ffffff', 2.5, arrow=True))
b.append(t(cx - 60, cy + 128, 'spin ω, L = Iω', 'hand', 'end', fill='#fff', size=22))
b.append(t(20, 436, 'added mass C_A ρ V_sub moves with it · torque from the shear', size=14, fill=MUT))
svg('fbd', 640, 450, ''.join(b), 'Free-body diagram of the floating coconut: buoyancy up, weight down, drag from the jet on one side and from the eddy return current on the other, a downward drag where the water dives, and a spin from the shear.')

# ---------- 6. spin-down ----------
I = 0.30 * 0.95 * 1000 * 4 / 3 * math.pi * R ** 3 * R ** 2
tau = lambda w0: 2 * I / (0.1 * 1000 * R ** 5 * w0)
ts = [i * 0.05 for i in range(161)]
chart('spin', 'Spin-down after leaving the shear layer: with a turbulent (quadratic) moment the spin decays like ω0/(1+t/τ), τ ≈ 1.5 s for ω0 ≈ 16 rad/s and ≈ 2.7 s for 9 rad/s. Viscous (Stokes) friction alone would take minutes.',
      (0, 8), (0, 17), 'time after leaving the shear layer t [s]', 'spin ω [rad/s]',
      [lambda X, Y: path(poly([(x, 16.3) for x in [0, 8]], X, Y), '#ffffff', 1.8, dash='7 6'),
       lambda X, Y: path(poly([(x, 16.3 / (1 + x / tau(16.3))) for x in ts], X, Y), LIME, 3),
       lambda X, Y: path(poly([(x, 9 / (1 + x / tau(9))) for x in ts], X, Y), BLUE, 3)],
      [lambda X, Y: t(X(7.9), Y(16.3) - 8, 'viscous only: τ ≈ 6 min', anchor='end', size=15, fill='#fff'),
       lambda X, Y: t(X(1.0), Y(8.6), f'ω0 = 16 rad/s, τ ≈ {tau(16.3):.1f} s', size=15, fill=LIME),
       lambda X, Y: t(X(3.0), Y(5.6), f'ω0 = 9 rad/s, τ ≈ {tau(9):.1f} s', size=15, fill=BLUE)],
      xticks=[0, 2, 4, 6, 8], yticks=[0, 4, 8, 12, 16])

# ---------- 7. plunge + submerged hydraulic jump + control volume ----------
b = []
b.append(path('M0 120 L150 120 L150 360 L0 360 Z', MUT, 2, '#4a4a4a')); b.append(t(75, 250, 'boulder', 'hand', 'middle', size=22))
b.append(path('M0 100 L150 100 C 175 102, 190 180, 205 330 L 260 330 C 300 300, 340 160, 400 150 L 640 150 L 640 360 L 150 360 L 150 120 L 0 120 Z', 'none', 0, WATER))
b.append(path('M0 100 L150 100 C 175 102, 190 180, 205 330', BLUE, 2.5)); b.append(path('M150 120 C 165 140, 175 220, 185 330', BLUE, 1.5))
b.append(path('M260 330 C 300 300, 340 160, 400 150 L 640 150', BLUE, 2.5))
b.append(line(20, 92, 110, 92, LIME, 3, True)); b.append(t(20, 80, 'U₁ ≈ 2.5 m/s, y₁ ≈ 0.15 m, Fr₁ ≈ 2', size=15, fill=LIME))
b.append(line(200, 345, 255, 345, LIME, 3, True)); b.append(t(20, 392, 'toe: U ≈ 4.6 m/s, y ≈ 8 cm, Fr ≈ 5.1', size=15, fill=LIME))
b.append(path('M300 210 C 260 170, 230 220, 270 250 C 300 270, 330 240, 315 215', '#fff', 2, arrow=True)); b.append(t(330, 200, 'roller', 'hand', fill='#fff', size=22))
b.append(f'<rect x="185" y="125" width="260" height="235" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="7 6"/>')
b.append(t(190, 118, 'control volume', size=14, fill='#fff'))
b.append(line(600, 150, 600, 360, '#bbb', 1.5, True)); b.append(line(600, 360, 600, 150, '#bbb', 1.5, True))
b.append(t(592, 300, 'pool ≈ 0.8 m', anchor='end', size=15, fill='#bbb'))
b.append(line(470, 360, 470, 222, LIME, 1.5, dash='4 5')); b.append(t(470, 212, 'conjugate y₂ ≈ 0.55 m', anchor='middle', size=15, fill=LIME))
b.append(line(380, 222, 560, 222, LIME, 1.5, dash='4 5'))
b.append(line(490, 335, 580, 335, LIME, 3, True))
b.append(path('M0 360 L640 360', MUT, 3)); b.append(t(20, 428, 'pool ≈ 0.8 m > y₂ ≈ 0.55 m → drowned (submerged) jump', size=15, fill='#fff'))
svg('jump', 640, 445, ''.join(b), 'Side view of the plunge: the chute (Fr about 2) accelerates down the 0.75 m drop to a toe with Fr about 5.1. Its conjugate depth is 0.55 m, but the pool is about 0.8 m deep, so the jump is drowned into a submerged roller.')

# ---------- 8. control volume around the coconut ----------
b = []
b.append(f'<rect x="150" y="60" width="340" height="250" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="8 6"/>')
b.append(t(155, 50, 'control volume CV (moves with the coconut)', size=15, fill='#fff'))
for y in [95, 145, 195, 245, 285]:
    b.append(line(40, y, 140, y, LIME, 2.5, True)); b.append(line(500, y, 600, y, LIME, 2.5, True))
b.append(coconut(320, 185, 60))
b.append(t(80, 345, 'momentum in', 'hand', 'middle', LIME, 22)); b.append(t(550, 345, 'momentum out', 'hand', 'middle', LIME, 22))
b.append(t(320, 345, 'surface CS, outward normal n', 'small', 'middle', MUT, 14))
svg('cv', 640, 360, ''.join(b), 'Control volume drawn around the coconut: the net force equals the rate of change of momentum inside plus the net momentum flux through its surface.')
print('figures ->', sorted(os.listdir(OUT)))
