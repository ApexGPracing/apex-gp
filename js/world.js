import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, KERB, KERB_PROFILE, DS, bankH, elevAt, pitRoad, mergeWallAt } from './tracks.js?v=shift27j';
import { AXLE_F, AXLE_R } from './car.js?v=shift27j';
import { rng, makeNoise, canvasTex, normalTex, noiseFill, smooth, clamp } from './util.js?v=shift27j';

const TMP_GREY = new THREE.Color('#8b939c');
const AD_WORDS = ['APEX GP', 'NOVA FUEL', 'KITE TYRES', 'ORBITAL', 'HELIX', 'SUMMIT', 'VOLTA', 'RAPIDE', 'ZENITH', 'TORQUE+'];

/* ---------------- shared textures ---------------- */
let TX = null;
function textures() {
  if (TX) return TX;
  const r = rng(5);
  TX = {};
  TX.asphalt = canvasTex(512, 512, (g, w, h) => noiseFill(g, w, h, '#4a4c51', 30, 3, 0.05));
  TX.asphaltN = normalTex(512, 512, (g, w, h) => noiseFill(g, w, h, '#808080', 90, 4, 0.08), 2.2);
  TX.kerbFor = (...cs) => TX['kerb' + cs.join()] || (TX['kerb' + cs.join()] = canvasTex(64, 64 * cs.length, (g, w, h) => { cs.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, k * h / cs.length, w, h / cs.length); }); const id = g.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (r() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } g.putImageData(id, 0, 0); }));
  // concrete banking slabs (Monza's sopraelevata): pale grey, weathered, with tar-filled joints
  TX.concreteSlab = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, '#a9a69f', 34, 5, 0.12); g.fillStyle = 'rgba(40,40,42,0.55)'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(60,55,50,0.12)'; for (let k = 0; k < 14; k++) { g.beginPath(); g.ellipse((k * 73) % w, (k * 131) % h, 18 + k % 4 * 9, 8 + k % 3 * 6, k, 0, 7); g.fill(); } });
  TX.paint = canvasTex(128, 128, (g, w, h) => noiseFill(g, w, h, '#e8e8e8', 22, 8));
  TX.gravel = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#c9b48a', 60, 9, 0.25));
  // loose road surfaces: red-brown dirt, beige gravel, packed snow with darker ruts
  TX.dirtRoad = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#8a5634', 34, 6, 0.18));
  TX.gravelRoad = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#b8a78a', 42, 8, 0.22));
  TX.snowRoad = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, '#eef3f7', 14, 5, 0.1); g.fillStyle = 'rgba(150,160,175,0.35)'; for (const x of [70, 90, 166, 186]) g.fillRect(x, 0, 10, h); });
  TX.gravelN = normalTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#808080', 140, 10, 0.3), 3);
  TX.verge = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#d6d6d6'; g.fillRect(0, h / 2, w, h / 2); const id = g.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (r() - 0.5) * 30; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } g.putImageData(id, 0, 0); });
  TX.fence = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(180,186,194,1)'; g.lineWidth = 3; for (let k = -w; k < w * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); } g.fillStyle = 'rgba(160,166,174,1)'; g.fillRect(0, 0, w, 4); }, { srgb: true });
  TX.tyres = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, w, h); for (let x = 16; x < w; x += 32) for (const y of [20, 46]) { g.fillStyle = '#1d1e20'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = '#070708'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, 6); });
  TX.ads = canvasTex(2048, 128, (g, w, h) => {
    const cols = [['#111827', '#facc15'], ['#1d4ed8', '#ffffff'], ['#dc2626', '#ffffff'], ['#f8fafc', '#111827'], ['#16a34a', '#ffffff'], ['#7c3aed', '#ffffff'], ['#0f172a', '#22d3ee'], ['#ea580c', '#111111']];
    for (let k = 0; k < 8; k++) { const [bg, fg] = cols[k]; g.fillStyle = bg; g.fillRect(k * 256, 0, 256, h); g.fillStyle = fg; g.font = 'italic 800 64px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(AD_WORDS[k], k * 256 + 128, h / 2 + 4); }
  });
  TX.adsWall = TX.ads.clone(); TX.adsWall.center.set(0.5, 0.5); TX.adsWall.rotation = Math.PI / 2; TX.adsWall.needsUpdate = true;
  TX.tyresWall = TX.tyres.clone(); TX.tyresWall.center.set(0.5, 0.5); TX.tyresWall.rotation = Math.PI / 2; TX.tyresWall.needsUpdate = true;
  TX.crowd = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1b1f2a'; g.fillRect(0, 0, w, h); const c = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#f5cba7', '#ff4fa3']; for (let i = 0; i < 5200; i++) { g.fillStyle = c[Math.floor(r() * c.length)]; g.fillRect(r() * w, r() * h, 2, 3); } });
  TX.checker = canvasTex(256, 64, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } }, { repeat: false });
  TX.detail = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#d8d8d8', 50, 12, 0.03));
  TX.waterN = normalTex(256, 256, (g, w, h) => { const n = makeNoise(3); const id = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (n.fbm(x / 32, y / 32, 4) * 0.5 + 0.5) * 255; const i = (y * w + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }, 3);
  TX.cloud = canvasTex(512, 512, (g, w, h) => { const n = makeNoise(17); const id = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = 64; let v = 0, a = 1, f = 1, tot = 0; for (let o = 0; o < 5; o++) { const fx = x / s * f, fy = y / s * f, p = 512 / s * f; v += a * (n.perlin(fx % p, fy % p)); tot += a; a *= 0.5; f *= 2; } v = v / tot; const i = (y * w + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = clamp((v - 0.12) * 700, 0, 230); } g.putImageData(id, 0, 0); });
  const win = night => canvasTex(128, 256, (g, w, h) => { const rr = rng(night ? 31 : 32); g.fillStyle = night ? '#000' : '#c4ccd6'; g.fillRect(0, 0, w, h); for (let y = 6; y < h - 4; y += 12) for (let x = 6; x < w - 4; x += 12) { if (night) g.fillStyle = rr() < 0.42 ? (rr() < 0.6 ? '#ffd58a' : '#a9dcff') : '#040404'; else g.fillStyle = rr() < 0.5 ? '#46637f' : '#6f8aa5'; g.fillRect(x, y, 8, 8); } }, { repeat: false });
  TX.winDay = win(false); TX.winNight = win(true);
  return TX;
}

/* ---------------- geometry helpers ---------------- */
function ribbon(T, i0, count, cols, vScale, { colorFn = null, up = true } = {}) {
  const C = cols.length, n = count + 1;
  const pos = new Float32Array(n * C * 3), uv = new Float32Array(n * C * 2), col = colorFn ? new Float32Array(n * C * 3) : null, idx = [];
  for (let k = 0; k < n; k++) {
    const i = (i0 + k) % T.N;
    for (let c = 0; c < C; c++) {
      const [o, y, u] = cols[c](i), j = k * C + c;
      pos[j * 3] = T.px[i] + T.nx[i] * o; pos[j * 3 + 1] = y + bankH(T, i, o); pos[j * 3 + 2] = T.pz[i] + T.nz[i] * o;
      uv[j * 2] = u; uv[j * 2 + 1] = k * DS / vScale;
      if (col) { const cc = colorFn(i, o); col[j * 3] = cc; col[j * 3 + 1] = cc; col[j * 3 + 2] = cc; }
    }
  }
  for (let k = 0; k < count; k++) for (let c = 0; c < C - 1; c++) { const a = k * C + c, b = a + 1, d = a + C, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  if (up) { const nrm = g.attributes.normal.array; let sy = 0; for (let i = 1; i < nrm.length; i += 3) sy += nrm[i]; if (sy < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); } }
  return g;
}
const col = (o, y, u) => () => [o, y, u];
const sideLim = (T, s) => i => s > 0 ? T.limL[i] : T.limR[i];
/* ----- motor yachts: a lofted V hull with a raked stem and rising sheer, tapered superstructure tiers with
   wrap-around tinted glass, a hardtop and a radar mast. Bow points to +z, waterline near y = 0.9, ~26 m long. ----- */
const plainGeo = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
let YACHT = null;
function yachtGeos() {
  if (YACHT) return YACHT;
  // hull: stations from the transom (z -10) to the stem (z +15.5); each cross-section strip lofted separately so the chines and sheer stay crisp
  const NS = 30, sec = t => {
    const w = 2.45 * (t < 0.55 ? 0.93 + 0.07 * t / 0.55 : Math.sqrt(Math.max(0, (1 - t) / 0.45))) + 0.02;
    const sh = 2.25 + 0.75 * t * t, kb = t > 0.62 ? Math.pow((t - 0.62) / 0.38, 1.6) * 2.0 : 0, ch = Math.max(kb + 0.25, 0.95 + 0.25 * t);
    return { z: -10 + 25.5 * t, pts: [[0, kb], [w * 0.55, kb + 0.2 + (ch - kb) * 0.25], [w * 0.97, ch], [w, sh], [-w, sh], [-w * 0.97, ch], [-w * 0.55, kb + 0.2 + (ch - kb) * 0.25], [0, kb]] };
  };
  const S = []; for (let k = 0; k <= NS; k++) S.push(sec(k / NS));
  const strips = [];
  for (let e = 0; e < 7; e++) {
    const pos = [], idx = [];
    for (let k = 0; k <= NS; k++) { const a = S[k].pts[e], b = S[k].pts[e + 1]; pos.push(a[0], a[1], S[k].z, b[0], b[1], S[k].z); }
    for (let k = 0; k < NS; k++) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); strips.push(plainGeo(g));
  }
  // flat transom with a swim platform
  const tp = S[0].pts, tr = []; for (let e = 0; e < 7; e++) tr.push(0, (tp[0][1] + tp[3][1]) / 2, -10, tp[e + 1][0], tp[e + 1][1], -10, tp[e][0], tp[e][1], -10);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tr, 3)); tg.computeVertexNormals();
  const hull = mergeGeometries([...strips, tg, plainGeo(new THREE.BoxGeometry(4.6, 0.25, 1.6).translate(0, 0.95, -10.7))]);
  // superstructure tiers: a plan with a pointed, rounded front, extruded up, the front raked back and the sides tucked in
  const tier = (zb, zf, w, y0, h, rake, grow = 1) => {
    const sh = new THREE.Shape(), nose = Math.min(4, (zf - zb) * 0.35);
    sh.moveTo(-w, zb); sh.lineTo(w, zb); sh.lineTo(w, zf - nose); sh.quadraticCurveTo(w * 0.95, zf, 0, zf); sh.quadraticCurveTo(-w * 0.95, zf, -w, zf - nose); sh.lineTo(-w, zb);
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2);   // shape y -> z, extrude -> down
    const P = g.attributes.position, zc = (zb + zf) / 2;
    for (let k = 0; k < P.count; k++) {
      const f = 1 + P.getY(k) / h;        // 1 at the top (y = 0 after the flip), 0 at the bottom (y = -h)
      let x = P.getX(k), z = P.getZ(k);
      x *= grow * (1 - 0.07 * f); z = zc + (z - zc) * grow; if (z > zb + 1) z -= f * rake * (z - zb) / (zf - zb);
      P.setXYZ(k, x, y0 + h * f, z);
    }
    g.computeVertexNormals(); return plainGeo(g);
  };
  const deck = mergeGeometries([
    tier(-8.6, 10.5, 2.05, 3.0, 1.95, 2.2),                       // main saloon
    tier(-5.2, 6.2, 1.7, 4.95, 1.7, 2.0),                         // bridge deck
    tier(-6.5, 4.0, 1.85, 6.65, 0.18, 0.3),                       // hardtop roof overhanging the flybridge
    tier(-2.6, 2.4, 1.15, 6.65, 1.0, 0.9),                        // sky lounge
    plainGeo(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 8).translate(0, 8.9, -0.6)),   // radar mast
    plainGeo(new THREE.BoxGeometry(1.8, 0.12, 0.25).translate(0, 9.6, -0.6)),          // yardarm
    plainGeo(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12).translate(0, 7.95, 0.6)), // radome
    plainGeo(new THREE.BoxGeometry(4.0, 0.9, 0.12).translate(0, 3.45, -9.2)),          // aft deck bulwark
  ]);
  const glass = mergeGeometries([
    tier(-8.0, 10.5, 2.05, 3.55, 0.85, 1.3, 1.015),               // saloon windows wrapping round
    tier(-4.8, 6.2, 1.7, 5.4, 0.8, 1.2, 1.02),                    // bridge windows and windscreen
    tier(-2.3, 2.4, 1.15, 6.95, 0.55, 0.6, 1.03),                 // sky lounge
    plainGeo(new THREE.BoxGeometry(4.86, 0.42, 9).translate(0, 1.55, 0.5)),   // hull window line
    plainGeo(new THREE.BoxGeometry(4.92, 0.12, 13.5).translate(0, 2.18, -2.9)),   // rubbing strake
  ]);
  YACHT = { hull, deck, glass };
  return YACHT;
}
/* place a fleet of yachts: list of [x, z, heading, scale, dark-hull?] */
function yachtFleet(G, list, wl, th, q) {
  if (!list.length) return;
  const Y = yachtGeos(), dd = new THREE.Object3D(), hc = new THREE.Color();
  const hullM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.1 }), deckM = new THREE.MeshStandardMaterial({ color: '#f6f7f8', roughness: 0.35 });
  const winM = th.night ? new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(1.6), toneMapped: false }) : new THREE.MeshStandardMaterial({ color: '#0d141d', roughness: 0.05, metalness: 0.85 });
  const imH = new THREE.InstancedMesh(Y.hull, hullM, list.length), imD = new THREE.InstancedMesh(Y.deck, deckM, list.length), imW = new THREE.InstancedMesh(Y.glass, winM, list.length);
  list.forEach(([x, z, h, sc, kind], k) => {
    dd.position.set(x, wl - 0.9 * sc, z); dd.rotation.set(0, h, 0); dd.scale.setScalar(sc); dd.updateMatrix();
    imH.setMatrixAt(k, dd.matrix); imD.setMatrixAt(k, dd.matrix); imW.setMatrixAt(k, dd.matrix);
    hc.set(kind ? ['#14233d', '#2b2f36', '#7b8794', '#0f3b2e'][k % 4] : '#ffffff'); imH.setColorAt(k, hc);
  });
  for (const im of [imH, imD, imW]) { im.castShadow = q > 0; im.receiveShadow = true; G.add(im); }
}
function rangesOf(arr, N, pred) {
  const out = []; let s = -1;
  for (let i = 0; i < N; i++) { const p = pred(arr[i]); if (p && s < 0) s = i; if ((!p || i === N - 1) && s >= 0) { out.push([s, p ? i : i - 1]); s = -1; } }
  return out;
}

