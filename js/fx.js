import * as THREE from 'three';
import { canvasTex } from './util.js?v=cams28c';

const VERT = `
attribute float size; attribute float alpha; attribute vec3 tint;
varying float vAlpha; varying vec3 vTint;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vAlpha = alpha; vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (700.0 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const FRAG = `
uniform sampler2D map; varying float vAlpha; varying vec3 vTint;
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vTint * t.rgb, t.a * vAlpha);
}`;

const soft = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { repeat: false });

export class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.n = 0; this.head = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(max * 3), 3); this.size = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.alpha = new THREE.BufferAttribute(new Float32Array(max), 1); this.tint = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.pos, this.size, this.alpha, this.tint]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos); g.setAttribute('size', this.size); g.setAttribute('alpha', this.alpha); g.setAttribute('tint', this.tint);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: soft } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, a0, color, drag = 1.5, grav = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.drag[i] = drag; this.grav[i] = grav;
    this.tint.array.set([color.r, color.g, color.b], i * 3);
  }
  update(dt) {
    const P = this.pos.array, S = this.size.array, A = this.alpha.array;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) { A[i] = 0; S[i] = 0; continue; }
      this.age[i] += dt; const t = this.age[i] / this.life[i], k = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt; this.v[i * 3 + 2] *= k;
      for (let j = 0; j < 3; j++) { this.p[i * 3 + j] += this.v[i * 3 + j] * dt; P[i * 3 + j] = this.p[i * 3 + j]; }
      if (P[i * 3 + 1] < 0.02 && this.grav[i] > 0) { P[i * 3 + 1] = this.p[i * 3 + 1] = 0.02; this.v[i * 3 + 1] *= -0.3; }
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      A[i] = this.a0[i] * (1 - t) * Math.min(1, t * 8);
    }
    this.pos.needsUpdate = this.size.needsUpdate = this.alpha.needsUpdate = this.tint.needsUpdate = true;
  }
  clear() { this.age.fill(1e9); }
}

/* Ring-buffered skid marks laid as quads on the road */
export class Skids {
  constructor(scene, max = 2400) {
    this.max = max; this.head = 0;
    const g = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(new Float32Array(max * 4 * 3), 3); this.posA.setUsage(THREE.DynamicDrawUsage);
    this.alA = new THREE.BufferAttribute(new Float32Array(max * 4), 1);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    g.setAttribute('position', this.posA); g.setAttribute('alpha', this.alA); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float alpha; varying float vA;\n#include <common>\n#include <logdepthbuf_pars_vertex>\nvoid main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: 'varying float vA;\n#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\ngl_FragColor = vec4(0.03,0.03,0.035, vA); }',
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
    this.last = new Map();
  }
  mark(key, x, z, hx, hz, strength, y = 0) {
    const prev = this.last.get(key);
    this.last.set(key, { x, z, t: performance.now() });
    if (!prev || performance.now() - prev.t > 120) return;
    const dx = x - prev.x, dz = z - prev.z, l = Math.hypot(dx, dz); if (l < 0.25 || l > 6) return;
    const nx = -dz / l * 0.17, nz = dx / l * 0.17, i = this.head; this.head = (this.head + 1) % this.max;
    const yy = y + 0.042; this.posA.array.set([prev.x + nx, yy, prev.z + nz, prev.x - nx, yy, prev.z - nz, x + nx, yy, z + nz, x - nx, yy, z - nz], i * 12);
    this.alA.array.set([strength, strength, strength, strength], i * 4);
    this.posA.needsUpdate = this.alA.needsUpdate = true;
  }
  lift(key) { this.last.delete(key); }
  clear() { this.posA.array.fill(0); this.alA.array.fill(0); this.posA.needsUpdate = this.alA.needsUpdate = true; this.last.clear(); }
}

/* Firework show for a race win: rockets with trails, peony / willow / ring / crackle bursts, and fans of red and white
   comets fired up from either side of the track (the Abu Dhabi finale look). Every star leaves a fading streak. */
const C = (h, s, l, k) => new THREE.Color().setHSL(h, s, l).multiplyScalar(k);
const PALETTE = [() => C(0, 1, 0.5, 4), () => C(0, 0, 1, 4), () => C(0.11, 1, 0.55, 3.5), () => C(0.58, 1, 0.6, 3.5), () => C(0.83, 1, 0.6, 3.5), () => C(0.33, 1, 0.5, 3.5)];
export class Fireworks {
  constructor(scene) { this.fx = new Particles(scene, 24000, true); this.stars = []; this.rockets = []; this.t = 0; this.next = 0; this.vol = 0; }
  // origin: where the show is centred, h: heading the camera is looking along, dur: seconds, onBoom(dist) for sound
  start(x, y, z, h, dur, onBoom) { this.o = { x, y, z, h }; this.t = dur; this.dur = dur; this.next = 0; this.vol = 0.4; this.boom = onBoom; }
  stop() { this.t = 0; this.stars.length = 0; this.rockets.length = 0; this.fx.clear(); }
  // a point fwd metres ahead and side metres to the side of the show centre
  at(fwd, side, up) { const o = this.o, s = Math.sin(o.h), c = Math.cos(o.h); return [o.x + s * fwd + c * side, o.y + up, o.z + c * fwd - s * side]; }
  star(x, y, z, vx, vy, vz, col, o = {}) {
    if (this.stars.length > 900) return;
    this.stars.push({ x, y, z, vx, vy, vz, col, age: 0, life: o.life || 2, drag: o.drag ?? 1.1, grav: o.grav ?? 5, size: o.size || 2.8, trail: o.trail ?? 0.8, crackle: !!o.crackle, strobe: !!o.strobe, emit: 0 });
  }
  burst(x, y, z) {
    const kind = Math.random(), c1 = PALETTE[Math.floor(Math.random() * PALETTE.length)](), c2 = Math.random() < 0.5 ? C(0, 0, 1, 4) : PALETTE[Math.floor(Math.random() * PALETTE.length)]();
    const sphere = (n, sp, f) => { for (let k = 0; k < n; k++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, r = Math.sqrt(1 - u * u), v = sp * (0.85 + Math.random() * 0.15); f(r * Math.cos(t) * v, u * v, r * Math.sin(t) * v, k); } };
    if (kind < 0.3) sphere(120, 36, (a, b, c, k) => this.star(x, y, z, a, b, c, k % 3 ? c1 : c2, { life: 1.8 + Math.random() * 0.5 }));               // peony
    else if (kind < 0.55) { const gold = C(0.1, 1, 0.5, 3.2); sphere(100, 30, (a, b, c) => this.star(x, y, z, a, b, c, gold, { life: 3.8, drag: 0.9, grav: 7, trail: 1.8, size: 2.2 })); } // gold willow
    else if (kind < 0.75) { const ax = Math.random() * 6.283, tilt = 0.6 + Math.random() * 0.6; for (let k = 0; k < 70; k++) { const t = k / 70 * 6.283, v = 34; const vx = Math.cos(t) * v, vy = Math.sin(t) * v * Math.cos(tilt), vz = Math.sin(t) * v * Math.sin(tilt); this.star(x, y, z, vx * Math.cos(ax) - vz * Math.sin(ax), vy, vx * Math.sin(ax) + vz * Math.cos(ax), c1, { life: 1.8 }); } sphere(25, 8, (a, b, c) => this.star(x, y, z, a, b, c, c2, { life: 1.4 })); } // ring
    else sphere(90, 32, (a, b, c) => this.star(x, y, z, a, b, c, C(0, 0, 1, 4), { life: 1.6, crackle: true, strobe: true }));                      // white strobe + crackle
    // bright flash at the centre
    for (let k = 0; k < 6; k++) this.fx.spawn(x, y, z, 0, 0, 0, 0.25, 26, 6, 1, C(0, 0, 1, 4), 0);
    if (this.boom) this.boom(1);
  }
  rocket(fwd, side, apex) {
    const [x, y, z] = this.at(fwd, side, 0), [tx, ty, tz] = this.at(fwd + (Math.random() - 0.5) * 30, side * 0.6, apex), T = 1.6 + Math.random() * 0.4;
    this.rockets.push({ x, y, z, vx: (tx - x) / T, vy: (ty - y) / T + 9.81 * T / 2, vz: (tz - z) / T, t: T });
  }
  // a fan of straight comets fired up from a launcher, alternating red and white
  fan(fwd, side) {
    const [x, y, z] = this.at(fwd, side, 6), o = this.o, n = 7, red = C(0, 1, 0.5, 4.5), white = C(0, 0, 1, 4);
    for (let k = 0; k < n; k++) {
      const a = (k / (n - 1) - 0.5) * 1.3, v = 55 + Math.random() * 10, up = Math.cos(a) * v, lat = Math.sin(a) * v, fw = (Math.random() - 0.3) * 12;
      this.star(x, y, z, Math.sin(o.h) * fw + Math.cos(o.h) * lat, up, Math.cos(o.h) * fw - Math.sin(o.h) * lat, k % 2 ? white : red, { life: 1.6 + Math.random() * 0.3, drag: 0.6, grav: 9, trail: 1.2, size: 3.2 });
    }
    if (this.boom) this.boom(0.4);
  }
  update(dt) {
    if (this.t > 0) {
      this.t -= dt; this.next -= dt;
      if (this.next <= 0) {
        const el = this.dur - this.t, finale = this.t < 3.5;
        const r = Math.random();
        if (r < 0.35 || finale) { const s = Math.random() < 0.5 ? -1 : 1; this.fan(70 + Math.random() * 80, s * (30 + Math.random() * 25)); if (finale || el < 1) this.fan(70 + Math.random() * 80, -s * (30 + Math.random() * 25)); }
        const shells = finale ? 3 : 1 + (Math.random() < 0.4);
        for (let k = 0; k < shells; k++) this.rocket(90 + Math.random() * 90, (Math.random() - 0.5) * 120, 55 + Math.random() * 45);
        this.next = finale ? 0.18 + Math.random() * 0.12 : 0.45 + Math.random() * 0.4;
      }
    }
    // rockets: climb with a sparkly trail, then burst
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.t -= dt; r.vy -= 9.81 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      this.fx.spawn(r.x, r.y, r.z, (Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2, 0.5, 1.4, 0.2, 0.9, C(0.09, 1, 0.6, 2.5), 1, 2);
      if (r.t <= 0) { this.burst(r.x, r.y, r.z); this.rockets.splice(i, 1); }
    }
    // stars: move, leave a streak, flicker or crackle at the end
    const st = this.stars;
    for (let i = st.length - 1; i >= 0; i--) {
      const s = st[i]; s.age += dt;
      if (s.age >= s.life) {
        if (s.crackle) for (let k = 0; k < 3; k++) this.fx.spawn(s.x, s.y, s.z, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0.12 + Math.random() * 0.15, 2.4, 0.4, 1, C(0.12, 0.3, 0.9, 4), 2, 0);
        st[i] = st[st.length - 1]; st.pop(); continue;
      }
      const k = Math.exp(-s.drag * dt); s.vx *= k; s.vz *= k; s.vy = s.vy * k - s.grav * dt;
      const px = s.x, py = s.y, pz = s.z; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const fade = 1 - s.age / s.life, on = !s.strobe || s.age < s.life * 0.5 || Math.random() < 0.5;
      // streak: two trail points per frame (keeps it a solid line even at speed) + a bright head
      if (on) {
        for (const f of [0, 0.5]) this.fx.spawn(px + (s.x - px) * f, py + (s.y - py) * f, pz + (s.z - pz) * f, 0, -0.6, 0, s.trail, s.size * 0.55 * (0.5 + fade * 0.5), 0.1, 0.75 * fade + 0.15, s.col, 0, 0.5);
        this.fx.spawn(s.x, s.y, s.z, 0, 0, 0, 0.05, s.size * (0.6 + fade * 0.6), s.size * 0.5, 1, s.col, 0, 0);
      }
    }
    this.fx.update(dt);
  }
}
