// Coconut-in-an-eddy: reduced-order plan-view model (educational approximation).
// Numbers follow the offline reduced-order analysis (visual estimates from video, not measurements).
export const P = {
  rho: 1000, g: 9.81, nu: 1e-6,
  Lx: 12, Ly: 5,            // m, plan-view domain (x downstream, y across; y=0 = near bank)
  xb: 2.6, yb: 0.5, rbx: 0.8, rby: 0.75, // boulder (≈1.5 m) on the near bank
  W: 1.3, Le: 2.6,          // lateral eddy width / length behind boulder (≈2 boulder sizes)
  delta: 0.12,              // shear-layer half-thickness
  y1: 0.15,                 // chute depth (Fr)
  Hdrop: 0.75,              // boulder drop height to the plunge toe (assumed)
  CD: 0.5, CA: 0.5,         // drag & added-mass coefficients (assumed)
  k_ex: 0.025,              // dead-zone exchange coefficient E/U (Uijttewaal / Weitbrecht 0.01–0.04)
  beta_d: 0.30,             // downwelling at lateral shear line w_d = beta_d·U (assumed)
  turb: 0.07,               // turbulence intensity σ/U in the shear layer (assumed)
  TL: 0.4,                  // Lagrangian time scale [s]
  Ucrit: 3.2, Usweep: 4.4,  // boulder wake protection fades between these chute speeds (cf. U_crit≈3.5, sweep-out≈4.2 m/s)
};
P.xe0 = P.xb + 0.45; P.xe1 = P.xe0 + P.Le; P.ys = P.W + 0.08;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sig = (z) => 1 / (1 + Math.exp(-z));

export function protection(U) { // 1 = boulder fully shelters the eddy, →0.1 when swept out
  return 1 - 0.9 * sstep(P.Ucrit, P.Usweep, U);
}

export class Field {
  constructor(nx = 121, ny = 51) {
    this.nx = nx; this.ny = ny; this.hx = P.Lx / (nx - 1); this.hy = P.Ly / (ny - 1);
    this.psi = new Float32Array(nx * ny); this.u = new Float32Array(nx * ny); this.v = new Float32Array(nx * ny);
    this.ax = new Float32Array(nx * ny); this.ay = new Float32Array(nx * ny);
  }
  // U = chute speed past the boulder, Ue = eddy surface circulation speed, prot = protection factor
  build(U, Ue, prot) {
    const { nx, ny, hx, hy } = this; const S = new Float32Array(ny);
    // dead-zone mask along x: ramps up just upstream of the boulder, ends at reattachment
    const D = (x) => sstep(P.xb - P.rbx - 0.6, P.xb - P.rbx + 0.25, x) * (1 - sstep(P.xe1 - 0.2, P.xe1 + 1.4, x));
    // inlet speed such that chute speed at the boulder section == U
    let intB = 0; for (let j = 0; j < ny; j++) { const y = j * hy; intB += (1 - D(P.xb) * (1 - sig((y - P.ys) / P.delta))) * (j === 0 || j === ny - 1 ? 0.5 : 1) * hy; }
    const Uin = U * intB / P.Ly;
    this.Uin = Uin;
    const A = Ue * P.W / Math.PI;
    for (let i = 0; i < nx; i++) {
      const x = i * hx, d = D(x) * prot;
      let I = 0;
      for (let j = 0; j < ny; j++) { const y = j * hy; S[j] = 1 - d * (1 - sig((y - P.ys) / P.delta)) - 0.25 * sstep(P.Ly - 0.6, P.Ly, y); }
      let tot = 0; for (let j = 0; j < ny; j++) tot += S[j] * (j === 0 || j === ny - 1 ? 0.5 : 1) * hy;
      const sc = Uin * P.Ly / tot;
      for (let j = 0; j < ny; j++) {
        const y = j * hy;
        if (j > 0) I += 0.5 * (S[j] + S[j - 1]) * hy;
        let ps = sc * I;
        // closed cellular eddy confined to the dead zone (no flux through its edges)
        if (x > P.xe0 && x < P.xe1 && y < P.W) ps += -A * prot * Math.sin(Math.PI * (x - P.xe0) / P.Le) * Math.sin(Math.PI * y / P.W);
        this.psi[i * ny + j] = ps;
      }
    }
    const k = (i, j) => i * ny + j;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const jp = Math.min(ny - 1, j + 1), jm = Math.max(0, j - 1), ip = Math.min(nx - 1, i + 1), im = Math.max(0, i - 1);
      this.u[k(i, j)] = (this.psi[k(i, jp)] - this.psi[k(i, jm)]) / ((jp - jm) * hy);
      this.v[k(i, j)] = -(this.psi[k(ip, j)] - this.psi[k(im, j)]) / ((ip - im) * hx);
    }
    for (let j = 0; j < ny; j++) { this.v[k(0, j)] = this.v[k(1, j)]; this.v[k(nx - 1, j)] = this.v[k(nx - 2, j)]; }
    for (let i = 0; i < nx; i++) { this.v[k(i, 0)] = 0; this.v[k(i, ny - 1)] = 0; }
    // convective acceleration u·∇u (steady field) for the fluid-acceleration force on the body
    for (let i = 1; i < nx - 1; i++) for (let j = 1; j < ny - 1; j++) {
      const uu = this.u[k(i, j)], vv = this.v[k(i, j)];
      this.ax[k(i, j)] = uu * (this.u[k(i + 1, j)] - this.u[k(i - 1, j)]) / (2 * hx) + vv * (this.u[k(i, j + 1)] - this.u[k(i, j - 1)]) / (2 * hy);
      this.ay[k(i, j)] = uu * (this.v[k(i + 1, j)] - this.v[k(i - 1, j)]) / (2 * hx) + vv * (this.v[k(i, j + 1)] - this.v[k(i, j - 1)]) / (2 * hy);
    }
  }
  sample(arr, x, y) {
    const { nx, ny, hx, hy } = this;
    let fx = x / hx, fy = y / hy; fx = Math.min(nx - 1.001, Math.max(0, fx)); fy = Math.min(ny - 1.001, Math.max(0, fy));
    const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, k = i * ny + j;
    return arr[k] * (1 - a) * (1 - b) + arr[k + ny] * a * (1 - b) + arr[k + 1] * (1 - a) * b + arr[k + ny + 1] * a * b;
  }
}