/* ---------------- World ---------------- */
export class World {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sky = new Sky(); this.sky.scale.setScalar(18000); scene.add(this.sky);
    this.nightSky = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
      vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vy; void main(){ float t = clamp(vy*1.6,0.0,1.0); gl_FragColor = vec4(mix(bot, top, pow(t,0.6)), 1.0); }',
    }));
    this.nightSky.frustumCulled = false; scene.add(this.nightSky);
    { const n = 1600, pos = new Float32Array(n * 3), rr = rng(7);
      for (let i = 0; i < n; i++) { const th = rr() * Math.PI * 2, y = 0.06 + rr() * 0.94, q = Math.sqrt(1 - y * y); pos.set([Math.cos(th) * q * 14000, y * 14000, Math.sin(th) * q * 14000], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
      this.stars.frustumCulled = false; scene.add(this.stars); }
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(220, 32), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, fog: false, toneMapped: false }));
    scene.add(this.moon);
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); scene.add(this.hemi);
    this.sunDir = new THREE.Vector3();
    this.group = null; this.envRT = null; this.clouds = null; this.waters = [];
  }

  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    this.group = null;
  }

  build(T, quality, teamColors, teamNames = []) {
    this.dispose();
    const tx = textures(), th = T.theme, N = T.N, q = quality;
    const G = this.group = new THREE.Group(); this.scene.add(G);
    this.waters = []; this.gantryLights = [];
    const add = (geo, mat, { cast = false, recv = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; G.add(m); return m; };
    const seed = T.def.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const r = rng(seed), noise = makeNoise(seed);

    /* ----- sky, sun, environment ----- */
    const elev = th.night ? 35 : th.sunElev;
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(th.night ? 140 : th.sunAz));
    const envScene = new THREE.Scene();
    if (th.night) {
      this.sky.visible = false; this.nightSky.visible = this.stars.visible = this.moon.visible = true;
      this.nightSky.material.uniforms.top.value.set(th.nightSky[0]); this.nightSky.material.uniforms.bot.value.set(th.nightSky[1]);
      const es = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), this.nightSky.material.clone()); envScene.add(es);
      for (let k = 0; k < 10; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? th.wallA : '#fff2d6').multiplyScalar(2.5), side: THREE.DoubleSide })); const a = k / 10 * Math.PI * 2; p.position.set(Math.cos(a) * 40, 10 + (k % 3) * 6, Math.sin(a) * 40); p.lookAt(0, 0, 0); envScene.add(p); }
      this.sun.color.set('#9fb3ff'); this.sun.intensity = 0.6;
      this.hemi.color.set('#8fa4ff'); this.hemi.groundColor.set('#2a2433'); this.hemi.intensity = 1.1;
      this.moon.position.copy(this.sunDir).multiplyScalar(12000); this.moon.lookAt(0, 0, 0);
    } else {
      this.sky.visible = true; this.nightSky.visible = this.stars.visible = this.moon.visible = false;
      const u = this.sky.material.uniforms;
      u.turbidity.value = th.turbidity; u.rayleigh.value = th.rayleigh; u.mieCoefficient.value = th.mie; u.mieDirectionalG.value = 0.8; u.sunPosition.value.copy(this.sunDir);
      const es = new Sky(); es.scale.setScalar(50); Object.assign(es.material.uniforms.turbidity, { value: th.turbidity });
      es.material.uniforms.rayleigh.value = th.rayleigh; es.material.uniforms.mieCoefficient.value = th.mie; es.material.uniforms.mieDirectionalG.value = 0.8; es.material.uniforms.sunPosition.value.copy(this.sunDir);
      envScene.add(es);
      const low = clamp(elev / 30, 0, 1);
      this.sun.color.setRGB(1, 0.72 + 0.26 * low, 0.5 + 0.45 * low); this.sun.intensity = 1.2 + 2.0 * clamp(elev / 25, 0, 1);
      this.hemi.color.set('#dfefff'); this.hemi.groundColor.set(th.grass); this.hemi.intensity = 0.35;
    }
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.02, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = th.night ? 0.6 : 1;
    this.scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    this.renderer.toneMappingExposure = th.exposure;
    this.bloomStrength = th.bloom; this.night = th.night;
    this.base = { sun: this.sun.intensity, hemi: this.hemi.intensity, exposure: th.exposure, fog: th.fogDensity, fogColor: new THREE.Color(th.fog), turb: th.turbidity, ray: th.rayleigh, env: this.scene.environmentIntensity };
    this.sun.castShadow = q > 0;
    const sm = q >= 2 ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== sm) { this.sun.shadow.mapSize.set(sm, sm); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 1; sc.far = 900; sc.updateProjectionMatrix();

    /* ----- distance field + terrain ----- */
    const span = Math.max(T.maxX - T.minX, T.maxZ - T.minZ) + 4600;
    const x0 = T.cx - span / 2, z0 = T.cz - span / 2;
    const DF = 200, cell = span / DF, df = new Float32Array((DF + 1) * (DF + 1)), ef = new Float32Array((DF + 1) * (DF + 1));
    for (let j = 0; j <= DF; j++) for (let i = 0; i <= DF; i++) {
      const x = x0 + i * cell, z = z0 + j * cell; let m = 1e12, mk = 0;
      for (let k = 0; k < N; k += 4) { const dx = x - T.px[k], dz = z - T.pz[k], d = dx * dx + dz * dz; if (d < m) { m = d; mk = k; } }
      df[j * (DF + 1) + i] = Math.sqrt(m); ef[j * (DF + 1) + i] = elevAt(T, mk);
    }
    // elevation of the nearest part of the track, so the land rises and falls with it
    const elevNear = (x, z) => {
      const fx = clamp((x - x0) / cell, 0, DF - 0.001), fz = clamp((z - z0) / cell, 0, DF - 0.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, R = DF + 1;
      return (ef[j * R + i] * (1 - u) + ef[j * R + i + 1] * u) * (1 - v) + (ef[(j + 1) * R + i] * (1 - u) + ef[(j + 1) * R + i + 1] * u) * v;
    };
    const dist = (x, z) => {
      const fx = clamp((x - x0) / cell, 0, DF - 0.001), fz = clamp((z - z0) / cell, 0, DF - 0.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, R = DF + 1;
      return (df[j * R + i] * (1 - u) + df[j * R + i + 1] * u) * (1 - v) + (df[(j + 1) * R + i] * (1 - u) + df[(j + 1) * R + i + 1] * u) * v;
    };
    this.dist = dist;
    const flat = T.wallOff + (T.street ? 70 : 45), amp = th.hillAmp;
    const wdir = th.water && th.water.mode === 'side' ? [Math.cos(th.water.angle), Math.sin(th.water.angle)] : null;
    // The ground mesh is coarse, so on dips and compressions (Eau Rouge!) a flat triangle between two vertices
    // can rise above the road and grass pokes through. Near the track, keep every ground vertex below the
    // road's surface as seen from it: the lowest of the road's elevation extended along its own slope from every
    // track sample in reach. On a steady slope that changes nothing; in a dip it sinks the ground under the road.
    const seg = q === 0 ? 200 : q === 1 ? 280 : 360, tcell = span / seg, reachR = tcell * 1.5, corridor = T.wallOff + reachR;
    const HB = 32, hash = new Map();
    for (let k = 0; k < N; k += 2) { const key = Math.floor(T.px[k] / HB) + ',' + Math.floor(T.pz[k] / HB); let a = hash.get(key); if (!a) hash.set(key, a = []); a.push(k); }
    // where the lap crosses itself, the ground around the LOWER road is dug out so it does not climb up to the bridge
    // across the road (an underpass cutting with sloping sides), and the bridge deck spans the cutting
    const xUp = new Uint8Array(N), xLo = new Map();
    if (T.elev) for (let i = 0; i < N; i += 2) for (let j = 0; j < N; j += 2) {
      let di = Math.abs(i - j); di = Math.min(di, N - di); if (di * DS < 150) continue;
      const dx = T.px[j] - T.px[i], dz = T.pz[j] - T.pz[i];
      if (dx * dx + dz * dz < (2 * T.wallOff + 8) ** 2 && T.elev[i] - T.elev[j] > 4.5) { xUp[i] = xUp[(i + 1) % N] = 1; xLo.set(i, j); }
    }
    const cutS = []; for (const j of new Set(xLo.values())) for (let k = -70; k <= 70; k += 2) cutS.push((j + k + N) % N);
    const cutR = 90, cutBox = cutS.length ? [Math.min(...cutS.map(k => T.px[k])) - cutR, Math.max(...cutS.map(k => T.px[k])) + cutR, Math.min(...cutS.map(k => T.pz[k])) - cutR, Math.max(...cutS.map(k => T.pz[k])) + cutR] : null;
    const cutCap = (x, z) => {
      if (!cutBox || x < cutBox[0] || x > cutBox[1] || z < cutBox[2] || z > cutBox[3]) return Infinity;
      let cap = Infinity; const flatW = W + KERB + 5;
      for (const k of cutS) { const dx = x - T.px[k], dz = z - T.pz[k], d2 = dx * dx + dz * dz; if (d2 > cutR * cutR) continue; cap = Math.min(cap, T.elev[k] - 0.6 + Math.max(0, Math.sqrt(d2) - flatW) * 0.45); }
      return cap;
    };
    const roadCap = (x, z) => {
      let cap = Infinity; const r2 = (reachR + T.wallOff) ** 2, cx = Math.floor(x / HB), cz = Math.floor(z / HB), nb = Math.ceil((reachR + T.wallOff) / HB);
      for (let gx = cx - nb; gx <= cx + nb; gx++) for (let gz = cz - nb; gz <= cz + nb; gz++) {
        const a = hash.get(gx + ',' + gz); if (!a) continue;
        for (const k of a) { const dx = x - T.px[k], dz = z - T.pz[k]; if (dx * dx + dz * dz > r2) continue; cap = Math.min(cap, T.elev[k] + T.grade[k] * (dx * T.tx[k] + dz * T.tz[k]) - 0.25); }
      }
      return cap;
    };
    // def.harbour (Monaco's Port Hercule): a basin dug out of the ground beside the track, bounded by the quay
    // along the given stretch of track and by the outer points in def.harbour.far
    let harbourPoly = null, hb = null;
    const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    if (T.def.harbour) {
      const H = T.def.harbour; harbourPoly = [];
      for (let m = H.from; m <= H.to; m += 6) { const i = Math.round(m / DS) % N, off = (H.side > 0 ? T.limL[i] : T.limR[i]) + (H.quay || 9); harbourPoly.push([T.px[i] + T.nx[i] * H.side * off, T.pz[i] + T.nz[i] * H.side * off]); }
      harbourPoly.push(...H.far);
      hb = [Math.min(...harbourPoly.map(p => p[0])), Math.max(...harbourPoly.map(p => p[0])), Math.min(...harbourPoly.map(p => p[1])), Math.max(...harbourPoly.map(p => p[1]))];
    }
    const inHarbour = (x, z) => !!harbourPoly && x > hb[0] && x < hb[1] && z > hb[2] && z < hb[3] && inPoly(x, z, harbourPoly);
    const harbourFloor = (th.water ? th.water.level : 0) - 6;
    const height = (x, z) => { const h = heightRaw(x, z); return inHarbour(x, z) ? Math.min(h, harbourFloor) : h; };
    const heightRaw = (x, z) => {
      const d = dist(x, z), t = smooth(flat, flat + 600, d);
      let base = T.elev ? elevNear(x, z) - 0.6 * (1 - smooth(T.wallOff, flat, d)) : 0;
      if (T.elev && d < corridor) base = Math.min(base, roadCap(x, z) - 0.6);
      if (cutBox) { const cc = cutCap(x, z); if (cc < base) return cc; }
      if (t <= 0) return base;
      let h;
      const sx = x / 1000, sz = z / 1000;
      switch (th.relief) {
        case 'mountains': { const rr2 = noise.ridge(sx * 0.7, sz * 0.7, 5); h = (Math.pow(rr2, 2.2) * amp + noise.fbm(sx * 3, sz * 3, 3) * 30) * smooth(flat, flat + 1800, d) + 15; break; }
        case 'mesa': { const n = noise.fbm(sx * 1.3, sz * 1.3, 4) * 1.6 + 0.35; const v = clamp(n, 0, 1) * 3; h = amp * (Math.floor(v) + smooth(0.78, 0.96, v % 1)) / 3 + noise.fbm(sx * 8, sz * 8, 2) * 6; break; }
        case 'dunes': { h = (noise.ridge(sx * 2.2, sz * 1.1, 3) - 0.45) * amp + noise.fbm(sx, sz, 3) * amp * 0.8 + amp * 0.3; break; }
        case 'flat': h = noise.fbm(sx * 2, sz * 2, 3) * amp + amp * 0.2; break;
        default: h = (noise.fbm(sx * 1.1, sz * 1.1, 5) * 0.9 + 0.35) * amp;
      }
      h = h * t + base;
      if (th.water) {
        if (wdir) { const pr = (x - T.cx) * wdir[0] + (z - T.cz) * wdir[1]; h -= smooth(T.radius + 150, T.radius + 700, pr) * (h + 45); }
        else { const l = noise.fbm(sx * 0.9 + 7, sz * 0.9 + 3, 3); h -= smooth(-0.02, -0.25, l) * smooth(flat + 120, flat + 400, d) * (h + 40); }
      }
      return h;
    };
    this.height = height;
    {
      const geo = new THREE.PlaneGeometry(span, span, seg, seg).rotateX(-Math.PI / 2);
      geo.translate(T.cx, 0, T.cz);
      const p = geo.attributes.position, colors = new Float32Array(p.count * 3);
      const cLo = new THREE.Color(th.terrain[0]), cMid = new THREE.Color(th.terrain[1]), cHi = new THREE.Color(th.terrain[2]), cSnow = new THREE.Color('#f2f6f9'), cSand = new THREE.Color(th.sand), c = new THREE.Color();
      const wl = th.water ? th.water.level : -1e9;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), h = height(x, z); p.setY(i, h);
        const v = noise.fbm(x / 140, z / 140, 3);
        c.copy(cLo).lerp(cMid, smooth(-0.2, 0.4, v));
        c.lerp(cHi, smooth(amp * 0.35, amp * 0.9, h));
        if (th.snowLine > 1) c.lerp(cSnow, smooth(th.snowLine, th.snowLine + 80, h + v * 40));
        if (th.water) c.lerp(cSand, smooth(wl + 6, wl + 1, h));
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const det = tx.detail.clone(); det.needsUpdate = true; det.repeat.set(span / 14, span / 14);
      const ground = add(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: 1, metalness: 0 }));
      ground.position.y = -0.03;
    }
    if (th.water) {
      const wn = tx.waterN.clone(); wn.needsUpdate = true; wn.repeat.set(span / 60, span / 60);
      const water = add(new THREE.PlaneGeometry(span * 3, span * 3).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: th.night ? '#0a1a2a' : '#1d5a74', roughness: 0.06, metalness: 0.05, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05 }), { recv: false });
      water.position.set(T.cx, th.water.level, T.cz);
      this.waters.push(wn);
    }
    if (!th.night) {
      const ct = tx.cloud.clone(); ct.needsUpdate = true; ct.repeat.set(4, 4);
      const cm = new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: th.mie > 0.01 ? 0.95 : 0.7, color: new THREE.Color().setRGB(1, 0.9 + 0.1 * clamp(elev / 30, 0, 1), 0.82 + 0.18 * clamp(elev / 30, 0, 1)) });
      this.clouds = add(new THREE.PlaneGeometry(40000, 40000).rotateX(Math.PI / 2), cm, { recv: false });
      this.clouds.position.set(T.cx, 1400, T.cz); this.cloudTex = ct;
    } else { this.clouds = null; }

    /* ----- track surface ----- */
    const roadCols = []; for (let c = 0; c <= 14; c++) { const o = W - c * (2 * W / 14); roadCols.push(col(o, 0.02, o / 6)); }
    this.roadMesh = add(ribbon(T, 0, N, roadCols, 6, { colorFn: (i, o) => { const d = (o - T.race[i]) / 1.5; return 0.92 * (1 - 0.26 * Math.exp(-d * d)) * (Math.abs(o) > W - 0.9 ? 1.08 : 1); } }),
      T.gripMul < 1 ? new THREE.MeshStandardMaterial({ map: { gravel: tx.gravelRoad, dirt: tx.dirtRoad, snow: tx.snowRoad }[T.surface], normalMap: tx.gravelN, normalScale: new THREE.Vector2(0.5, 0.5), vertexColors: true, roughness: 1, color: '#ffffff' })   // gravel, dirt or snow road
        : new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.86, metalness: 0, color: th.night ? '#c9ccd6' : '#ffffff' }));
    const lineMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6, map: tx.paint });
    // def.concreteBanks: the banked turns are bare concrete slabs from edge to edge, with a sheer concrete outer face (Monza)
    const bankRanges = T.def.concreteBanks ? rangesOf(T.bank, N, v => Math.abs(v) > 0.004) : [];
    if (bankRanges.length) {
      const slab = new THREE.MeshStandardMaterial({ map: tx.concreteSlab, normalMap: tx.asphaltN, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92, color: th.night ? '#c9ccd6' : '#ffffff' });
      const face = new THREE.MeshStandardMaterial({ map: tx.concreteSlab, color: '#d2cec6', roughness: 0.95, side: THREE.DoubleSide });
      const Wb = W + KERB + 2;
      for (const [a0, a1] of bankRanges) {
        const a = a0, cnt = a1 - a0, L = i => T.limL[i] + 0.3, Rr = i => -(T.limR[i] + 0.3);
        const cols = [i => [L(i), 0.07, L(i) / 8], i => [Math.min(Wb, L(i)), 0.07, Math.min(Wb, L(i)) / 8], col(0, 0.07, 0), i => [Math.max(-Wb, Rr(i)), 0.07, Math.max(-Wb, Rr(i)) / 8], i => [Rr(i), 0.07, Rr(i) / 8]];
        add(ribbon(T, a, cnt, cols, 8), slab);
        const mid = (a + (cnt >> 1)) % N, so = T.bank[mid] > 0 ? 1 : -1, ol = so > 0 ? L : Rr;   // the raised (outer) side
        // the sheer outer face, except where the banking is a bridge over the lap (it would wall off the road underneath)
        const nearX = k => { const i = (a + k) % N; for (const ui of xLo.keys()) { let di = Math.abs(i - ui); di = Math.min(di, N - di); if (di < 90) return true; } return false; };
        for (let k = 0; k < cnt;) { while (k < cnt && nearX(k)) k++; const k0 = k; while (k < cnt && !nearX(k)) k++; if (k - k0 > 2) add(ribbon(T, (a + k0) % N, k - k0, [i => [ol(i) + so * 0.2, 0.07, 0], i => [ol(i) + so * 0.2, -22, 2.5]], 8, { up: false }), face); }
      }
    }
    if (T.def.concreteBanks) {
      const twin = new Uint8Array(N);
      for (let i = 0; i < N; i += 2) for (let j = 0; j < N; j += 2) {
        let di = Math.abs(i - j); di = Math.min(di, N - di); if (di * DS < 150) continue;
        const dx = T.px[j] - T.px[i], dz = T.pz[j] - T.pz[i];
        if (dx * dx + dz * dz < (2 * T.wallOff + 14) ** 2 && Math.abs(T.elev[i] - T.elev[j]) < 3) { for (let k = -6; k <= 7; k++) twin[(i + k + N) % N] = 1; }
      }
      const tarmac = new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.88, color: '#d0d2d6' });
      for (const [a0, a1] of rangesOf(twin, N, v => v)) for (const sd of [1, -1]) add(ribbon(T, a0, a1 - a0, [col(sd * W, 0.015, 0), i => [sd * (sideLim(T, sd)(i) + 0.35), 0.015, 1]], 6), tarmac);
    }
    const onConcreteBank = (s0, e0) => bankRanges.some(([a0, a1]) => { const m = (s0 + ((e0 - s0 + N) % N >> 1)) % N; return m >= a0 && m <= a1; });
    if (T.gripMul === 1 && !T.def.noBarriers) for (const s of [1, -1]) add(ribbon(T, 0, N, [col(s * (W - 0.15), 0.035, 0), col(s * (W - 0.45), 0.035, 1)], 4), lineMat);   // no painted lines on loose surfaces
    // verges / run-off
    const rs = T.def.runoffStyle;
    const ricardT = canvasTex(128, 16, (g2, w, h) => { for (let k = 0; k < 8; k++) { g2.fillStyle = k < 2 ? '#d42027' : k % 2 ? '#1d4ed8' : '#e8ecf2'; g2.fillRect(k * 16, 0, 16, h); } });
    const vergeMat = T.def.arena ? new THREE.MeshStandardMaterial({ map: tx.dirtRoad, normalMap: tx.gravelN, roughness: 1 }) : rs === 'tarmac' ? new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: '#9ea1a8', roughness: 0.9 })
      : rs === 'ricard' ? new THREE.MeshStandardMaterial({ map: ricardT, roughness: 0.75 })
      : T.street ? new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: T.def.pave || '#7d7f86', roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ map: tx.verge, color: th.grass, roughness: 1 });
    for (const s of [1, -1]) add(ribbon(T, 0, N, [col(s * W, 0.01, 0), i => [s * (sideLim(T, s)(i) + 0.3), 0.01, 1]], T.street ? 6 : 16), vergeMat);
    // kerbs
    const kerbMat = new THREE.MeshStandardMaterial({ map: tx.kerbFor(...(T.def.kerb || ['#c8202a', '#f1f1f1'])), roughness: 0.55 });
    const kc = T.def.kerb || ['#c8202a', '#f1f1f1'];
    const apronMat = new THREE.MeshStandardMaterial({ map: tx.kerbFor(...kc), color: '#d9d9d9', roughness: 0.8 });
    for (const [s0, e0] of T.gripMul < 1 || T.def.noBarriers ? [] : T.kerbs.filter(([s0, e0]) => !onConcreteBank(s0, e0))) {   // no kerbs on loose surfaces or rally stages   // no kerbs on loose surfaces
      const cnt = e0 - s0;
      for (const s of [1, -1]) {
        add(ribbon(T, s0, cnt, KERB_PROFILE.map(([dd, hh]) => col(s * (W + dd), hh, (dd + 0.03) / (KERB + 0.03))), 2.4), kerbMat);
        if (!T.street) add(ribbon(T, s0, cnt, [col(s * (W + KERB), 0.02, 0), i => [s * Math.min(W + KERB + 2.4, sideLim(T, s)(i) - 0.5), 0.02, 1]], 9), apronMat);
      }
    }
    // big flat kerbs (e.g. Sainte Devote): a wider kerb on the inside of the corner
    for (const [m0, m1, wdt, where] of T.def.bigKerbs || []) {
      const a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS); let sum = 0; for (let k = 0; k <= cnt; k++) sum += T.curv[(a + k) % N];
      const sd = (sum > 0 ? 1 : -1) * (where === 'out' ? -1 : 1);
      add(ribbon(T, a, cnt, [col(sd * (W - 0.03), 0.012, 0), col(sd * (W + 0.15), 0.05, 0.1), col(sd * (W + wdt - 0.2), 0.06, 0.9), col(sd * (W + wdt), 0.012, 1)], 2.4), kerbMat);
    }
    // tunnels (Monaco): concrete walls, a roof, and rows of lights along the ceiling
    for (const [m0, m1] of T.def.tunnels || []) {
      const a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS), Ht = 6.2;
      const conc2 = new THREE.MeshStandardMaterial({ color: '#8d9096', roughness: 0.9, side: THREE.DoubleSide }), dark = new THREE.MeshStandardMaterial({ color: '#3a3d43', roughness: 0.95, side: THREE.DoubleSide });
      for (const sd of [1, -1]) add(ribbon(T, a, cnt, [i => [sd * (sideLim(T, sd)(i) + 0.2), 0, 0], i => [sd * (sideLim(T, sd)(i) + 0.2), Ht, 1]], 6, { up: false }), conc2);
      add(ribbon(T, a, cnt, [i => [T.limL[i] + 0.3, Ht, 0], i => [-(T.limR[i] + 0.3), Ht, 1]], 6, { up: false }), dark);
      add(ribbon(T, a, cnt, [i => [T.limL[i] + 0.3, Ht + 0.6, 0], i => [-(T.limR[i] + 0.3), Ht + 0.6, 1]], 10), new THREE.MeshStandardMaterial({ color: '#8d9096', roughness: 0.9 }));
      const lamps = []; for (let k = 0; k < cnt; k += 4) lamps.push((a + k) % N);
      const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.08, 1.4).translate(0, Ht - 0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.2), toneMapped: false }), lamps.length * 2);
      const dd = new THREE.Object3D(); lamps.forEach((i, k) => { for (const sd of [1, -1]) { const l = sd * 3.2; dd.position.set(T.px[i] + T.nx[i] * l, bankH(T, i, l), T.pz[i] + T.nz[i] * l); dd.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); dd.updateMatrix(); lm.setMatrixAt(k * 2 + (sd > 0 ? 0 : 1), dd.matrix); } }); G.add(lm);
      // the hotel built over the tunnel
      const mid = (a + Math.round(cnt * 0.35)) % N, hb = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 46).translate(0, 11 + Ht + 3.5, 0), new THREE.MeshStandardMaterial({ map: tx.winDay, color: '#f0e6d8', roughness: 0.5 }));
      hb.position.set(T.px[mid], elevAt(T, mid), T.pz[mid]); hb.rotation.y = Math.atan2(T.tx[mid], T.tz[mid]) + Math.PI / 2; hb.castShadow = q > 0; G.add(hb);
    }
    // Baku's old city: tall sandstone castle walls with battlements right at the track edge
    for (const [m0, m1] of T.def.castle || []) {
      const a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS);
      const stoneT = canvasTex(256, 128, (g2, w, h) => { g2.fillStyle = '#c9ab7c'; g2.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) { g2.fillStyle = ['#c09f6f', '#d4b689', '#bb9965'][(x + y) % 3]; g2.fillRect(x + 1, y + 1, 30, 14); } });
      const stone = new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.95, side: THREE.DoubleSide });
      for (const sd of [1, -1]) {
        add(ribbon(T, a, cnt, [i => [sd * (sideLim(T, sd)(i) + 0.4), 0, 0], i => [sd * (sideLim(T, sd)(i) + 0.4), 11, 1]], 4, { up: false }), stone, { cast: q > 0 });
        const mer = []; for (let k = 0; k < cnt; k += 2) mer.push((a + k) % N);
        const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.2, 1.2).translate(0, 11.6, 0), stone, mer.length), dd = new THREE.Object3D();
        mer.forEach((i, k) => { const l = sd * (sideLim(T, sd)(i) + 0.9); dd.position.set(T.px[i] + T.nx[i] * l, bankH(T, i, l), T.pz[i] + T.nz[i] * l); dd.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); dd.updateMatrix(); im.setMatrixAt(k, dd.matrix); }); G.add(im);
      }
    }
    // wide run-off at famous corners: gravel or tarmac out to the moved-back wall
    for (const z of T.runZones || []) {
      const lim = sideLim(T, z.side), m = z.kind === 'gravel' ? new THREE.MeshStandardMaterial({ map: tx.gravel, normalMap: tx.gravelN, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: '#a3a6ad', roughness: 0.9 });
      add(ribbon(T, z.a, z.len, [col(z.side * (W + KERB + 2.4), z.kind === 'gravel' ? 0.03 : 0.025, 0), i => [z.side * Math.max(W + KERB + 2.6, lim(i) - 0.6), z.kind === 'gravel' ? 0.03 : 0.025, 3]], 8), m);
    }
    // overpasses: where the lap crosses itself (Monza 10 km), the upper road gets a concrete deck, parapet faces and piers
    {
      const up = new Uint8Array(N), lo = xLo;
      for (const [a0, a1] of rangesOf(xUp, N, v => v)) for (let k = -90; k <= a1 - a0 + 90; k++) {
        const i = (a0 + k + N) % N, gnd = Math.min(height(T.px[i] + T.nx[i] * (T.limL[i] + 1), T.pz[i] + T.nz[i] * (T.limL[i] + 1)), height(T.px[i] - T.nx[i] * (T.limR[i] + 1), T.pz[i] - T.nz[i] * (T.limR[i] + 1)), height(T.px[i], T.pz[i]));
        if (xUp[i] || gnd < bankH(T, i, 0) - 2.2) up[i] = 1;
      }
      const conc = new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.85, side: THREE.DoubleSide });
      for (const [a0, a1] of rangesOf(up, N, v => v)) {
        const a = (a0 - 3 + N) % N, cnt = a1 - a0 + 7, eL = i => T.limL[i] + 0.8, eR = i => -T.limR[i] - 0.8;
        add(ribbon(T, a, cnt, [i => [eL(i), -1.6, 0], i => [eR(i), -1.6, 1]], 8, { up: false }), conc);        // deck underside
        add(ribbon(T, a, cnt, [i => [eL(i), 1.1, 0], i => [eL(i), -1.6, 1]], 8, { up: false }), conc);         // outer faces
        add(ribbon(T, a, cnt, [i => [eR(i), -1.6, 0], i => [eR(i), 1.1, 1]], 8, { up: false }), conc);
        // piers either side of the road underneath, and solid abutments at both ends
        for (let k = 0; k <= cnt; k += 6) {
          const i = (a + k) % N; let near = false;
          for (const [ui, lj] of lo) { const dx = T.px[i] - T.px[lj], dz = T.pz[i] - T.pz[lj]; if (dx * dx + dz * dz < (T.wallOff + 3) ** 2) { near = true; break; } }
          if (near) continue;
          for (const l of [eL(i) - 1.5, eR(i) + 1.5]) {
            const x = T.px[i] + T.nx[i] * l, z = T.pz[i] + T.nz[i] * l, top = bankH(T, i, l) - 1.6, bot = height(x, z) - 1, h = top - bot;
            if (h < 0.5) continue;
            const pm = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), conc); pm.position.set(x, bot + h / 2, z); pm.castShadow = q > 0; pm.receiveShadow = true; G.add(pm);
          }
        }
      }
    }
    // bridges (Singapore's Anderson Bridge): white steel arches over both sides of the road
    for (const [m0, m1] of T.def.bridges || []) {
      const a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS), steelW = new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: 0.4, metalness: 0.5, emissive: th.night ? '#9fb3ff' : '#000000', emissiveIntensity: 0.25 });
      for (const sd of [1, -1]) for (const [u0, u1, hgt] of [[0, 0.34, 9], [0.33, 0.67, 11], [0.66, 1, 9]]) {
        const pts = []; for (let k = 0; k <= 16; k++) { const t = u0 + (u1 - u0) * k / 16, i = (a + Math.round(t * cnt)) % N, l = sd * (sideLim(T, sd)(i) + 0.6), y = bankH(T, i, l) + Math.sin(Math.PI * k / 16) * hgt; pts.push(new THREE.Vector3(T.px[i] + T.nx[i] * l, y, T.pz[i] + T.nz[i] * l)); }
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.35, 8), steelW, { cast: q > 0 });
        for (let k = 1; k < 16; k += 2) { const p0 = pts[k]; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, Math.max(0.2, p0.y - pts[0].y), 6), steelW); v.position.set(p0.x, (p0.y + pts[0].y) / 2, p0.z); G.add(v); }
      }
      // overhead: cross girders joining the two sides' arches over the road, with diagonal bracing
      for (const [u0, u1, hgt] of [[0, 0.34, 9], [0.33, 0.67, 11], [0.66, 1, 9]]) for (const f of [0.3, 0.5, 0.7]) {
        const t = u0 + (u1 - u0) * f, i = (a + Math.round(t * cnt)) % N, yy = Math.sin(Math.PI * f) * hgt;
        const L = sideLim(T, 1)(i) + 0.6, R = sideLim(T, -1)(i) + 0.6;
        const A = new THREE.Vector3(T.px[i] + T.nx[i] * L, bankH(T, i, L) + yy, T.pz[i] + T.nz[i] * L), B = new THREE.Vector3(T.px[i] - T.nx[i] * R, bankH(T, i, -R) + yy, T.pz[i] - T.nz[i] * R);
        add(new THREE.TubeGeometry(new THREE.LineCurve3(A, B), 1, 0.22, 6), steelW);
        if (f === 0.5) for (const ff of [0.3, 0.7]) { const j = (a + Math.round((u0 + (u1 - u0) * ff) * cnt)) % N, y2 = Math.sin(Math.PI * ff) * hgt, C = new THREE.Vector3(T.px[j] - T.nx[j] * R, bankH(T, j, -R) + y2, T.pz[j] - T.nz[j] * R); add(new THREE.TubeGeometry(new THREE.LineCurve3(A, C), 1, 0.12, 6), steelW); }
      }
    }
    // a giant glowing dome near the track (Las Vegas)
    if (T.def.dome) {
      const [dx2, dz2, rad] = T.def.dome, domeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveMap: canvasTex(512, 256, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff2bd6'); gr.addColorStop(0.35, '#ffb400'); gr.addColorStop(0.7, '#00d4ff'); gr.addColorStop(1, '#7c3aed'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); for (let k = 0; k < 600; k++) { g2.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.25) + ')'; g2.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }), emissiveIntensity: 1.6 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 24), domeMat); dome.position.set(dx2, height(dx2, dz2) + rad * 0.72, dz2); G.add(dome);
    }
    // Yas Marina's hotel: two glass wings either side of the track, a bridge across it, and the wavy
    // diamond-lattice gridshell roof over everything (lit up in changing colours at night)
    const keepOut = []; this.hotelShell = null;
    if (T.def.hotel) {
      const [m0, m1] = T.def.hotel, a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS), H = 38, gap = 3, dep = 20;
      const facade = th.night ? new THREE.MeshStandardMaterial({ color: '#1d2a3a', roughness: 0.25, metalness: 0.5, emissive: '#cfe6ff', emissiveMap: tx.winNight, emissiveIntensity: 0.7 })
        : new THREE.MeshStandardMaterial({ map: tx.winDay, color: '#d6e6f4', roughness: 0.15, metalness: 0.55 });
      const white2 = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.5 });
      const segs2 = []; for (let k = 0; k <= cnt; k += 3) segs2.push((a + k) % N);
      const wing = new THREE.InstancedMesh(new THREE.BoxGeometry(8.2, H, dep).translate(0, H / 2, 0), facade, segs2.length * 2), dd = new THREE.Object3D();
      segs2.forEach((i, k) => { for (const sd of [1, -1]) { const l = sd * (sideLim(T, sd)(i) + gap + dep / 2), x = T.px[i] + T.nx[i] * l, z = T.pz[i] + T.nz[i] * l; dd.position.set(x, elevAt(T, i), z); dd.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); dd.updateMatrix(); wing.setMatrixAt(k * 2 + (sd > 0 ? 0 : 1), dd.matrix); keepOut.push([x, z, dep]); } });
      wing.castShadow = q > 0; wing.receiveShadow = true; G.add(wing);
      // the bridge linking the wings, right over the track
      const mid = (a + Math.round(cnt * 0.5)) % N, L = sideLim(T, 1)(mid) + gap, R = sideLim(T, -1)(mid) + gap;
      const br = new THREE.Mesh(new THREE.BoxGeometry(L + R, 7, 16), facade); const cl = (L - R) / 2;
      br.position.set(T.px[mid] + T.nx[mid] * cl, elevAt(T, mid) + 22, T.pz[mid] + T.nz[mid] * cl); br.rotation.y = Math.atan2(T.tx[mid], T.tz[mid]) + Math.PI / 2; br.castShadow = q > 0; G.add(br);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(L + R, 0.8, 17), white2); slab.position.copy(br.position); slab.position.y -= 3.9; slab.rotation.copy(br.rotation); G.add(slab);
      // gridshell: a lattice of glass diamonds over both wings and the track, bulging up in the middle
      const lat = canvasTex(256, 256, (g2, w, h) => { g2.clearRect(0, 0, w, h); g2.fillStyle = 'rgba(150,190,220,0.18)'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#f2f5f8'; g2.lineWidth = 7; for (let k = -w; k <= 2 * w; k += 64) { g2.beginPath(); g2.moveTo(k, 0); g2.lineTo(k + h, h); g2.stroke(); g2.beginPath(); g2.moveTo(k, h); g2.lineTo(k + h, 0); g2.stroke(); } });
      lat.wrapS = lat.wrapT = THREE.RepeatWrapping;
      const shellMat = new THREE.MeshStandardMaterial({ map: lat, transparent: true, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.3, depthWrite: false, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? lat : null, emissiveIntensity: 0.9 });
      if (th.night) this.hotelShell = shellMat;
      const C = 15, cols2 = [];
      for (let c2 = 0; c2 < C; c2++) cols2.push(i => {
        const u = c2 / (C - 1), t = ((i - a + N) % N) / cnt, Lo = sideLim(T, 1)(i) + gap + dep + 3, Ro = sideLim(T, -1)(i) + gap + dep + 3;
        const o = -Ro + (Lo + Ro) * u, lift = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ;
        return [o, H + 1 + (4 + 14 * Math.sin(Math.PI * u)) * (0.35 + 0.65 * lift) - bankH(T, i, o) + elevAt(T, i), u * (Lo + Ro) / 12];
      });
      add(ribbon(T, (a - 3 + N) % N, cnt + 6, cols2, 12, { up: false }), shellMat);
    }
    const stl = new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.5, metalness: 0.6 });
    const frameAt2 = (i, lat) => { const o = new THREE.Object3D(); o.position.set(T.px[i] + T.nx[i] * lat, elevAt(T, i), T.pz[i] + T.nz[i] * lat); o.rotation.y = Math.atan2(T.tx[i], T.tz[i]); return o; };
    const B0 = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = q > 0; return o; };
    // real-life landmarks (def.landmarks): [type, x, z, rotationDeg, scale] at real map positions, or
    // [type, { m, side, off }] placed by distance along the lap. Pushed back if they would touch the track.
    {
      const night = th.night, glassD = new THREE.MeshStandardMaterial({ map: tx.winDay, color: '#cfe0ee', roughness: 0.2, metalness: 0.5 });
      const glassN = new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.3, metalness: 0.4, emissive: '#ffe2b0', emissiveMap: tx.winNight, emissiveIntensity: 0.8 });
      const glass = night ? glassN : glassD, stone = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), metalM = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.7 });
      const glow = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(night ? 2 : 1), toneMapped: !night });
      const nearTrack = (x, z) => { let best = 1e9; for (let i = 0; i < N; i += 2) { const d = Math.hypot(T.px[i] - x, T.pz[i] - z); if (d < best) best = d; } return best; };
      const B = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = q > 0; return o; };
      const wheel = (R, legH) => { const g = new THREE.Group(), st = metalM('#e8ecf0'); g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 1.2, 8, 64), st)); for (let k = 0; k < 16; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, R * 2, 5), st); sp.rotation.z = k * Math.PI / 16; g.add(sp); } const cap = new THREE.InstancedMesh(new THREE.SphereGeometry(2.6, 10, 8), night ? glow('#9fd8ff') : new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }), 28), dd = new THREE.Object3D(); for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; dd.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); dd.updateMatrix(); cap.setMatrixAt(k, dd.matrix); } g.add(cap); if (night) g.add(new THREE.Mesh(new THREE.TorusGeometry(R + 0.5, 0.5, 6, 64), glow('#4fc3ff'))); g.position.y = legH; const o = new THREE.Group(); o.add(g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, legH * 1.15, 6), st); l.position.set(sx * legH * 0.28, legH / 2, sz * 4); l.rotation.z = -sx * 0.27; o.add(l); } return o; };
      const tower = (w, h, d) => B(w, h, d, glass);
      const BUILD = {
        // Singapore: Marina Bay Sands, three 194 m towers with the SkyPark across the top
        mbs: () => { const g = new THREE.Group(); for (const x of [-62, 0, 62]) { g.add(tower(36, 194, 24).translateX(x)); g.add(B(30, 194, 6, glass, x, 0, 13)); } g.add(B(340, 8, 38, stone('#e9edf1'), 10, 194)); g.add(B(80, 3, 30, new THREE.MeshStandardMaterial({ color: '#3fa7d6', roughness: 0.1 }), 150, 202)); return g; },
        flyer: () => wheel(75, 90), highroller: () => wheel(80, 92),
        fullerton: () => { const g = new THREE.Group(), c = stone('#efe6d2'); g.add(B(110, 28, 90, c)); for (let k = 0; k < 12; k++) g.add(B(2.4, 18, 2.4, stone('#f8f3e6'), -50 + k * 9, 4, 46)); g.add(B(30, 6, 30, stone('#d9cfb8'), 0, 28)); return g; },
        // Monaco
        casino: () => { const g = new THREE.Group(), c = stone('#e7d3b0'), roof = stone('#6f8f7c'); g.add(B(70, 22, 40, c)); for (const x of [-30, 30]) { g.add(B(10, 30, 10, c, x, 0, 16)); const d = new THREE.Mesh(new THREE.ConeGeometry(6, 9, 4), roof); d.position.set(x, 34.5, 16); d.rotation.y = Math.PI / 4; g.add(d); } const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 8, 0, 6.3, 0, 1.5), roof); dome.position.y = 22; g.add(dome); if (night) g.add(B(70.5, 1, 40.5, glow('#ffd27a'), 0, 21)); return g; },
        hoteldeparis: () => { const g = new THREE.Group(); g.add(B(100, 30, 40, stone('#f3ece0'))); g.add(B(102, 3, 42, stone('#c9b89a'), 0, 30)); return g; },
        palace: () => { const g = new THREE.Group(), c = stone('#e9d9b6'); g.add(B(160, 55, 120, stone('#8a7a62'))); g.add(B(120, 18, 60, c, 0, 55)); for (let k = 0; k < 10; k++) g.add(B(3, 3, 3, c, -55 + k * 12, 73, 30)); g.add(B(10, 30, 10, c, 50, 55, 20)); return g; },
        // Las Vegas
        bellagio: () => { const g = new THREE.Group(); for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.16, t = tower(26, 150 - Math.abs(k - 3) * 12, 30); t.position.set(Math.sin(a) * 90, 0, Math.cos(a) * 90 - 90); t.rotation.y = a; g.add(t); } const lake = new THREE.Mesh(new THREE.PlaneGeometry(260, 90).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1d4e6b', roughness: 0.05, metalness: 0.6 })); lake.position.set(0, 0.3, 80); g.add(lake); if (night) for (let k = 0; k < 14; k++) g.add(B(1.2, 30 + 20 * Math.sin(k), 1.2, glow('#e8f6ff'), -110 + k * 17, 0.3, 80)); return g; },
        caesars: () => { const g = new THREE.Group(); g.add(tower(60, 120, 30)); g.add(tower(30, 100, 60).translateX(55)); g.add(B(200, 14, 80, stone('#f1ebe0'), 20, 0, 60)); return g; },
        // Baku: the three Flame Towers, lit up like flames at night
        flametowers: () => { const g = new THREE.Group(); for (const [x, z, h] of [[0, 0, 190], [-70, 40, 160], [70, 40, 160]]) { const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push(new THREE.Vector2(26 * Math.pow(1 - u, 0.6) * (1 + 0.15 * Math.sin(u * 3)), u * h)); } const t = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), night ? new THREE.MeshStandardMaterial({ color: '#30150a', emissive: '#ff6a1a', emissiveIntensity: 1.4 }) : glassD); t.position.set(x, 0, z); t.castShadow = q > 0; g.add(t); } return g; },
        // COTA observation tower: red "veil" of cables round a lift shaft, deck on top
        cotatower: () => { const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.5 }); g.add(B(5, 77, 5, stone('#d9dde2'))); for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, A = new THREE.Vector3(Math.cos(a) * 16, 0, Math.sin(a) * 16), Bv = new THREE.Vector3(Math.cos(a) * 3, 74, Math.sin(a) * 3); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(A, Bv), 1, 0.35, 5), red)); } g.add(B(16, 3, 16, stone('#f4f4f4'), 0, 74)); return g; },
        sakhirtower: () => { const g = new THREE.Group(); g.add(tower(34, 48, 34)); g.add(B(46, 3, 46, stone('#efe3c8'), 0, 48)); g.add(B(20, 6, 20, stone('#efe3c8'), 0, 51)); return g; },
        biosphere: () => { const g = new THREE.Group(), sph = new THREE.Mesh(new THREE.IcosahedronGeometry(38, 3), new THREE.MeshStandardMaterial({ color: '#dfe6ee', wireframe: true })); sph.position.y = 30; g.add(sph); const inner = new THREE.Mesh(new THREE.SphereGeometry(37, 24, 16), new THREE.MeshStandardMaterial({ color: '#a8c4d8', transparent: true, opacity: 0.25 })); inner.position.y = 30; g.add(inner); return g; },
        bull: () => { const g = new THREE.Group(), m = metalM('#9aa3ad'); g.add(B(12, 7, 26, m, 0, 6)); g.add(B(8, 7, 8, m, 0, 9, 15)); for (const sx of [-1, 1]) { for (const z of [-9, 9]) g.add(B(2.2, 6, 2.2, m, sx * 4, 0, z)); const h = new THREE.Mesh(new THREE.ConeGeometry(1, 7, 6), m); h.position.set(sx * 5.5, 17, 16); h.rotation.z = -sx * 0.9; g.add(h); } return g; },
        hardrock: () => { const g = new THREE.Group(), s2 = new THREE.Mesh(new THREE.CylinderGeometry(130, 105, 42, 40, 1, true), new THREE.MeshStandardMaterial({ map: tx.crowd, side: THREE.BackSide, roughness: 0.9 })); s2.position.y = 21; g.add(s2); const wall = new THREE.Mesh(new THREE.CylinderGeometry(133, 133, 44, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.6, metalness: 0.3 })); wall.position.y = 22; g.add(wall); g.add(new THREE.Mesh(new THREE.CircleGeometry(104, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3f8f3a' }))); const roof = new THREE.Mesh(new THREE.RingGeometry(85, 140, 40).rotateX(-Math.PI / 2), stone('#f2f2f2')); roof.position.y = 48; g.add(roof); return g; },
        ferrariworld: () => { const g = new THREE.Group(), r = new THREE.Mesh(new THREE.CylinderGeometry(330, 360, 30, 3, 1), new THREE.MeshStandardMaterial({ color: '#c4161c', roughness: 0.5 })); r.position.y = 15; r.scale.set(1, 1, 0.6); g.add(r); return g; },
        skyline: (n = 30, R = 450) => { const g = new THREE.Group(); for (let k = 0; k < n; k++) { const a = r() * 6.28, d = r() * R, h = 60 + r() * r() * 260; g.add(tower(25 + r() * 25, h, 25 + r() * 25).translateX(Math.cos(a) * d).translateZ(Math.sin(a) * d)); } return g; },
        banking: () => { const g = new THREE.Group(), pts = []; for (let k = 0; k <= 40; k++) { const a = Math.PI * k / 40; pts.push([Math.cos(a) * 160, Math.sin(a) * 160]); } for (let k = 0; k < 40; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0), m2 = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.6, 14), stone('#b9b4aa')); m2.position.set((x0 + x1) / 2, 4, (z0 + z1) / 2); m2.rotation.set(0, -Math.atan2(z1 - z0, x1 - x0), 0); m2.rotateX(0.75); g.add(m2); } return g; },
        castle: () => { const g = new THREE.Group(), c = stone('#9b8f7c'); g.add(B(60, 14, 40, c)); g.add(B(14, 34, 14, c, 0, 0, 0)); for (const [x, z] of [[-30, -20], [30, -20], [-30, 20], [30, 20]]) g.add(B(6, 18, 6, c, x, 0, z)); return g; },
        // London
        bigben: () => { const g = new THREE.Group(), c = stone('#c9b27e'), clockM = th.night ? glow('#fff2c0') : stone('#f4efe2'); g.add(B(13, 62, 13, c)); g.add(B(14, 14, 14, c, 0, 62)); for (const [x, z, ry] of [[0, 7.05, 0], [0, -7.05, Math.PI], [7.05, 0, Math.PI / 2], [-7.05, 0, -Math.PI / 2]]) { const f = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), clockM); f.position.set(x, 69, z); f.rotation.y = ry; g.add(f); } g.add(B(11, 8, 11, c, 0, 76)); const sp = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 4), stone('#3c4a44')); sp.position.y = 91; sp.rotation.y = Math.PI / 4; g.add(sp); g.add(B(60, 26, 22, c, -34, 0, 0)); return g; },
        londoneye: () => { const o = wheel(60, 68); return o; },
        nelson: () => { const g = new THREE.Group(), c = stone('#d8d2c2'); g.add(B(10, 6, 10, c)); const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 40, 16), c); col.position.y = 26; g.add(col); g.add(B(4, 4, 4, c, 0, 46)); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 8), stone('#4a4f55')); st.position.y = 52.5; g.add(st); for (const [x, z] of [[7, 7], [-7, 7], [7, -7], [-7, -7]]) g.add(B(3, 2.2, 6, stone('#2b2f34'), x, 0, z)); return g; },
        buckingham: () => { const g = new THREE.Group(), c = stone('#e3dccb'); g.add(B(108, 24, 40, c)); g.add(B(40, 30, 6, c, 0, 0, 22)); for (let k = 0; k < 6; k++) g.add(B(2, 20, 2, stone('#f2ede2'), -12.5 + k * 5, 3, 25.5)); g.add(B(110, 2, 42, stone('#bcb3a0'), 0, 24)); return g; },
        abbey: () => { const g = new THREE.Group(), c = stone('#cdbf9f'); g.add(B(30, 32, 120, c)); for (const x of [-11, 11]) { g.add(B(10, 68, 10, c, x, 0, 58)); const p2 = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 4), c); p2.position.set(x, 72, 58); g.add(p2); } const roof = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 118, 3, 1), stone('#5d6a66')); roof.rotation.x = Math.PI / 2; roof.rotation.z = Math.PI / 2; roof.position.y = 36; roof.scale.set(1, 1, 0.5); g.add(roof); return g; },
        dunlop: () => { const g = new THREE.Group(), tyre = new THREE.Mesh(new THREE.TorusGeometry(15, 4, 12, 40, Math.PI), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })); g.add(tyre); const band = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 1), new THREE.MeshStandardMaterial({ color: '#f5c400' })); band.position.set(0, 17, 4.2); g.add(band); return g; },
      };
      for (const L of T.def.landmarks || []) {
        const fn = BUILD[L[0]]; if (!fn) continue;
        let x, z, rot = 0, sc = 1;
        if (typeof L[1] === 'object') { const o = L[1], i = Math.round(o.m / DS) % N, sd = o.side || 1, lat = o.center ? 0 : sd * ((sd > 0 ? T.limL[i] : T.limR[i]) + (o.off || 0)); x = T.px[i] + T.nx[i] * lat; z = T.pz[i] + T.nz[i] * lat; rot = Math.atan2(T.tx[i], T.tz[i]) + (o.rot || 0); sc = o.scale || 1; }
        else { x = L[1]; z = L[2]; rot = (L[3] || 0) * Math.PI / 180; sc = L[4] || 1; }
        const obj = L[0] === 'skyline' ? fn(L[5], L[6]) : fn(); obj.scale.setScalar(sc);
        const box = new THREE.Box3().setFromObject(obj), rad = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 * 0.7;
        // keep it off the track (bridges and arches over the road are allowed)
        if (!['dunlop'].includes(L[0]) && typeof L[1] !== 'object') { for (let it = 0; it < 30 && nearTrack(x, z) < rad + W + KERB + 6; it++) { let bi = 0, bd = 1e9; for (let i = 0; i < N; i += 2) { const d = Math.hypot(T.px[i] - x, T.pz[i] - z); if (d < bd) { bd = d; bi = i; } } const ux = (x - T.px[bi]) / (bd || 1), uz = (z - T.pz[bi]) / (bd || 1); x += ux * 10; z += uz * 10; } }
        obj.position.set(x, (L[0] === 'dunlop' ? elevAt(T, Math.round(L[1].m / DS) % N) : height(x, z)) - 0.5, z); obj.rotation.y = rot; G.add(obj);
        keepOut.push([x, z, rad + 10]);
      }
    }
    // def.stadium: [[from, to, side, height]] steep tiered stands that follow the track round a stadium section (Mexico's Foro Sol)
    for (const [m0, m1, sd, Hs] of T.def.stadium || []) {
      const a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS), lim = sideLim(T, sd), D = Hs * 1.35;
      const crowdM = new THREE.MeshStandardMaterial({ map: tx.crowd, roughness: 0.9, side: THREE.DoubleSide, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tx.crowd : null, emissiveIntensity: 0.12 });
      add(ribbon(T, a, cnt, [i => [sd * (lim(i) + 2), 0, 0], i => [sd * (lim(i) + 2), 2.2, 0.06], i => [sd * (lim(i) + 2 + D), Hs, 1]], 4), crowdM, { cast: q > 0 });
      add(ribbon(T, a, cnt, [i => [sd * (lim(i) + 2 + D), Hs, 0], i => [sd * (lim(i) + 2 + D), Hs + 4, 1]], 6, { up: false }), new THREE.MeshStandardMaterial({ color: '#dcdfe4', roughness: 0.8, side: THREE.DoubleSide }));
      add(ribbon(T, a, cnt, [i => [sd * (lim(i) + 2 + D), 0, 0], i => [sd * (lim(i) + 2 + D), Hs, 1]], 6, { up: false }), new THREE.MeshStandardMaterial({ color: '#8d939c', roughness: 0.9, side: THREE.DoubleSide }));
      for (let k = 0; k <= cnt; k += 60) { const i = (a + k) % N, l = sd * (lim(i) + 4 + D), lt = new THREE.Group(); lt.add(B0(1.2, Hs + 26, 1.2, stl)); lt.add(B0(8, 3, 1, new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(th.night ? 4 : 1.2), toneMapped: false }), 0, Hs + 26)); lt.position.set(T.px[i] + T.nx[i] * l, elevAt(T, i), T.pz[i] + T.nz[i] * l); lt.rotation.y = Math.atan2(T.tx[i], T.tz[i]); G.add(lt); }
      for (let k = 0; k <= cnt; k += 8) { const i = (a + k) % N, l = sd * (lim(i) + 2 + D / 2); keepOut.push([T.px[i] + T.nx[i] * l, T.pz[i] + T.nz[i] * l, D / 2 + 4]); }
    }
    if (harbourPoly) {
      const H = T.def.harbour, a = Math.round(H.from / DS) % N, cnt = Math.round((H.to - H.from) / DS), sd = H.side, lim = sideLim(T, sd), qy = H.quay || 9, wl = th.water ? th.water.level : 0;
      const quayM = new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.85, side: THREE.DoubleSide }), paveM = new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 0.9 });
      add(ribbon(T, a, cnt, [i => [sd * (lim(i) + 0.4), 0.04, 0], i => [sd * (lim(i) + qy + 0.3), 0.04, 1]], 6), paveM);
      add(ribbon(T, a, cnt, [i => [sd * (lim(i) + qy), wl - 3 - elevAt(T, i), 0], i => [sd * (lim(i) + qy), 0.05, 1]], 6, { up: false }), quayM);
      // yachts: rows of pontoons with boats moored stern-to on both sides, superyachts along the quays
      const yachts = [], piers = [], Y = (x, z, h, sc, kind) => { if (inHarbour(x, z) && inHarbour(x + Math.sin(h) * 10 * sc, z + Math.cos(h) * 10 * sc) && inHarbour(x - Math.sin(h) * 10 * sc, z - Math.cos(h) * 10 * sc)) yachts.push([x, z, h, sc, kind]); };
      for (let z = hb[2] + 40; z < hb[3] - 30; z += 56) {
        let x0 = null; for (let x = hb[0] + 10; x < hb[1] - 60; x += 4) { const ok = inHarbour(x, z) && inHarbour(x, z - 18) && inHarbour(x, z + 18); if (ok && x0 === null) x0 = x; if ((!ok || x >= hb[1] - 64) && x0 !== null) { if (x - x0 > 30) { const w = x - x0; piers.push([x0, x0 + w * 0.42, z]); if (w > 160) piers.push([x - w * 0.2, x, z]); } x0 = null; } }   // open water down the middle
      }
      for (const [x0, x1, z] of piers) for (const s2 of [-1, 1]) for (let x = x0 + 6; x < x1 - 4;) { const sc = 0.65 + r() * r() * 0.75; if (r() < 0.88) Y(x, z + s2 * (2.5 + 10.5 * sc), s2 > 0 ? 0 : Math.PI, sc, r() < 0.15 ? 1 : 0); x += 5.6 * sc + 1.6; }
      for (let k = 0; k <= cnt; k += 22) { const i = (a + k) % N, l = sd * (lim(i) + qy + 9), h0 = Math.atan2(T.tx[i], T.tz[i]); Y(T.px[i] + T.nx[i] * l, T.pz[i] + T.nz[i] * l, h0, 2.2 + r() * 1.2, r() < 0.3 ? 1 : 0); }
      const pier = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 4), new THREE.MeshStandardMaterial({ color: '#6b6258', roughness: 0.9 }), piers.length), dd = new THREE.Object3D();
      piers.forEach(([x0, x1, z], k) => { dd.position.set((x0 + x1) / 2, wl + 0.35, z); dd.rotation.set(0, 0, 0); dd.scale.set(x1 - x0, 1, 1); dd.updateMatrix(); pier.setMatrixAt(k, dd.matrix); }); G.add(pier);
      yachtFleet(G, yachts, wl, th, q);
      this.yachtCount = yachts.length;
      // the blue floating platform with a white canopy (hospitality / grandstand barge)
      if (H.barge !== undefined) { const i = Math.round(H.barge / DS) % N, l = sd * (lim(i) + qy + 26), fr = frameAt2(i, l); fr.position.y = wl; fr.add(B0(50, 3, 18, new THREE.MeshStandardMaterial({ color: '#1f3fa8', roughness: 0.5 }), 0, -1)); fr.add(B0(46, 0.6, 16, new THREE.MeshStandardMaterial({ map: tx.crowd, roughness: 0.9 }), 0, 2)); const roof = new THREE.Mesh(new THREE.ConeGeometry(30, 6, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.42), new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.5, side: THREE.DoubleSide })); roof.position.y = 10; fr.add(roof); for (const x of [-20, 20]) for (const z of [-6, 6]) fr.add(B0(0.4, 8, 0.4, stl, x, 2, z)); G.add(fr); }
    }
    // def.pool: [from, to, side] Monaco's Rainier III swimming pool on the harbour front, which the Piscine chicanes swing round
    if (T.def.pool) {
      const [m0, m1, sd] = T.def.pool, a = Math.round(m0 / DS) % N, cnt = Math.round((m1 - m0) / DS), lim = sideLim(T, sd), lat = (i, d) => sd * (lim(i) + d);
      const deck = new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.8 });
      const water = new THREE.MeshStandardMaterial({ color: '#2fb4e0', roughness: 0.05, metalness: 0.2, emissive: th.night ? '#1a8fd0' : '#000000', emissiveIntensity: 0.6 });
      add(ribbon(T, (a - 4 + N) % N, cnt + 8, [i => [lat(i, 0.6), 0.05, 0], i => [lat(i, 34), 0.05, 1]], 8), deck);
      add(ribbon(T, a, cnt, [i => [lat(i, 7), 0.12, 0], i => [lat(i, 27), 0.12, 1]], 8), water);
      for (const d of [11, 15, 19, 23]) add(ribbon(T, a, cnt, [i => [lat(i, d - 0.12), 0.14, 0], i => [lat(i, d + 0.12), 0.14, 1]], 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      for (const k of [0, cnt]) { const i = (a + k) % N; for (let d = 9; d <= 25; d += 4) { const o = B0(1, 0.8, 1, deck, 0, 0, 0); o.position.set(T.px[i] + T.nx[i] * lat(i, d), elevAt(T, i), T.pz[i] + T.nz[i] * lat(i, d)); G.add(o); } }
      const mid = (a + Math.round(cnt * 0.5)) % N, dt2 = new THREE.Group(); dt2.add(B0(4, 10, 4, deck)); dt2.add(B0(6, 0.4, 2, deck, 0, 10, 2)); dt2.position.set(T.px[mid] + T.nx[mid] * lat(mid, 31), elevAt(T, mid), T.pz[mid] + T.nz[mid] * lat(mid, 31)); dt2.rotation.y = Math.atan2(T.tx[mid], T.tz[mid]); G.add(dt2);
      for (let k = 0; k <= cnt; k += 6) { const i = (a + k) % N; keepOut.push([T.px[i] + T.nx[i] * lat(i, 17), T.pz[i] + T.nz[i] * lat(i, 17), 20]); }
    }
    // def.graffiti (Nordschleife): fan graffiti painted on the road: messages, flags, hearts and smileys,
    // readable by the driver coming towards them, denser at the famous spectator spots
    if (T.def.graffiti) {
      const MSG = ['GRÜNE HÖLLE', 'VOLLGAS!', 'NO LIFT', 'GO GO GO', 'RING ♥', 'EIFEL', 'FULL SEND', 'ALLEZ!', 'LATE BRAKE', 'HI MUM', 'BRÜNNCHEN', 'SEND IT', 'FLAT OUT', 'TOUCH WOOD', '24H', 'KEEP LEFT', 'RINGTOOL', 'YOU GOT THIS', 'VMAX', 'HELLO WORLD'];
      const PAINT = ['#f4f4f2', '#f4f4f2', '#f4f4f2', '#ffd23a', '#ff4a3a', '#36b6ff'];
      const rr = rng(77), kinds = [];
      const tag = (draw) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
      const spray = (g, col, fn) => { g.globalAlpha = 0.9; g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; fn(); g.globalAlpha = 1; for (let k = 0; k < 90; k++) { g.fillStyle = col; g.globalAlpha = 0.35 * rr(); g.fillRect(rr() * 512, rr() * 256, 2, 2); } g.globalAlpha = 1; };
      for (let k = 0; k < 14; k++) {
        const col = PAINT[k % PAINT.length], m = MSG[k];
        kinds.push(tag(g => spray(g, col, () => { g.save(); g.translate(256, 128); g.rotate((rr() - 0.5) * 0.12); g.font = 'italic 900 ' + (m.length > 9 ? 74 : 104) + 'px "Barlow Condensed", Impact, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeText(m, 0, 0); g.fillText(m, 0, 0); g.restore(); })));
      }
      kinds.push(tag(g => spray(g, '#ff4a3a', () => { g.beginPath(); g.moveTo(256, 220); g.bezierCurveTo(60, 110, 150, 10, 256, 80); g.bezierCurveTo(362, 10, 452, 110, 256, 220); g.fill(); })));                              // heart
      kinds.push(tag(g => spray(g, '#ffd23a', () => { g.lineWidth = 14; g.beginPath(); g.arc(256, 128, 100, 0, 7); g.stroke(); g.beginPath(); g.arc(256, 140, 55, 0.2, Math.PI - 0.2); g.stroke(); g.fillRect(215, 85, 18, 28); g.fillRect(280, 85, 18, 28); })));   // smiley
      kinds.push(tag(g => spray(g, '#f4f4f2', () => { for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) g.fillRect(96 + x * 40, 48 + y * 40, 40, 40); g.lineWidth = 4; g.strokeRect(96, 48, 320, 160); })));   // chequered flag
      kinds.push(tag(g => spray(g, '#f4f4f2', () => { g.lineWidth = 22; g.beginPath(); g.moveTo(256, 230); g.lineTo(256, 50); g.stroke(); g.beginPath(); g.moveTo(180, 120); g.lineTo(256, 40); g.lineTo(332, 120); g.stroke(); })));   // arrow
      const gMat = kinds.map(t => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const geos = kinds.map(() => []), hot = (T.def.graffiti.hot || []).map(m => Math.round(m / DS));
      let i = 40;
      while (i < N - 40) {
        const nearHot = hot.some(h => Math.abs(h - i) < 300), k = Math.floor(rr() * kinds.length), len = Math.round((k < 14 ? 11 + rr() * 7 : 6 + rr() * 3) / DS), half = k < 14 ? 4.2 + rr() * 1.6 : 3.2, lat = (rr() * 2 - 1) * (W - half - 0.5);
        if (Math.abs(T.curv[i]) < 1 / 25) geos[k].push(ribbon(T, i, len, [() => [lat + half, 0.035, 0], () => [lat - half, 0.035, 1]], len * DS));
        i += Math.round((nearHot ? 9 + rr() * 16 : 45 + rr() * 80) / DS);
      }
      geos.forEach((list, k) => { if (list.length) { const m2 = add(mergeGeometries(list), gMat[k]); m2.renderOrder = 2; m2.receiveShadow = true; } });
    }
    // def.phoneboxes: red telephone boxes along the pavement (London)
    if (T.def.phoneboxes) {
      const red = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.45 }), glassP = new THREE.MeshStandardMaterial({ color: th.night ? '#ffe9b0' : '#9fb4c2', emissive: th.night ? '#ffd480' : '#000000', emissiveIntensity: 0.8 }), rr = rng(41);
      for (let i = 60; i < N - 30; i += Math.round((110 + rr() * 120) / DS)) {
        const sd = rr() < 0.5 ? 1 : -1, l = sd * (sideLim(T, sd)(i) + 1.6), fr = frameAt2(i, l);
        fr.add(B0(1.0, 2.5, 1.0, red)); fr.add(B0(1.04, 1.4, 0.9, glassP, 0, 0.7)); fr.add(B0(1.1, 0.25, 1.1, red, 0, 2.5)); G.add(fr);
      }
    }
    // def.wings: metres where a grandstand-to-pits bridge with a big curved "wing" roof crosses the main straight (Shanghai)
    for (const m of T.def.wings || []) {
      const i = Math.round(m / DS) % N, L = T.limL[i] + 30, R = T.limR[i] + 30, fr = frameAt2(i, (L - R) / 2); G.add(fr);
      fr.add(B0(L + R, 6, 30, new THREE.MeshStandardMaterial({ map: tx.winDay, color: '#dbe4ec', roughness: 0.3, metalness: 0.4 }), 0, 12));
      const w = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 34, 32, 1, true, Math.PI / 2 - 0.55, 1.1), new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide })); w.rotation.set(0, 0, Math.PI / 2); w.position.y = -32; fr.add(w);
      for (const sx of [-1, 1]) fr.add(B0(3, 12, 3, stl, sx * (L + R) / 2 * 0.95, 0));
    }
    // escape roads straight on through chicanes: asphalt with white edge lines and painted chevrons
    for (const z of T.escapes || []) {
      const lat = i => z.off.has(i) ? z.off.get(i) : 0, i0 = z.a, cnt = z.len;
      const escMat = new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: '#b4b7bd', roughness: 0.88 });
      add(ribbon(T, i0, cnt, [i => [lat(i) - 3.6, 0.018, 0], i => [lat(i) + 3.6, 0.018, 1]], 6), escMat);
      for (const e of [-1, 1]) add(ribbon(T, i0, cnt, [i => [lat(i) + e * 3.4, 0.024, 0], i => [lat(i) + e * 3.6, 0.024, 1]], 4), lineMat);
    }
    // sausage kerbs on the inside of chicane apexes: raised, yellow with black stripes
    if ((T.sausages || []).length) {
      const sTex = canvasTex(64, 64, (g2, w, h) => { g2.fillStyle = '#f5c400'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#111'; for (let y = 0; y < h; y += 16) g2.fillRect(0, y, w, 7); });
      const sMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.6 });
      for (const sg of T.sausages) {
        const n0 = (sg.i - sg.half + N) % N, sl = sg.side, base = W + KERB + 0.35;
        const prof = [[-0.18, 0], [-0.13, 0.08], [0, 0.13], [0.13, 0.08], [0.18, 0]];
        const m = add(ribbon(T, n0, sg.half * 2, prof.map(([d2, hh], k) => col(sl * (base + d2), hh, k / (prof.length - 1))), 1.2), sMat, { cast: q > 0 });
        m.userData.sausage = true;
      }
    }
    // gravel traps + tyre walls
    const gravelMat = new THREE.MeshStandardMaterial({ map: tx.gravel, normalMap: tx.gravelN, roughness: 1 });
    const tyreMat = new THREE.MeshStandardMaterial({ map: tx.tyresWall, roughness: 0.9, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      for (const [a, b] of rangesOf(T.gravel, N, v => v === s)) {
        const lim = sideLim(T, s);
        add(ribbon(T, a, b - a, [col(s * (W + KERB + 2.4), 0.022, 0), i => [s * Math.max(W + KERB + 2.6, lim(i) - 1.2), 0.022, 3]], 8), gravelMat);
        add(ribbon(T, a, b - a, [i => [s * (lim(i) - 0.55), 0, 0], i => [s * (lim(i) - 0.55), 1.0, 1]], 8, { up: false }), tyreMat, { cast: q > 0 });
      }
    }
    // barriers: armco (circuits) or concrete with ad boards (streets), plus debris fence.
    // On the pit side the wall has gaps at pit entry and exit; between them it becomes the pit wall.
    const P = T.pit;
    const segsFor = s => s !== P.side ? [[0, N]] : [[P.exit, (P.entry - P.exit + N) % N], [(P.entry + 40) % N, ((P.exit - 40) - (P.entry + 40) + 2 * N) % N]];
    const inPitGap = (i, s) => s === P.side && (((i - P.entry + N) % N) < 40 || ((P.exit - i + N) % N) < 40) && ((i - P.entry + N) % N) <= P.len;
    for (const s of [1, -1]) {
      const lim = sideLim(T, s);
      const ft = tx.fence.clone(); ft.needsUpdate = true;
      const fenceMat = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
      const adMat = T.street ? new THREE.MeshStandardMaterial({ map: tx.adsWall, roughness: 0.6, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tx.adsWall : null, emissiveIntensity: 0.3, side: THREE.DoubleSide }) : null;
      const rail = new THREE.MeshStandardMaterial({ color: '#c3c8cf', roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide });
      const wallBand = new THREE.MeshStandardMaterial({ color: th.wallB, roughness: 0.6, side: THREE.DoubleSide });
      const capMat = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.8 });
      for (const [i0, cnt] of T.def.noBarriers ? [] : segsFor(s)) {   // rally stages: no barriers drawn, just the roadside
        if (cnt < 2) continue;
        if (T.street) {
          add(ribbon(T, i0, cnt, [i => [s * lim(i), 0, 0], i => [s * lim(i), 1.15, 1]], 30, { up: false }), adMat, { cast: q > 0 });
          add(ribbon(T, i0, cnt, [i => [s * lim(i), 1.15, 0], i => [s * (lim(i) + 0.5), 1.15, 1]], 8), capMat);
        } else {
          add(ribbon(T, i0, cnt, [i => [s * lim(i), 0.45, 0], i => [s * lim(i), 0.78, 1]], 8, { up: false }), rail, { cast: q > 0 });
          add(ribbon(T, i0, cnt, [i => [s * lim(i), 0.9, 0], i => [s * lim(i), 1.15, 1]], 8, { up: false }), rail);
          add(ribbon(T, i0, cnt, [i => [s * (lim(i) + 0.05), 0, 0], i => [s * (lim(i) + 0.05), 0.45, 1]], 8, { up: false }), wallBand);
        }
        add(ribbon(T, i0, cnt, [i => [s * (lim(i) + 0.4), 1.15, 0], i => [s * (lim(i) + 0.4), 4.2, 1]], 3.05, { up: false }), fenceMat, { recv: false });
      }
    }
    if (T.banked) for (const s of [1, -1]) {
      const lim = sideLim(T, s);
      add(ribbon(T, 0, N, [i => [s * (lim(i) + 0.5), 0, 0], i => [s * (lim(i) + 0.5 + Math.max(2, bankH(T, i, s * lim(i)) * 2.2)), -bankH(T, i, s * (lim(i) + 0.5 + Math.max(2, bankH(T, i, s * lim(i)) * 2.2))), 1]], 12), new THREE.MeshStandardMaterial({ map: tx.verge, color: th.grass, roughness: 1, side: THREE.DoubleSide }));
    }
    // posts (instanced)
    {
      const posts = []; for (let i = 0; i < N; i += 3) for (const s of [1, -1]) if (!inPitGap(i, s)) posts.push([i, s]);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 4.2, 0.1).translate(0, 2.1, 0), new THREE.MeshStandardMaterial({ color: '#8b9099', roughness: 0.5, metalness: 0.6 }), posts.length);
      const m = new THREE.Matrix4();
      posts.forEach(([i, s], k) => { const l = (s > 0 ? T.limL[i] : T.limR[i]) + 0.45; m.makeTranslation(T.px[i] + T.nx[i] * s * l, bankH(T, i, s * l), T.pz[i] + T.nz[i] * s * l); im.setMatrixAt(k, m); });
      G.add(im);
    }
    // start line + grid
    { const sl = add(ribbon(T, N - 1, 1, [col(W, 0.04, 0), col(-W, 0.04, 1)], 2), new THREE.MeshStandardMaterial({ map: tx.checker, roughness: 0.6 })); sl.renderOrder = 1;
      const gm = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 });
      const gg = new THREE.BufferGeometry();
      const slotGeo = mergeGeometries([new THREE.PlaneGeometry(2.6, 0.25).rotateX(-Math.PI / 2), new THREE.PlaneGeometry(0.2, 1.2).rotateX(-Math.PI / 2).translate(1.2, 0, -0.6), new THREE.PlaneGeometry(0.2, 1.2).rotateX(-Math.PI / 2).translate(-1.2, 0, -0.6)]);
      const im = new THREE.InstancedMesh(slotGeo, gm, 22); const d = new THREE.Object3D();
      for (let s2 = 0; s2 < 22; s2++) { const back = 8 + s2 * 8, i = (N - Math.round(back / DS) + 1) % N, lane = (s2 % 2 === 0 ? 1 : -1) * 3.2; d.position.set(T.px[i] + T.nx[i] * lane, bankH(T, i, lane) + 0.04, T.pz[i] + T.nz[i] * lane); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); d.updateMatrix(); im.setMatrixAt(s2, d.matrix); }
      im.receiveShadow = true; G.add(im); gg.dispose(); }

    /* ----- racing line (green = full throttle, yellow = lift, red = brake) ----- */
    {
      const g = ribbon(T, 0, N, [i => [T.race[i] + 0.35, 0.045, 0], i => [T.race[i] - 0.35, 0.045, 1]], 4);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
      this.raceGeo = g; this.raceT = T; this.colorRaceLine(T.vprof2);
      this.raceLine = add(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), { recv: false });
      this.raceLine.renderOrder = 2;
      this.raceLine.visible = !!this.showLine;
    }
    /* ----- pit-entry guide line (shown when the player is boxing) ----- */
    {
      const P = T.pit, edge = P.side * (W + 0.6), lead = 80, len = lead + P.limIn + 4;
      const latAt = i => {
        const before = (P.entry - i + N) % N, kk = (i - P.entry + N) % N;
        if (before > 0 && before <= lead) return T.race[i] + (edge - T.race[i]) * smooth(lead, 0, before);
        return edge + (P.fast - edge) * smooth(0, P.limIn - 6, kk);
      };
      const g = ribbon(T, (P.entry - lead + N) % N, len, [i => [latAt(i) + 0.5, 0.05, 0], i => [latAt(i) - 0.5, 0.05, 1]], 4);
      this.pitGuide = add(g, new THREE.MeshBasicMaterial({ color: new THREE.Color('#1fa2ff').multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, fog: false }), { recv: false });
      this.pitGuide.renderOrder = 3; this.pitGuide.visible = false;
    }
    /* ----- DRS detection / activation lines and boards ----- */
    {
      const lineM = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 });
      const signTex = (txt, bg) => canvasTex(256, 128, (g2, w, h) => { g2.fillStyle = bg; g2.fillRect(0, 0, w, h); g2.fillStyle = '#111'; g2.font = '800 54px "Barlow Condensed", Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(txt, w / 2, h / 2 + 3); }, { repeat: false });
      const detTex = signTex('DRS DETECTION', '#f4f4f4'), actTex = signTex('DRS', '#22e05a');
      for (const z of T.drs) {
        for (const [i, tex] of [[z.detect, detTex], [z.start, actTex]]) {
          add(ribbon(T, i, 1, [col(W, 0.043, 0), col(-W, 0.043, 1)], 2), lineM).scale.set(1, 1, 1);
          const lim = T.limR[i];
          const fr = new THREE.Object3D(); fr.position.set(T.px[i] - T.nx[i] * (lim + 1.2), elevAt(T, i), T.pz[i] - T.nz[i] * (lim + 1.2)); fr.rotation.y = Math.atan2(T.tx[i], T.tz[i]); G.add(fr);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ color: '#555b66' })); fr.add(post);
          const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tex : null, emissiveIntensity: 0.6 }));
          board.position.set(0, 3.0, 0.08); board.rotation.y = Math.PI; fr.add(board);
        }
      }
    }

    /* ----- trackside structures ----- */
    const frameAt = (i, lat, y = elevAt(T, i)) => { const o = new THREE.Object3D(); o.position.set(T.px[i] + T.nx[i] * lat, y, T.pz[i] + T.nz[i] * lat); o.rotation.y = Math.atan2(T.tx[i], T.tz[i]); return o; };
    const steel = new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.5, metalness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.6 });
    // gantry with start lights
    {
      const gi = 4, fr = frameAt(gi, 0); G.add(fr); const span2 = W + 2.6;
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5).translate(0, 4, 0), steel); p.position.x = sx * span2; p.castShadow = true; fr.add(p); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span2 * 2 + 0.6, 1.0, 0.7), steel); beam.position.y = 7.6; beam.castShadow = true; fr.add(beam);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(span2 * 2, 0.9), new THREE.MeshStandardMaterial({ map: tx.ads, roughness: 0.6 })); banner.position.set(0, 8.6, 0); banner.rotation.y = Math.PI; fr.add(banner);
      for (let k = 0; k < 5; k++) {
        const x = (k - 2) * 1.35;
        const pod = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.0, 0.5), new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.4 })); pod.position.set(x, 6.2, 0); fr.add(pod);
        const mat = new THREE.MeshStandardMaterial({ color: '#160404', emissive: '#ff1010', emissiveIntensity: 0, roughness: 0.3 });
        for (const y of [6.68, 5.78]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), mat); c.position.set(x, y, -0.26); c.rotation.y = Math.PI; fr.add(c); }
        this.gantryLights.push(mat);
      }
    }
    // pit lane, garages and team boxes alongside the start straight
    {
      const ps = P.side, range = []; for (let i = P.entry; i !== P.exit; i = (i + 1) % N) range.push(i);
      const outer = P.outer;
      const pitMat = new THREE.MeshStandardMaterial({ map: tx.asphalt, color: '#a3a6ad', roughness: 0.9 });
      const k0 = Math.max(0, P.limIn - 8), k1 = Math.min(range.length, P.limOut + 8);
      add(ribbon(T, (P.entry + k0) % N, k1 - k0, [() => [ps * (P.wall - 0.3), 0.016, 0], () => [ps * outer, 0.016, 2]], 6), pitMat);
      // tarmac between the track and the pit wall along the pit straight (not grass)
      add(ribbon(T, (P.entry + k0) % N, k1 - k0, [() => [ps * (W - 0.05), 0.012, 0], () => [ps * (P.wall - 0.25), 0.012, 1]], 6), new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: '#9a9da4', roughness: 0.9 }));
      // entry and exit slip roads, with white edge lines
      const roadMat = new THREE.MeshStandardMaterial({ map: tx.asphalt, normalMap: tx.asphaltN, color: '#bfc2c8', roughness: 0.88 });
      for (const [s0, cnt] of [[(P.entry - 30 + N) % N, P.limIn + 33], [(P.entry + P.limOut - 2) % N, P.len - P.limOut + 33 + Math.round((P.merge || 0) / DS)]]) {
        const ed = (i, w) => { const r2 = pitRoad(T, i); return r2 ? (w ? r2.b : r2.a) : W; };
        add(ribbon(T, s0, cnt, [i => [ps * ed(i, 0), 0.03, 0], i => [ps * ed(i, 1), 0.03, 1]], 6), roadMat);
        add(ribbon(T, s0, cnt, [i => [ps * Math.max(ed(i, 0), ed(i, 1) - 0.35), 0.036, 0], i => [ps * Math.max(ed(i, 0), ed(i, 1) - 0.1), 0.036, 1]], 4), lineMat);
      }
      add(ribbon(T, (P.entry + k0) % N, k1 - k0, [() => [ps * (P.wall + 5.1), 0.02, 0], () => [ps * (P.wall + 5.3), 0.02, 1]], 4), lineMat);
      // wall + debris fence between the pit exit lane and the track (Interlagos), ending where they meet
      if (P.mergeWall) {
        const w0 = (P.entry + P.len + P.mergeWallFrom) % N, wn = Math.round(P.merge / DS) - 4 - P.mergeWallFrom, mw = P.mergeWall;
        const cMat = new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.85, side: THREE.DoubleSide });
        add(ribbon(T, w0, wn, [() => [ps * (mw - 0.3), 0, 0], () => [ps * (mw - 0.3), 1.1, 1]], 6, { up: false }), cMat, { cast: q > 0 });
        add(ribbon(T, w0, wn, [() => [ps * (mw + 0.3), 0, 0], () => [ps * (mw + 0.3), 1.1, 1]], 6, { up: false }), cMat);
        add(ribbon(T, w0, wn, [() => [ps * (mw - 0.3), 1.1, 0], () => [ps * (mw + 0.3), 1.1, 1]], 6), cMat);
        const ft = tx.fence.clone(); ft.needsUpdate = true;
        add(ribbon(T, w0, wn, [() => [ps * mw, 1.1, 0], () => [ps * mw, 3.6, 1]], 3.05, { up: false }), new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 }), { recv: false });
      }
      // pit-lane speed limit lines
      for (const k of [P.limIn, P.limOut]) add(ribbon(T, (P.entry + k) % N, 1, [() => [ps * (P.wall - 0.3), 0.021, 0], () => [ps * outer, 0.021, 1]], 2), new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.7 }));
      const conc = new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.85, side: THREE.DoubleSide });
      // team boxes
      const boxMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
      const tc = new THREE.Color(), d = new THREE.Object3D();
      const boxes = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 5.6).rotateX(-Math.PI / 2), boxMat, teamColors.length + 1);
      for (let k = 0; k <= teamColors.length; k++) {
        const i = (P.boxStart + k * P.boxGap) % N; d.position.set(T.px[i] + T.nx[i] * P.lat, bankH(T, i, P.lat) + 0.025, T.pz[i] + T.nz[i] * P.lat); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); d.updateMatrix();
        boxes.setMatrixAt(k, d.matrix); tc.set(k === teamColors.length ? '#ffcc00' : teamColors[k]).multiplyScalar(0.8); boxes.setColorAt(k, tc);
      }
      boxes.receiveShadow = true; G.add(boxes);
      const segs = range.filter((_, k) => k % 6 === 0 && k > 30 && k < range.length - 30);
      const mkIM = (geo, mat, n = segs.length) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.castShadow = q > 0; im.receiveShadow = true; G.add(im); return im; };
      // pit building: garages along the front (6 m deep, open where a team has its box), offices behind,
      // and the glass hospitality floor on top overhanging the garages
      const lower = mkIM(new THREE.BoxGeometry(14, 6, 6.4).translate(0, 3, 0), white);
      const upper = mkIM(new THREE.BoxGeometry(14, 4, 12.4).translate(0, 8, 0), new THREE.MeshPhysicalMaterial({ color: '#1e2a38', roughness: 0.08, metalness: 0.5, emissive: th.night ? '#ffd9a0' : '#000000', emissiveIntensity: th.night ? 0.25 : 0 }));
      const roof = mkIM(new THREE.BoxGeometry(17, 0.5, 12.4).translate(0, 10.25, 0), white);
      segs.forEach((i, k) => {
        const lat = ps * (outer + 6.3), lat2 = ps * (outer + 9.3), hd = Math.atan2(T.tx[i], T.tz[i]) + Math.PI / 2;
        d.position.set(T.px[i] + T.nx[i] * lat, bankH(T, i, lat), T.pz[i] + T.nz[i] * lat); d.rotation.set(0, hd, 0); d.updateMatrix();
        upper.setMatrixAt(k, d.matrix); roof.setMatrixAt(k, d.matrix);
        d.position.set(T.px[i] + T.nx[i] * lat2, bankH(T, i, lat2), T.pz[i] + T.nz[i] * lat2); d.updateMatrix(); lower.setMatrixAt(k, d.matrix);
      });
      if (segs.length) {
        const kA = Math.max(0, 30 + 6 - 4), kB = Math.min(range.length - 1, 30 + 6 * Math.floor((range.length - 31) / 6) + 3);
        const F0 = outer + 0.1, F1 = outer + 6.1, wallMat = new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.6, side: THREE.DoubleSide });
        const nTeams = teamColors.length + 1, colOf = t => t === teamColors.length ? '#ffcc00' : teamColors[t];
        const g = P.boxGap, bays = [];
        for (let t = 0; t < nTeams; t++) { const kb = (P.boxStart + t * g - P.entry + N) % N, a = kb - Math.floor(g / 2); if (a > kA && a + g < kB) bays.push({ t, a, b: a + g, kb }); }
        bays.sort((x, y) => x.a - y.a);
        const at = k => (P.entry + k) % N;
        // floor, lit ceiling and back wall run the whole length; only the bays are visible through the front
        add(ribbon(T, at(kA), kB - kA, [() => [ps * F0, 0.03, 0], () => [ps * F1, 0.03, 1]], 4), new THREE.MeshStandardMaterial({ color: '#d5d8dd', roughness: 0.25, metalness: 0.1 }));
        add(ribbon(T, at(kA), kB - kA, [() => [ps * F0, 4.8, 0], () => [ps * F1, 4.8, 1]], 4, { up: false }), new THREE.MeshStandardMaterial({ color: '#f4f5f7', emissive: '#ffffff', emissiveIntensity: 0.45, side: THREE.DoubleSide }));
        add(ribbon(T, at(kA), kB - kA, [() => [ps * F1, 0, 0], () => [ps * F1, 4.8, 1]], 4, { up: false }), wallMat);
        // front wall with openings at the team bays, and a lintel band above all of them
        let k = kA;
        for (const bay of bays) { if (bay.a > k) add(ribbon(T, at(k), bay.a - k, [() => [ps * F0, 0, 0], () => [ps * F0, 6, 1]], 4, { up: false }), wallMat); k = bay.b; }
        if (kB > k) add(ribbon(T, at(k), kB - k, [() => [ps * F0, 0, 0], () => [ps * F0, 6, 1]], 4, { up: false }), wallMat);
        add(ribbon(T, at(kA), kB - kA, [() => [ps * F0, 4.8, 0], () => [ps * F0, 6, 1]], 4, { up: false }), new THREE.MeshStandardMaterial({ color: '#20242b', roughness: 0.5, side: THREE.DoubleSide }));
        // inside each bay: team-colour back wall, partition walls, tyre stacks, and the team name over the door
        const part = mkIM(new THREE.BoxGeometry(6, 4.8, 0.2).translate(0, 2.4, 0), new THREE.MeshStandardMaterial({ color: '#e3e6ea', roughness: 0.6 }), bays.length * 2);
        const tyres = mkIM(new THREE.CylinderGeometry(0.34, 0.34, 1.25, 16).translate(0, 0.63, 0), new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.85 }), bays.length * 4);
        let pi = 0, ti = 0;
        for (const bay of bays) {
          const c0 = colOf(bay.t), cc = new THREE.Color(c0);
          add(ribbon(T, at(bay.a), bay.b - bay.a, [() => [ps * (F1 - 0.05), 0, 0], () => [ps * (F1 - 0.05), 4.8, 1]], 8, { up: false }), new THREE.MeshStandardMaterial({ color: cc, emissive: cc, emissiveIntensity: 0.12, roughness: 0.5, side: THREE.DoubleSide }));
          for (const e of [bay.a, bay.b]) { const i = at(e), lm = ps * (F0 + 3); d.position.set(T.px[i] + T.nx[i] * lm, bankH(T, i, lm), T.pz[i] + T.nz[i] * lm); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]) + Math.PI / 2, 0); d.updateMatrix(); part.setColorAt(pi, cc.clone().lerp(new THREE.Color('#ffffff'), 0.55)); part.setMatrixAt(pi++, d.matrix); }
          for (const [e, f] of [[bay.a, 0.45], [bay.b, -0.45]]) for (const lm0 of [F1 - 0.6, F1 - 1.35]) { const i = at(e), lm = ps * lm0, dk = f * DS; d.position.set(T.px[i] + T.nx[i] * lm + T.tx[i] * dk, bankH(T, i, lm), T.pz[i] + T.nz[i] * lm + T.tz[i] * dk); d.rotation.set(0, 0, 0); d.updateMatrix(); tyres.setMatrixAt(ti++, d.matrix); }
          const name = bay.t === teamColors.length ? 'YOUR TEAM' : (teamNames[bay.t] || '').toUpperCase();
          const sign = canvasTex(512, 64, (g2, w, h) => { g2.fillStyle = '#16191f'; g2.fillRect(0, 0, w, h); g2.fillStyle = c0; g2.fillRect(0, h - 8, w, 8); g2.fillStyle = '#ffffff'; g2.font = '800 40px "Barlow Condensed", Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(name, w / 2, h / 2 - 3); });
          const sm = new THREE.Mesh(new THREE.PlaneGeometry((bay.b - bay.a) * DS - 0.6, 0.85), new THREE.MeshBasicMaterial({ map: sign }));
          const ic = at(bay.kb), lm = ps * (F0 - 0.04); sm.position.set(T.px[ic] + T.nx[ic] * lm, bankH(T, ic, lm) + 5.4, T.pz[ic] + T.nz[ic] * lm); sm.rotation.set(0, Math.atan2(T.tx[ic], T.tz[ic]) - ps * Math.PI / 2, 0); G.add(sm);
        }
        part.count = pi; tyres.count = ti;
      }
      // overhead wheel-gun gantry over every pit box: boom from the garage, H-frame over the car, air hoses
      // dropping to each wheel, a light bar and the release traffic light
      {
        const s = ps, toWall = outer - Math.abs(P.lat), fx = AXLE_F, rx = AXLE_R;
        const frameGeo = mergeGeometries([
          new THREE.BoxGeometry(toWall + 1.3, 0.22, 0.22).translate(s * (toWall - (toWall + 1.3) / 2), 4.3, 0),
          new THREE.BoxGeometry(0.16, 0.16, fx - rx + 1.2).translate(s * 0.95, 4.3, (fx + rx) / 2),
          new THREE.BoxGeometry(0.16, 0.16, fx - rx + 1.2).translate(-s * 0.95, 4.3, (fx + rx) / 2),
          new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(s * 0.95, 4.15, fx), new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(-s * 0.95, 4.15, fx),
          new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(s * 0.95, 4.15, rx), new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(-s * 0.95, 4.15, rx),
          new THREE.BoxGeometry(0.34, 0.75, 0.22).translate(-s * 1.25, 3.85, fx + 0.6),
        ]);
        const hoseGeo = mergeGeometries([[1, fx], [-1, fx], [1, rx], [-1, rx]].flatMap(([sx, z]) => [
          new THREE.CylinderGeometry(0.022, 0.022, 2.3, 6).translate(sx * 1.0, 3.1, z),
          new THREE.TorusGeometry(0.16, 0.022, 6, 12).rotateY(Math.PI / 2).translate(sx * 1.0, 3.9, z),
          new THREE.BoxGeometry(0.1, 0.16, 0.26).translate(sx * 1.0, 1.9, z),
        ]));
        const lightGeo = mergeGeometries([
          new THREE.BoxGeometry(0.12, 0.05, fx - rx).translate(s * 0.95, 4.2, (fx + rx) / 2), new THREE.BoxGeometry(0.12, 0.05, fx - rx).translate(-s * 0.95, 4.2, (fx + rx) / 2),
        ]);
        const relGeo = new THREE.CircleGeometry(0.1, 12).translate(0, 0, 0.115).translate(-s * 1.25, 4.05, fx + 0.6);
        const nB = teamColors.length + 1;
        const frame = mkIM(frameGeo, new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.4, metalness: 0.6 }), nB);
        const hoses = mkIM(hoseGeo, new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.7 }), nB);
        const lights = mkIM(lightGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.5 }), nB);
        const rel = mkIM(relGeo, new THREE.MeshStandardMaterial({ color: '#30ff60', emissive: '#30ff60', emissiveIntensity: 2 }), nB);
        for (let k = 0; k < nB; k++) {
          const i = (P.boxStart + k * P.boxGap) % N; d.position.set(T.px[i] + T.nx[i] * P.lat, bankH(T, i, P.lat), T.pz[i] + T.nz[i] * P.lat); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); d.updateMatrix();
          frame.setMatrixAt(k, d.matrix); hoses.setMatrixAt(k, d.matrix); lights.setMatrixAt(k, d.matrix); rel.setMatrixAt(k, d.matrix);
        }
        frame.castShadow = hoses.castShadow = false;
      }
      const pitSide = ps;
      {
        const body = mergeGeometries([
          new THREE.BoxGeometry(0.15, 0.86, 0.17).translate(-0.11, 0.43, 0), new THREE.BoxGeometry(0.15, 0.86, 0.17).translate(0.11, 0.43, 0),
          new THREE.BoxGeometry(0.44, 0.62, 0.26).translate(0, 1.17, 0),
          new THREE.BoxGeometry(0.12, 0.62, 0.13).translate(-0.29, 1.12, 0), new THREE.BoxGeometry(0.12, 0.62, 0.13).translate(0.29, 1.12, 0),
          new THREE.SphereGeometry(0.16, 12, 10).translate(0, 1.66, 0)]);
        const teams = teamColors.length + 1, per = 14;
        this.crewColors = teamColors.concat(['#ffcc00']); this.crewG = G; this.stopCrews = new Map();
        this.crew = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), teams * per);
        this.crewInfo = { T, per, teams };
        const tc2 = new THREE.Color();
        for (let t = 0; t < teams; t++) { tc2.set(t === teamColors.length ? '#ffcc00' : teamColors[t]); for (let k = 0; k < per; k++) this.crew.setColorAt(t * per + k, tc2); this.crewPose(t, null); }
        G.add(this.crew);
      }
      // grandstands
      const stand = (i, s, L) => {
        const lim = s > 0 ? T.limL[i] : T.limR[i]; const fr = frameAt(i, s * (lim + 4), bankH(T, i, s * (lim + 4))); G.add(fr);
        const crowdMat = new THREE.MeshStandardMaterial({ map: tx.crowd, roughness: 0.9, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tx.crowd : null, emissiveIntensity: 0.12 });
        for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3 * (k + 1), L), crowdMat); b.position.set(s * (1.2 + k * 2.4), 0.65 * (k + 1), 0); b.castShadow = q > 0; b.receiveShadow = true; fr.add(b); }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.35, L + 3), white); roof.position.set(s * 8.4, 12.8, 0); roof.rotation.z = s * 0.1; roof.castShadow = q > 0; fr.add(roof);
        for (const z of [-L / 2, -L / 6, L / 6, L / 2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13.5, 0.4).translate(0, 6.75, 0), steel); p.position.set(s * 17.6, 0, z); fr.add(p); }
      };
      const opp = -pitSide;
      if ((opp > 0 ? T.limL[30] : T.limR[30]) >= T.wallOff - 0.5 || T.street) { stand(Math.round(30 / DS) % N, opp, 70); stand((N - Math.round(50 / DS)) % N, opp, 60); }
      // stands outside the 3 sharpest corners
      const corners = T.kerbs.map(([a, b]) => { let mi = a, mk = 0; for (let i = a; i <= b; i++) { const k = Math.abs(T.curv[i % N]); if (k > mk) { mk = k; mi = i % N; } } return { i: mi, k: mk, s: T.curv[mi] > 0 ? -1 : 1 }; }).sort((a, b) => b.k - a.k);
      let placed = 0;
      for (const c of corners) { if (placed >= 6) break; if (Math.min(Math.abs(c.i), N - c.i) < 120) continue; const lim = c.s > 0 ? T.limL[c.i] : T.limR[c.i]; if (lim < T.wallOff - 1 && !T.street) continue; stand(c.i, c.s, 50); placed++; }
    }
    // sponsor bridge over a straight
    {
      let best = -1, bestLen = 0, run = 0;
      for (let i = 0; i < N; i++) { if (Math.abs(T.curv[i]) < 1 / 900) run++; else run = 0; if (run > bestLen && i > 200 && i < N - 200) { bestLen = run; best = i - Math.floor(run / 2); } }
      if (best > 0 && bestLen > 50) {
        const fr = frameAt(best, 0); G.add(fr); const sp2 = Math.max(T.limL[best], T.limR[best]) + 1;
        for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2).translate(0, 4.5, 0), steel); p.position.x = sx * sp2; p.castShadow = q > 0; fr.add(p); }
        const bm = new THREE.MeshStandardMaterial({ map: tx.ads, roughness: 0.5, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tx.ads : null, emissiveIntensity: 0.6 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(sp2 * 2 + 1.2, 2.2, 1.0), [steel, steel, steel, steel, bm, bm]); b.position.y = 8.6; b.castShadow = q > 0; fr.add(b);
      }
    }
    // floodlights
    if (th.night || th.lights) {
      const poles = []; for (let i = 0; i < N; i += 38) for (const s of [1, -1]) poles.push([i, s]);
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 22, 6).translate(0, 11, 0), steel, poles.length);
      const head = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 1.2, 0.5).translate(0, 22, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(4), toneMapped: false, fog: false }), poles.length);
      const d = new THREE.Object3D();
      poles.forEach(([i, s], k) => { const l = (s > 0 ? T.limL[i] : T.limR[i]) + 3; d.position.set(T.px[i] + T.nx[i] * s * l, bankH(T, i, s * l), T.pz[i] + T.nz[i] * s * l); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); d.updateMatrix(); pole.setMatrixAt(k, d.matrix); head.setMatrixAt(k, d.matrix); });
      G.add(pole, head);
      if (T.street) {
        const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.25, 1).translate(0, 0, 0.5), steel, poles.length), lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.25, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(5), toneMapped: false, fog: false }), poles.length);
        poles.forEach(([i, s2], k) => {
          const l = (s2 > 0 ? T.limL[i] : T.limR[i]) + 3, reach = l - 2.5, l2 = s2 * (l - reach), y = bankH(T, i, s2 * l) + 15;
          d.position.set(T.px[i] + T.nx[i] * s2 * l, y, T.pz[i] + T.nz[i] * s2 * l); d.lookAt(T.px[i] + T.nx[i] * l2, y, T.pz[i] + T.nz[i] * l2); d.scale.set(1, 1, reach); d.updateMatrix(); arm.setMatrixAt(k, d.matrix);
          d.position.set(T.px[i] + T.nx[i] * l2, y - 0.3, T.pz[i] + T.nz[i] * l2); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]), 0); d.scale.set(1, 1, 1); d.updateMatrix(); lamp.setMatrixAt(k, d.matrix);
        });
        G.add(arm, lamp);
      }
    }

    /* ----- trackside dressing: billboards, marshal posts, TV towers, paddock, fan zones, yachts ----- */
    {
      const cornersAll = T.kerbs.map(([a, b]) => { let mi = a, mk = 0; for (let i = a; i <= b; i++) { const k = Math.abs(T.curv[i % N]); if (k > mk) { mk = k; mi = i % N; } } return { i: mi, k: mk, s: T.curv[mi] > 0 ? -1 : 1, a, b }; });
      const sharp = cornersAll.slice().sort((x, y) => y.k - x.k);
      const lim = (i, s2) => s2 > 0 ? T.limL[i] : T.limR[i];
      const inPit = i => { const kk = (i - P.entry + N) % N; return kk <= P.len + 30 || (P.entry - i + N) % N < 40; };
      const d = new THREE.Object3D();
      const placeAt = (im, k, i, lat, yOff = 0, ry = 0) => { d.position.set(T.px[i] + T.nx[i] * lat, bankH(T, i, lat) + yOff, T.pz[i] + T.nz[i] * lat); d.rotation.set(0, Math.atan2(T.tx[i], T.tz[i]) + ry, 0); d.scale.set(1, 1, 1); d.updateMatrix(); im.setMatrixAt(k, d.matrix); };
      // advertising hoardings behind the barrier on the outside of corners (circuits; streets already have ad walls)
      if (!T.street && !T.def.noBarriers) {   // no advertising hoardings along rally stages
        const spots = [];
        // each board is 17 m long and runs ALONG the barrier. Skip any spot where either end or the middle would
        // come close to another part of the track (hairpins, chicanes, parallel straights like Montreal's)
        const near = (x, z, i0) => { for (let k = 0; k < N; k += 2) { if (Math.abs(((k - i0 + N + N / 2) % N) - N / 2) < 25) continue; const dx = T.px[k] - x, dz = T.pz[k] - z; if (dx * dx + dz * dz < (W + 9) * (W + 9)) return true; } return false; };
        const clearSpot = (i, sd) => { const l = sd * (lim(i, sd) + 2.2); for (const o of [-8.5, 0, 8.5]) if (near(T.px[i] + T.nx[i] * l + T.tx[i] * o, T.pz[i] + T.nz[i] * l + T.tz[i] * o, i)) return false; return true; };
        for (const c of cornersAll) for (let j = c.a; j <= c.b + 30; j += 9) { const i = j % N, sd = c.s; if (!inPit(i) && lim(i, sd) > 8 && clearSpot(i, sd)) spots.push([i, sd]); }
        const adMat = new THREE.MeshStandardMaterial({ map: tx.ads, roughness: 0.55, emissive: th.night ? '#ffffff' : '#000000', emissiveMap: th.night ? tx.ads : null, emissiveIntensity: 0.5 });
        const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(17, 1.6, 0.25).translate(0, 1.15, 0), [steel, steel, steel, steel, adMat, adMat], spots.length);
        const legs = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(0.15, 1.2, 0.15).translate(-7.5, 0.4, 0), new THREE.BoxGeometry(0.15, 1.2, 0.15).translate(7.5, 0.4, 0)]), steel, spots.length);
        spots.forEach(([i, sd], k) => { const l = sd * (lim(i, sd) + 2.2), ry = sd > 0 ? -Math.PI / 2 : Math.PI / 2; placeAt(boards, k, i, l, 0, ry); placeAt(legs, k, i, l, 0, ry); });
        boards.castShadow = q > 0; G.add(boards, legs);
      }
      // marshal posts every ~350 m, alternating sides
      {
        const posts = []; for (let i = 40, side = 1; i < N - 40; i += 175, side = -side) if (!inPit(i) && lim(i, side) > 4) posts.push([i, side]);
        const hutGeo = mergeGeometries([new THREE.BoxGeometry(1.8, 2.2, 1.6).translate(0, 1.1, 0)]), roofGeo = new THREE.BoxGeometry(2.2, 0.18, 2.0).translate(0, 2.3, 0), poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6).translate(1.1, 1.7, 0), flagGeo = new THREE.PlaneGeometry(0.7, 0.45).translate(1.45, 3.1, 0);
        const hut = new THREE.InstancedMesh(hutGeo, white, posts.length), roof = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 }), posts.length);
        const pole = new THREE.InstancedMesh(poleGeo, steel, posts.length), flag = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.7, side: THREE.DoubleSide }), posts.length);
        posts.forEach(([i, sd], k) => { const l = sd * (lim(i, sd) + 1.6); for (const im of [hut, roof, pole, flag]) placeAt(im, k, i, l); });
        hut.castShadow = q > 0; G.add(hut, roof, pole, flag);
      }
      // TV camera towers outside the four sharpest corners
      {
        const tw = sharp.filter(c => !inPit(c.i)).slice(0, 4);
        const legs = mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => new THREE.BoxGeometry(0.12, 7, 0.12).translate(x * 0.9, 3.5, z * 0.9)).concat([0, 2.3, 4.6].map(y => new THREE.BoxGeometry(1.9, 0.08, 1.9).translate(0, y + 0.6, 0))));
        const towers = new THREE.InstancedMesh(legs, steel, tw.length), decks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.2, 2.4).translate(0, 7.1, 0), white, tw.length);
        const cams = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(0.5, 0.45, 0.9).translate(0, 7.7, 0), new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6).translate(0, 7.35, 0)]), new THREE.MeshStandardMaterial({ color: '#111318', roughness: 0.4 }), tw.length);
        tw.forEach((c, k) => { const l = c.s * (lim(c.i, c.s) + 7); for (const im of [towers, decks, cams]) placeAt(im, k, c.i, l, 0, c.s > 0 ? -Math.PI / 2 : Math.PI / 2); });
        G.add(towers, decks, cams);
      }
      // paddock behind the pit building: tarmac and two rows of team motorhomes / hospitality units
      {
        const ps = P.side, k0 = 34, k1 = Math.max(k0 + 10, P.len - 34), base = Math.abs(P.lat) + 16 + 6.4;
        if (!T.street || (ps > 0 ? T.limL[(P.entry + 80) % N] : T.limR[(P.entry + 80) % N]) > 10) {
          add(ribbon(T, (P.entry + k0) % N, k1 - k0, [() => [ps * (base - 1), 0.05, 0], () => [ps * (base + 34), 0.05, 4]], 10), new THREE.MeshStandardMaterial({ map: tx.asphalt, color: '#8a8d94', roughness: 0.95 }));
          const units = []; for (let k = k0 + 4; k < k1 - 4; k += 9) for (const row of [0, 1]) units.push([(P.entry + k) % N, row, units.length]);
          const box = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(5.5, 4.2, 15).translate(0, 2.1, 0), new THREE.BoxGeometry(5.9, 0.25, 15.4).translate(0, 4.3, 0)]), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.2 }), units.length);
          const stripe = new THREE.InstancedMesh(new THREE.BoxGeometry(5.55, 0.7, 15.05).translate(0, 2.9, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), units.length);
          const cc = new THREE.Color();
          units.forEach(([i, row, k]) => { const l = ps * (base + 6 + row * 18); placeAt(box, k, i, l); placeAt(stripe, k, i, l); cc.set(teamColors[k % teamColors.length] || '#ffcc00'); stripe.setColorAt(k, cc); });
          box.castShadow = q > 0; G.add(box, stripe);
        }
      }
      // fan zones at permanent circuits: tents and flags in the open ground behind the fences
      if (!T.street && !th.night) {
        const fz = sharp.filter(c => !inPit(c.i)).slice(0, 6), tents = [], flags = [];
        for (const c of fz) for (let n = 0; n < 6; n++) { const i = (c.i + Math.round((r() - 0.5) * 60) + N) % N, l = c.s * (lim(i, c.s) + 14 + r() * 26); tents.push([i, l]); if (n < 3) flags.push([i, l + c.s * 4]); }
        const tent = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(5, 2.2, 5).translate(0, 1.1, 0), new THREE.ConeGeometry(3.8, 1.6, 4).rotateY(Math.PI / 4).translate(0, 3.0, 0)]), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), tents.length);
        const cols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff', '#a855f7'], cc = new THREE.Color();
        tents.forEach(([i, l], k) => { placeAt(tent, k, i, l, 0, r() * 3); cc.set(cols[k % cols.length]); tent.setColorAt(k, cc); });
        const fl = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.05, 0.05, 6, 6).translate(0, 3, 0), new THREE.PlaneGeometry(1.4, 0.9).translate(0.72, 5.4, 0)]), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }), flags.length);
        flags.forEach(([i, l], k) => { placeAt(fl, k, i, l, 0, r() * 3); cc.set(cols[(k + 2) % cols.length]); fl.setColorAt(k, cc); });
        tent.castShadow = q > 0; G.add(tent, fl);
      }
      // yachts in the harbour (tracks beside water)
      if (th.water && th.water.mode === 'side') {
        const ya = [], wdir = [Math.cos(th.water.angle), Math.sin(th.water.angle)];
        for (let t = 0; t < 400 && ya.length < 24; t++) { const x = T.cx + (r() - 0.5) * T.radius * 2.6, z = T.cz + (r() - 0.5) * T.radius * 2.6; if (height(x, z) < th.water.level - 0.5 && dist(x, z) > T.wallOff + 25 && dist(x, z) < 500) ya.push([x, z, r()]); }
        yachtFleet(G, ya.map(([x, z, k2], k) => [x, z, k2 * 6.28, 0.6 + k2 * 0.7, k % 5 === 0 ? 1 : 0]), th.water.level, th, q);
      }
    }

    /* ----- scenery ----- */
    const mult = q === 0 ? 0.35 : q === 1 ? 1 : 1.6;
    const wl = th.water ? th.water.level + 1.5 : -1e9;
    const exactNear = (x, z, R) => { // is any track point within R metres? (the distance field is too coarse near the track)
      const cx = Math.floor(x / HB), cz = Math.floor(z / HB), nb = Math.ceil(R / HB), R2 = R * R;
      for (let gx = cx - nb; gx <= cx + nb; gx++) for (let gz = cz - nb; gz <= cz + nb; gz++) { const a = hash.get(gx + ',' + gz); if (!a) continue; for (const k of a) { const dx = x - T.px[k], dz = z - T.pz[k]; if (dx * dx + dz * dz < R2) return true; } }
      return false;
    };
    const scatter = (count, minD, extent, maxD = 1e9, clear = 0) => {
      const out = []; let tries = 0;
      while (out.length < count && tries < count * 10) {
        tries++;
        const x = T.minX - extent + r() * (T.maxX - T.minX + 2 * extent), z = T.minZ - extent + r() * (T.maxZ - T.minZ + 2 * extent);
        const d = dist(x, z); if (d < minD || d > maxD) continue;
        if (keepOut.some(([kx, kz, kr]) => (x - kx) * (x - kx) + (z - kz) * (z - kz) < (kr + 6) * (kr + 6))) continue;
        if (d < minD + 120 && exactNear(x, z, Math.max(minD, clear))) continue;
        const h = height(x, z); if (h < wl) continue;
        out.push([x, h, z, d]);
      }
      return out;
    };
    const inst = (geo, mat, list, fn, { cast = true, colors = null } = {}) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
      list.forEach((p, k) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); fn(d, p, k); d.updateMatrix(); im.setMatrixAt(k, d.matrix); if (colors) { c.set(colors[k % colors.length]).offsetHSL(0, 0, (r() - 0.5) * 0.08); im.setColorAt(k, c); } });
      im.castShadow = cast && q > 0; im.receiveShadow = true; G.add(im); return im;
    };
    const sc2 = th.scenery, minTree = T.wallOff + 9;
    const bark = new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.95 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
    if (sc2.trees) {
      const pts = scatter(Math.round(sc2.trees * mult), minTree, 900);
      const crown = mergeGeometries([new THREE.IcosahedronGeometry(3.6, 1).translate(0, 9, 0), new THREE.IcosahedronGeometry(2.8, 1).translate(1.8, 7.5, 0.8), new THREE.IcosahedronGeometry(2.6, 1).translate(-1.6, 7.8, -0.9), new THREE.IcosahedronGeometry(2.4, 1).translate(0.2, 11.2, -0.3)]);
      const sc = pts.map(() => 0.7 + r() * 0.9), ry = pts.map(() => r() * 6.28);
      const place = (d, p, k) => { d.scale.setScalar(sc[k]); d.rotation.y = ry[k]; };
      inst(new THREE.CylinderGeometry(0.35, 0.55, 7, 6).translate(0, 3.5, 0), bark, pts, place);
      inst(crown, leaf, pts, place, { colors: th.foliage });
    }
    if (sc2.pines) {
      const pts = scatter(Math.round(sc2.pines * mult), minTree, 1000);
      const crown = mergeGeometries([new THREE.ConeGeometry(3.6, 7, 8).translate(0, 6, 0), new THREE.ConeGeometry(2.9, 6, 8).translate(0, 9.5, 0), new THREE.ConeGeometry(2, 5, 8).translate(0, 13, 0)]);
      const sc = pts.map(() => 0.75 + r() * 0.9);
      const place = (d, p, k) => { d.scale.set(sc[k], sc[k] * (0.9 + r() * 0.3), sc[k]); d.rotation.y = r() * 6.28; };
      inst(new THREE.CylinderGeometry(0.3, 0.45, 4, 6).translate(0, 2, 0), bark, pts, place);
      inst(crown, leaf, pts, place, { colors: th.snowLine === 1 ? ['#2b5a40', '#e9f0f4', '#3a6a4a'] : th.foliage });
    }
    // def.woods (Nordschleife): thick forest right behind the barriers along the whole lap
    if (T.def.woods) {
      const pinesW = [], leafyW = [], step = Math.max(2, Math.round(9 / mult / DS));
      for (let i = 0; i < N; i += step) for (const sd of [1, -1]) for (let rep = 0; rep < 2; rep++) {
        const l = sd * (sideLim(T, sd)(i) + 5 + r() * (rep ? 45 : 18)), j = (i + Math.floor(r() * step)) % N;
        const x = T.px[j] + T.nx[j] * l + (r() - 0.5) * 6, z = T.pz[j] + T.nz[j] * l + (r() - 0.5) * 6;
        if (exactNear(x, z, W + KERB + 9)) continue;
        (r() < 0.6 ? pinesW : leafyW).push([x, height(x, z), z]);
      }
      const cone = mergeGeometries([new THREE.ConeGeometry(3.2, 7, 7).translate(0, 6, 0), new THREE.ConeGeometry(2.6, 6, 7).translate(0, 9.5, 0), new THREE.ConeGeometry(1.8, 5, 7).translate(0, 13, 0)]);
      const ball = mergeGeometries([new THREE.IcosahedronGeometry(3.4, 0).translate(0, 8.5, 0), new THREE.IcosahedronGeometry(2.6, 0).translate(1.5, 7.2, 0.6), new THREE.IcosahedronGeometry(2.4, 0).translate(-1.4, 7.6, -0.8)]);
      for (const [list, crown, trunkH, cols] of [[pinesW, cone, 4, ['#1f4a32', '#2b5a3c', '#24503a']], [leafyW, ball, 6, th.foliage]]) {
        const sc = list.map(() => 0.8 + r() * 0.8), ry = list.map(() => r() * 6.28), place = (d, p, k) => { d.scale.set(sc[k], sc[k] * (0.9 + r() * 0.35), sc[k]); d.rotation.y = ry[k]; };
        inst(new THREE.CylinderGeometry(0.3, 0.45, trunkH, 5).translate(0, trunkH / 2, 0), bark, list, place, { cast: false });
        inst(crown, leaf, list, place, { colors: cols });
      }
    }
    if (sc2.palms) {
      const pts = scatter(Math.round(sc2.palms * mult), minTree - 2, 700);
      const trunkC = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, 5, 0), new THREE.Vector3(1.4, 10, 0), new THREE.Vector3(2.4, 13, 0)]);
      const leaves = []; for (let k = 0; k < 8; k++) { const l = new THREE.PlaneGeometry(1.4, 5.5, 1, 4); const p = l.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.75; p.setY(i, y); p.setZ(i, -0.06 * y * y); } l.rotateX(-1.0); l.rotateY(k / 8 * Math.PI * 2); l.translate(2.4, 13, 0); leaves.push(l); }
      const lg = mergeGeometries(leaves); lg.computeVertexNormals();
      const ry = pts.map(() => r() * 6.28), sc = pts.map(() => 0.8 + r() * 0.5);
      const place = (d, p, k) => { d.rotation.y = ry[k]; d.scale.setScalar(sc[k]); };
      inst(new THREE.TubeGeometry(trunkC, 12, 0.32, 6), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 }), pts, place);
      inst(lg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide }), pts, place, { colors: th.foliage });
    }
    if (sc2.shrubs) {
      const pts = scatter(Math.round(sc2.shrubs * mult), T.wallOff + 5, 700);
      inst(new THREE.IcosahedronGeometry(1.4, 1).scale(1.2, 0.7, 1.2).translate(0, 0.6, 0), leaf, pts, (d, p, k) => { d.scale.setScalar(0.7 + r() * 1.2); d.rotation.y = r() * 6; }, { colors: th.foliage });
    }
    if (sc2.rocks) {
      const pts = scatter(Math.round(sc2.rocks * mult), T.wallOff + 10, 1000);
      const rg = new THREE.DodecahedronGeometry(1, 1); const p = rg.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = 0.8 + noise.perlin(p.getX(i) * 2.1, p.getZ(i) * 2.1 + p.getY(i)) * 0.4; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
      rg.computeVertexNormals();
      inst(rg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), pts, (d) => { const s = 2 + Math.pow(r(), 2) * 16; d.scale.set(s * (0.8 + r() * 0.6), s * (0.45 + r() * 0.7), s * (0.8 + r() * 0.6)); d.rotation.set(r() * 3, r() * 3, r() * 3); }, { colors: [th.terrain[1], th.terrain[2], th.terrain[0]] });
    }
    if (sc2.buildings) {
      // street circuits: the town comes right up to the barriers (Monaco, Baku, Singapore...)
      const near = scatter(Math.round(sc2.buildings * (T.street ? 1.4 : 0.55) * mult), T.wallOff + (T.street ? 12 : 26), 300, 1e9, T.wallOff + 32);
      const far = scatter(Math.round(sc2.buildings * 0.45 * mult), 450, 1600);
      const mat = th.night ? new THREE.MeshStandardMaterial({ color: '#2a2f3c', roughness: 0.4, metalness: 0.4, emissive: T.def.neon ? '#ffd27a' : '#ffffff', emissiveMap: tx.winNight, emissiveIntensity: T.def.neon ? 1.1 : 0.55 })
        : new THREE.MeshStandardMaterial({ map: tx.winDay, roughness: 0.35, metalness: 0.45 });
      const pal = th.night ? (T.def.neon ? ['#ff2bd6', '#ffb400', '#00d4ff', '#7c3aed', '#ff5a36', '#22c55e'] : ['#2a2f3c', '#252a38', '#31283f']) : ['#e8dccb', '#cdd5dd', '#d9c6b0', '#b9c3cc', '#f0e6d8', '#a9b8c8'];
      const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      inst(geo, mat, near.concat(far), (d, p) => { const fr = p[3] > 450; d.rotation.y = r() * 6; d.scale.set(16 + r() * 26, fr ? 50 + Math.pow(r(), 2) * 230 : 14 + Math.pow(r(), 2) * 90, 16 + r() * 26); }, { colors: pal });
    }
  }

  /* rain: 0..1 falling rain near the player, wet: 0..1 standing water near the player */
  setWeather(rain, wet) {
    const b = this.base; if (!b) return;
    const rm = this.roadMesh && this.roadMesh.material;
    if (rm) { rm.roughness = 0.86 - 0.62 * wet; rm.metalness = 0.15 * wet; rm.color.setScalar(this.night ? 0.79 - 0.25 * wet : 1 - 0.38 * wet); }
    this.sun.intensity = b.sun * (1 - 0.7 * rain); this.hemi.intensity = b.hemi * (1 + 0.6 * rain);
    this.scene.environmentIntensity = b.env * (1 - 0.45 * rain);
    this.renderer.toneMappingExposure = b.exposure * (1 - 0.38 * rain);
    if (this.scene.fog) { this.scene.fog.density = b.fog * (1 + 3 * rain); this.scene.fog.color.copy(b.fogColor).lerp(TMP_GREY, 0.7 * rain); }
    if (!this.night) { const u = this.sky.material.uniforms; u.turbidity.value = b.turb + 20 * rain; u.rayleigh.value = b.ray * (1 - 0.95 * rain); u.mieCoefficient.value = 0.004 + 0.03 * rain; }
    if (this.clouds) { this.clouds.material.opacity = Math.min(1, 0.7 + 0.6 * rain); this.clouds.material.color.setScalar(1 - 0.65 * rain); }
  }

  /* place a team's pit crew: idle by the garage, or around the car (stopped at its box) */
  /* active=true: the team's stop crew comes out to the box (car = the car being serviced, for its wheel positions);
     active=null: they go back to standing by the garage */
  crewPose(team, active, car) {
    if (!this.crew) return;
    const { T, per } = this.crewInfo, P = T.pit, ps = P.side, N = T.N;
    const box = (P.boxStart + team * P.boxGap) % N, tx = T.tx[box], tz = T.tz[box], nx = T.nx[box] * ps, nz = T.nz[box] * ps;
    const bx = T.px[box] + T.nx[box] * P.lat, bz = T.pz[box] + T.nz[box] * P.lat, h = Math.atan2(tx, tz), by = bankH(T, box, P.lat);
    const d = new THREE.Object3D();
    for (let k = 0; k < per; k++) {
      const along = (k - per / 2) * 0.8, side = 3.6 + (k % 2) * 0.7;
      d.position.set(bx + tx * along + nx * side, by, bz + tz * along + nz * side); d.rotation.set(0, h + Math.PI / 2 * -ps, 0);
      d.scale.setScalar(active ? 0 : 1); d.updateMatrix(); this.crew.setMatrixAt(team * per + k, d.matrix);
    }
    this.crew.instanceMatrix.needsUpdate = true;
    let sc = this.stopCrews.get(team);
    if (active) {
      if (!sc) { sc = buildStopCrew(this.crewColors[team] || '#ffcc00', ps); this.stopCrews.set(team, sc); this.crewG.add(sc.g); }
      if (car) sc.setCar(car);
      sc.g.position.set(bx, by, bz); sc.g.rotation.set(0, h, 0); sc.g.visible = true; sc.anim(-1);
    } else if (sc) sc.g.visible = false;
  }
  /* s < 0: waiting for the car; 0..1: through the stop; > 1: car released */
  crewAnim(team, s) { const sc = this.stopCrews && this.stopCrews.get(team); if (sc && sc.g.visible) sc.anim(s); }
  resetCrews() { if (!this.crew) return; for (let t = 0; t < this.crewInfo.teams; t++) this.crewPose(t, null); }

  /* racing line colours from a speed plan: red = braking, yellow = through the corner, green = full throttle */
  /* racing line colours from the speed you can actually reach: the corner/braking limit (prof) combined with how
     hard the car can accelerate (spec power, drag, top speed). Red = brake (a real slowdown is coming), yellow =
     hold speed through the corner, green = on the throttle. */
  colorRaceLine(prof, spec) {
    const g = this.raceGeo, T = this.raceT; if (!g || !prof) return;
    const N = T.N, cols = g.attributes.color.array, c = new THREE.Color(), sp = spec || { power: 1, drag: 1, vmax: 1 };
    const vm = 95 * (sp.vmax || 1), acc = v => Math.max(0.4, 11.5 * (sp.power || 1) * Math.max(0, 1 - (v / vm) ** 2) - 0.00028 * (sp.drag || 1) * v * v - 0.3);
    let i0 = 0; for (let i = 1; i < N; i++) if (prof[i] < prof[i0]) i0 = i;
    const va = new Float32Array(N); va[i0] = prof[i0];
    for (let k = 1; k <= 2 * N; k++) { const i = (i0 + k) % N, p = (i - 1 + N) % N; va[i] = Math.min(prof[i], Math.sqrt(va[p] * va[p] + 2 * acc(va[p]) * DS)); }
    this.lineSpeed = va;
    for (let k = 0; k <= N; k++) {
      const i = k % N, here = va[i], ahead = va[(i + 2) % N];
      let minAhead = here; for (let j = 1; j <= 30; j++) minAhead = Math.min(minAhead, va[(i + j) % N]);
      if (ahead < here - 0.05 && here - minAhead > 2.5) c.set('#ff2a2a');          // brake: a real slowdown for the corner ahead
      else if (ahead <= here + 0.03 && here >= prof[i] - 0.5 && prof[i] < vm * 0.97) c.set('#ffd21a');   // at the corner's limit: hold the speed
      else c.set('#2bff6a');                                                        // on the throttle
      for (let col2 = 0; col2 < 2; col2++) cols.set([c.r, c.g, c.b], (k * 2 + col2) * 3);
    }
    g.attributes.color.needsUpdate = true;
  }
  setRaceLine(on) { this.showLine = on; if (this.raceLine) this.raceLine.visible = on; }

  setStartLights(n) { this.gantryLights.forEach((m, k) => { m.emissiveIntensity = k < n ? 6 : 0; m.color.set(k < n ? '#ff2a2a' : '#160404'); }); }

  update(dt, focus, camera) {
    if (this.hotelShell) this.hotelShell.emissive.setHSL((performance.now() / 24000) % 1, 0.85, 0.55);
    if (this.clouds) { this.cloudTex.offset.x += dt * 0.0015; this.cloudTex.offset.y += dt * 0.0006; }
    for (const w of this.waters) { w.offset.x += dt * 0.01; w.offset.y += dt * 0.006; }
    this.nightSky.position.copy(camera.position); this.stars.position.copy(camera.position);
    if (this.moon.visible) { this.moon.position.copy(camera.position).addScaledVector(this.sunDir, 12000); this.moon.lookAt(camera.position); }
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 400); this.sun.target.position.copy(focus);
  }
}

/* ------------------------------------------------------------------
   Pit stop crew: 17 people in team overalls with helmets. Wheel-gun
   operators, tyre-off and tyre-on carriers, front and rear jacks,
   two stabilisers and a release man with a lollipop board.
   Positions are in the car's frame: +z forward, +x towards the garage
   when ps > 0.
   ------------------------------------------------------------------ */
const CREW_MATS = {};
function crewMats(color) {
  if (!CREW_MATS[color]) CREW_MATS[color] = {
    suit: new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
    trim: new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.6 }),
    helmet: new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.2 }),
    visor: new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.1, metalness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.35, metalness: 0.8 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.4, metalness: 0.7 }),
    red: new THREE.MeshStandardMaterial({ color: '#e11d1d', roughness: 0.5, emissive: '#e11d1d', emissiveIntensity: 0.25 }),
    green: new THREE.MeshStandardMaterial({ color: '#16c35a', roughness: 0.5, emissive: '#16c35a', emissiveIntensity: 0.35 }),
  };
  return CREW_MATS[color];
}
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
function makeTyre(M) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.36, 20), M.tyre); t.rotation.z = Math.PI / 2; t.castShadow = true;
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.37, 16), M.rim); r.rotation.z = Math.PI / 2;
  g.add(t, r); return g;
}
function makePerson(M) {
  const g = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.86; g.add(hips);
  const leg = x => { const p = new THREE.Group(); p.position.set(x, 0, 0); p.add(box(0.15, 0.82, 0.17, M.suit, 0, -0.41, 0), box(0.16, 0.08, 0.27, M.dark, 0, -0.82, 0.04)); hips.add(p); return p; };
  const legL = leg(-0.11), legR = leg(0.11);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(box(0.44, 0.62, 0.26, M.suit, 0, 0.31, 0), box(0.45, 0.07, 0.27, M.trim, 0, 0.06, 0), box(0.06, 0.5, 0.272, M.trim, 0, 0.33, 0));
  const arm = x => { const p = new THREE.Group(); p.position.set(x, 0.56, 0); p.add(box(0.12, 0.6, 0.13, M.suit, 0, -0.3, 0), box(0.13, 0.12, 0.14, M.dark, 0, -0.64, 0)); torso.add(p); return p; };
  const armL = arm(-0.29), armR = arm(0.29);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 12), M.helmet); head.position.y = 0.8; head.castShadow = true;
  const visor = box(0.22, 0.08, 0.06, M.visor, 0, 0.81, 0.13);
  torso.add(head, visor);
  return { g, hips, torso, legL, legR, armL, armR };
}
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (s, a, b) => clamp((s - a) / (b - a), 0, 1);
const ease = t => t * t * (3 - 2 * t);