export function inBoulder(x, y, pad = 0) {
  const dx = (x - P.xb) / (P.rbx + pad), dy = (y - P.yb) / (P.rby + pad); return dx * dx + dy * dy < 1;
}

// floating sphere: equilibrium submerged depth d such that V_sub(d) = s·V
export function floatGeom(D, s) {
  const R = D / 2, V = 4 / 3 * Math.PI * R ** 3;
  const Vsub = (d) => Math.PI * d * d * (3 * R - d) / 3;
  let lo = 0, hi = 2 * R; for (let it = 0; it < 50; it++) { const m = 0.5 * (lo + hi); (Vsub(m) < s * V ? lo = m : hi = m); }
  const d = 0.5 * (lo + hi);
  // submerged projected (frontal) area = circular segment of depth d
  const th = 2 * Math.acos(Math.max(-1, Math.min(1, (R - d) / R)));
  const Aw = R * R * (th - Math.sin(th)) / 2;
  const wb = Math.sqrt(8 / 3 * P.g * R * Math.max(0, 1 - s) / P.CD); // terminal rise speed when fully submerged
  return { R, V, d, Aw, wb, freeboard: 2 * R - d };
}

export function makeRng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export class Coconut {
  constructor(rng) { this.rng = rng || Math.random; this.reset(); }
  reset(x = P.xe0 + 1.3, y = 0.22) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.up = 0; this.vp = 0; this.zeta = 0; // zeta: extra depth below float line [m]
    this.wd = 0; this.t = 0; this.state = 'trapped'; this.under = false; this.spin = 0; this.ang = 0; this.escT = null; this.out = false;
  }
  zone() {
    if (this.x > P.xe1 + 0.9 || this.y > P.ys + 0.55) return 'main';
    if (this.x > P.xe0 - 1.2 && this.x < P.xe1 + 0.9 && this.y < P.ys + 0.55) return 'eddy';
    return 'main';
  }
  // p: {U, Ue, D, s, prot}
  step(dt, F, p) {
    if (!(dt > 0)) return floatGeom(p.D, p.s);
    const G = floatGeom(p.D, p.s);
    const { rho, CD, CA } = P;
    let u = F.sample(F.u, this.x, this.y), v = F.sample(F.v, this.x, this.y);
    const ax = F.sample(F.ax, this.x, this.y), ay = F.sample(F.ay, this.x, this.y);
    // shear-layer band: turbulence & downwelling live here
    const band = Math.exp(-(((this.y - P.ys) / 0.5) ** 2)) * (this.x > P.xb - 0.5 && this.x < P.xe1 + 0.8 ? 1 : 0.25);
    const sigma = P.turb * p.U * (band + 0.12);
    const a = Math.exp(-dt / P.TL), bq = sigma * Math.sqrt(1 - a * a);
    this.up = a * this.up + bq * gauss(this.rng); this.vp = a * this.vp + bq * gauss(this.rng);
    // vertical: downwelling vs buoyant rise
    const wd = P.beta_d * p.U * band; this.wd = wd;
    const full = G.freeboard; // extra depth to get fully submerged
    const Fup = Math.min(1, Math.max(0, this.zeta / full)); // restoring buoyancy fraction (approx.)
    const wr = G.wb * Math.sqrt(Fup) + (this.zeta > 0 ? 0 : 0);
    this.zeta = Math.max(0, this.zeta + dt * (wd - wr - (this.zeta < full ? 0.05 * (1 - p.s) * 0 : 0)));
    const deep = Math.min(1, Math.max(0, (this.zeta - full) / 0.3));
    this.under = deep > 0.2;
    // underflow: below the surface roller the water heads downstream at ~0.8 U regardless of the eddy
    u = (u + this.up) * (1 - deep) + 0.8 * p.U * deep; v = (v + this.vp) * (1 - deep);
    const subFrac = deep > 0 ? 1 : 0;
    const Aw = subFrac ? Math.PI * G.R * G.R : G.Aw, Vs = subFrac ? G.V : p.s * G.V;
    const m = p.s * rho * G.V, me = m + CA * rho * Vs;
    const rx = u - this.vx, ry = v - this.vy, ur = Math.hypot(rx, ry);
    const fx = 0.5 * rho * CD * Aw * ur * rx + (1 + CA) * rho * Vs * ax * (1 - deep);
    const fy = 0.5 * rho * CD * Aw * ur * ry + (1 + CA) * rho * Vs * ay * (1 - deep);
    this.vx += dt * fx / me; this.vy += dt * fy / me;
    this.x += dt * this.vx; this.y += dt * this.vy;
    // walls & boulder
    if (this.y < G.R) { this.y = G.R; this.vy = Math.abs(this.vy) * 0.3; }
    if (this.y > P.Ly - G.R) { this.y = P.Ly - G.R; this.vy = -Math.abs(this.vy) * 0.3; }
    if (this.x < G.R) { this.x = G.R; this.vx = Math.abs(this.vx) * 0.3; }
    if (inBoulder(this.x, this.y, G.R)) {
      const dx = (this.x - P.xb) / (P.rbx + G.R), dy = (this.y - P.yb) / (P.rby + G.R), r = Math.hypot(dx, dy) || 1;
      this.x = P.xb + dx / r * (P.rbx + G.R) * 1.001; this.y = P.yb + dy / r * (P.rby + G.R) * 1.001;
      const nx = dx / r, ny = dy / r, vn = this.vx * nx + this.vy * ny; if (vn < 0) { this.vx -= 1.3 * vn * nx; this.vy -= 1.3 * vn * ny; }
    }
    // spin from local vorticity (visual only)
    const om = (F.sample(F.v, this.x + 0.1, this.y) - F.sample(F.v, this.x - 0.1, this.y)) / 0.2 - (F.sample(F.u, this.x, this.y + 0.1) - F.sample(F.u, this.x, this.y - 0.1)) / 0.2;
    this.spin += dt * (0.5 * om - this.spin) / 1.5; this.ang += dt * this.spin;
    this.t += dt;
    const z = this.zone();
    if (this.x > P.Lx + 0.3) { this.out = true; this.state = 'escaped'; if (this.escT == null) this.escT = this.t; }
    else if (z === 'main' || this.under) { this.state = 'escaping'; if (this.escT == null) this.escT = this.t; }
    else if (this.state !== 'escaping') this.state = 'trapped';
    return G;
  }
}

export function numbers(p) {
  const G = floatGeom(p.D, p.s);
  const wd = P.beta_d * p.U;
  // plunge toe after the boulder drop H (energy, no losses): U_t = √(U² + 2gH), y_t = U·y1/U_t
  const Ut = Math.sqrt(p.U * p.U + 2 * P.g * P.Hdrop), yt = p.U * P.y1 / Ut;
  return {
    FrToe: Ut / Math.sqrt(P.g * yt),
    Re: p.U * p.D / P.nu,
    Fr: p.U / Math.sqrt(P.g * P.y1),
    dragRatio: (p.U / Math.max(0.01, p.Ue)) ** 2,
    buoy: G.wb / Math.max(1e-6, wd),
    Tex: P.W / (P.k_ex * p.U),
    wb: G.wb, wd, freeboard: G.freeboard, mass: p.s * P.rho * G.V,
  };
}