function buildStopCrew(color, ps) {
  const M = crewMats(color), g = new THREE.Group(), people = [];
  let wx = 1.0, af = 1.75, ar = -1.85, nose = 3.4, tail = -2.7;
  const add = role => { const p = makePerson(M); p.role = role; g.add(p.g); people.push(p); return p; };
  // equipment
  const gun = () => { const q = new THREE.Group(); q.add(box(0.11, 0.11, 0.34, M.steel, 0, 0, 0.12), box(0.07, 0.16, 0.07, M.dark, 0, -0.1, -0.02), box(0.05, 0.05, 0.16, M.dark, 0, 0, -0.12)); q.position.set(0, -0.66, 0.05); q.rotation.x = Math.PI / 2; return q; };
  const jackBar = () => { const q = new THREE.Group(); q.add(box(0.06, 0.06, 1.5, M.steel, 0, 0, 0.75), box(0.5, 0.08, 0.14, M.dark, 0, 0, 1.5), box(0.36, 0.06, 0.06, M.dark, 0, 0, 0)); return q; };
  const wheels = [];
  for (const sx of [1, -1]) for (const front of [true, false]) {
    const w = { sx, front };
    w.gunner = add('gun'); w.gun = gun(); w.gunner.armR.add(w.gun);
    w.off = add('off'); w.oldTyre = makeTyre(M); g.add(w.oldTyre);
    w.on = add('on'); w.newTyre = makeTyre(M); g.add(w.newTyre);
    wheels.push(w);
  }
  const fj = add('fjack'), rj = add('rjack');
  const fBar = jackBar(), rBar = jackBar(); g.add(fBar, rBar);
  const stabs = [add('stab'), add('stab')];
  const rel = add('release');
  const lolly = new THREE.Group(); lolly.add(box(0.04, 1.3, 0.04, M.dark, 0, 0.65, 0));
  const signR = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 20), M.red), signG = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 20), M.green);
  for (const sg of [signR, signG]) { sg.rotation.z = Math.PI / 2; sg.position.y = 1.4; lolly.add(sg); }
  rel.armR.add(lolly); lolly.position.set(0, -0.66, 0.04); lolly.rotation.x = Math.PI;

  const face = (p, dx, dz) => { p.g.rotation.y = Math.atan2(dx, dz); };
  const place = (p, x, z, fx, fz) => { p.g.position.set(x, 0, z); face(p, fx - x, fz - z); };
  const pose = (p, o = {}) => {
    p.g.position.y = o.y || 0; p.hips.position.y = 0.86 + (o.crouch || 0) * -0.42;
    p.legL.rotation.x = (o.crouch || 0) * -1.3 + (o.walk || 0); p.legR.rotation.x = (o.crouch || 0) * 0.5 - (o.walk || 0);
    p.torso.rotation.x = (o.lean || 0);
    p.armL.rotation.set(o.aL || 0, 0, o.zL || 0); p.armR.rotation.set(o.aR || 0, 0, o.zR || 0);
  };
  const walk = m => m > 0 && m < 1 ? Math.sin(m * Math.PI * 6) * 0.45 : 0;
  const setCar = car => {
    const ws = car && car.wheels; if (!ws || !ws.length) return;
    let mx = 0, zf = -9, zr = 9;
    for (const w of ws) { const q = w.pivot.position; mx = Math.max(mx, Math.abs(q.x)); zf = Math.max(zf, q.z); zr = Math.min(zr, q.z); }
    wx = mx; af = zf; ar = zr; nose = af + 1.75; tail = ar - 0.95;
  };
  const anim = s => {
    const t = performance.now() / 1000;
    const ready = s < 0, st = ready ? 0 : Math.min(s, 1), after = Math.max(0, s - 1);
    const gunOn1 = seg(st, 0.1, 0.16) * (1 - seg(st, 0.27, 0.31)), gunOn2 = seg(st, 0.62, 0.66) * (1 - seg(st, 0.76, 0.8));
    const buzz = (gunOn1 > 0.9 && st < 0.27) || (gunOn2 > 0.9 && st < 0.76) ? Math.sin(t * 90) * 0.04 : 0;
    const done = ready ? 0 : seg(st, 0.86, 1);
    for (const w of wheels) {
      const az = w.front ? af : ar, sx = w.sx, out = sx * (wx + 0.55), dz = w.front ? 1 : -1;
      // wheel gun: kneels at the hub, gun on, off, on again, then stands back
      const back = ease(done) * 0.9;
      place(w.gunner, sx * (wx + 0.62 + back), az, 0, az);
      pose(w.gunner, { crouch: 1 - ease(done), aR: -(gunOn1 + gunOn2 > 0 ? 1.45 : 0.6) * (1 - done) + buzz, aL: -1.1 * (1 - done), zR: 0, lean: 0.25 * (1 - done) });
      w.gun.visible = true;
      // tyre off: grabs the old tyre and carries it clear
      const take = seg(st, 0.22, 0.27), carry = ease(seg(st, 0.28, 0.5));
      const ox = lerp(lerp(out + sx * 0.25, sx * (wx + 0.25), take), sx * (wx + 2.3), carry), oz = lerp(az + dz * 0.85 * (1 - take), az + dz * 0.6, carry);
      place(w.off, ox + sx * 0.45, oz, sx > 0 ? -50 : 50, oz);
      pose(w.off, { aL: -1.25, aR: -1.25, lean: 0.35 * (take > 0 && carry < 1 ? 1 : 0.4), walk: walk(carry) });
      w.oldTyre.visible = !ready && st >= 0.25;
      if (st < 0.5) w.oldTyre.position.set(take < 1 ? sx * wx : ox, 0.36 + (take >= 1 ? 0.45 : 0), take < 1 ? az : oz), w.oldTyre.rotation.set(0, 0, 0);
      else { w.oldTyre.position.set(sx * (wx + 2.3), 0.18, az + dz * 0.6); w.oldTyre.rotation.set(0, 0, Math.PI / 2); }
      // tyre on: waits with the new tyre, fits it, steps back
      const fit = ease(seg(st, 0.4, 0.62)), clear = ease(seg(st, 0.72, 0.86));
      const nx2 = lerp(lerp(sx * (wx + 0.95), sx * (wx + 0.35), fit), sx * (wx + 1.6), clear), nz2 = lerp(lerp(az - dz * 0.95, az, fit), az - dz * 1.0, clear);
      place(w.on, nx2 + sx * 0.4, nz2, sx > 0 ? -50 : 50, nz2);
      pose(w.on, { aL: clear > 0 ? -0.2 : -1.25, aR: clear > 0 ? -0.2 : -1.25, lean: clear > 0 ? 0 : 0.3, walk: walk(fit) + walk(clear) });
      w.newTyre.visible = st < 0.7;
      w.newTyre.position.set(nx2, 0.36 + 0.45 * (1 - fit), nz2);
    }
    // front jack: waits in front of the nose, lifts at the start and lowers at the end
    const lift = seg(st, 0.04, 0.1) * (1 - seg(st, 0.8, 0.86));
    const fjBack = ready ? 0 : ease(seg(st, 0.86, 0.98)) * 1.4 + after * 3;
    place(fj, fjBack > 0 ? ps * Math.min(fjBack, 2.4) : 0, nose + 1.2, 0, nose);
    pose(fj, { aL: -0.9 - 0.4 * lift, aR: -0.9 - 0.4 * lift, lean: 0.2 + 0.25 * lift });
    fBar.position.set(fj.g.position.x, 0.2 + 0.1 * lift, nose + 1.05); fBar.rotation.set(-0.35 + 0.2 * lift, Math.PI, 0); fBar.visible = fjBack < 0.6;
    // rear jack: runs in from the side once the car has stopped
    const rin = ready ? 0 : ease(seg(st, 0, 0.06)), rout = ease(seg(st, 0.86, 0.96));
    const rjx = lerp(ps * 2.2, 0, rin * (1 - rout)), rjz = tail - 1.15;
    place(rj, rjx, rjz, rjx, tail);
    pose(rj, { aL: -0.9 - 0.4 * lift, aR: -0.9 - 0.4 * lift, lean: 0.2 + 0.25 * lift, walk: walk(rin) + walk(rout) });
    rBar.position.set(rjx, 0.2 + 0.1 * lift, tail - 1.0); rBar.rotation.set(-0.35 + 0.2 * lift, 0, 0); rBar.visible = rin > 0.95 && rout < 0.05;
    // stabilisers hold the sidepods
    stabs.forEach((p, k) => { const sx = k ? -1 : 1, x = sx * (0.95 + (ready ? 0.6 : 0) + done * 0.6); place(p, x, (af + ar) / 2 - 0.2, 0, (af + ar) / 2 - 0.2); pose(p, { aL: ready ? -0.2 : -1.0, aR: ready ? -0.2 : -1.0, lean: ready ? 0 : 0.45, crouch: ready ? 0 : 0.35 }); });
    // release: red board down during the stop, green raised to send the car
    const go = !ready && st >= 0.9;
    place(rel, ps * (wx + 1.4), nose + 0.3, 0, nose - 1);
    pose(rel, { aR: go ? -2.9 : -1.45, aL: 0, lean: 0 });
    signR.visible = !go; signG.visible = go;
  };
  anim(-1);
  return { g, anim, setCar, lift: s => s < 0 ? 0 : 0.08 * seg(s, 0.04, 0.1) * (1 - seg(s, 0.8, 0.86)) };
}

