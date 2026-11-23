import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex } from './util.js?v=spa26d';

/* A generic open-wheeler built to the shape of the 2025 technical rules:
   ground-effect floor, undercut sidepods with downwash ramps, 4-element front wing,
   18" wheels with covers and wake deflectors, swept rear-wing tips and a beam wing.
   Front axle z = +1.80, rear axle z = -1.80 (3.6 m wheelbase), overall ~5.6 m. */
export let AXLE_F = 1.8, AXLE_R = -1.8;
export const TRACK_F = 0.8, TRACK_R = 0.79;

/* Lofted body: sections [z, halfWidth, halfHeight, centreY, superellipseExponent, xOffset?] */
function loft(secs, segs = 28) {
  const pos = [], idx = [], ring = segs;
  const pt = (s, k) => {
    const [z, hw, hh, yc, n, xo = 0] = s, t = k / ring * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), e = 2 / n;
    return [xo + Math.sign(c) * Math.pow(Math.abs(c), e) * hw, yc + Math.sign(sn) * Math.pow(Math.abs(sn), e) * hh, z];
  };
  secs.forEach(s => { for (let k = 0; k < ring; k++) pos.push(...pt(s, k)); });
  for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < ring; k++) {
    const a = i * ring + k, b = i * ring + (k + 1) % ring, c = (i + 1) * ring + k, d = (i + 1) * ring + (k + 1) % ring;
    idx.push(a, b, c, b, d, c);
  }
  const cap = (i, front) => {
    const base = pos.length / 3, s = secs[i];
    pos.push(s[5] || 0, s[3], s[0]);
    for (let k = 0; k < ring; k++) pos.push(...pt(s, k));
    for (let k = 0; k < ring; k++) { const a = base + 1 + k, b = base + 1 + (k + 1) % ring; front ? idx.push(base, a, b) : idx.push(base, b, a); }
  };
  cap(0, false); cap(secs.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// monocoque + engine cover + long low nose
const BODY = [
  [-2.0, 0.13, 0.12, 0.40, 3], [-1.75, 0.2, 0.18, 0.46, 3], [-1.2, 0.25, 0.25, 0.54, 3], [-0.65, 0.28, 0.31, 0.6, 3],
  [-0.3, 0.3, 0.4, 0.63, 3.2], [-0.1, 0.35, 0.33, 0.53, 3.6], [0.15, 0.4, 0.26, 0.46, 4], [0.8, 0.4, 0.24, 0.44, 4],
  [1.2, 0.33, 0.2, 0.41, 3.4], [1.7, 0.22, 0.15, 0.35, 3], [2.4, 0.15, 0.11, 0.28, 2.6], [3.0, 0.11, 0.08, 0.23, 2.4],
  [3.35, 0.07, 0.055, 0.2, 2.2], [3.45, 0.03, 0.03, 0.19, 2],
];
// ground-effect sidepod: high, wide inlet; deep undercut beneath; steep downwash ramp to the rear
const POD = x => [
  [-1.45, 0.05, 0.05, 0.3, 3, x * 0.4], [-1.1, 0.14, 0.1, 0.34, 3, x * 0.48], [-0.55, 0.24, 0.16, 0.42, 3.4, x * 0.6],
  [0.1, 0.29, 0.2, 0.47, 4, x * 0.66], [0.6, 0.29, 0.19, 0.5, 4.5, x * 0.66], [0.78, 0.27, 0.17, 0.51, 4.5, x * 0.66],
];

let MODEL = null;
function buildModel() {
  const buckets = { body: [], acc: [], carbon: [], dark: [], metal: [], light: [], fw_carbon: [], fw_body: [], fw_acc: [], rw_acc: [], rw_body: [], rw_carbon: [] };
  const add = (geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    buckets[key].push(g);
  };
  const RB = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);
  const plate = (pts, depth) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); };

  add(loft(BODY), 'body');
  add(loft(POD(1), 24), 'body'); add(loft(POD(-1), 24), 'body');
  // sidepod inlets (dark mouths) and roll-hoop intake
  for (const sx of [1, -1]) add(new THREE.CircleGeometry(1, 24), 'dark', sx * 0.66, 0.5, 0.785, 0, 0, 0, 0.23, 0.13, 1);
  add(plate([[-0.13, 0], [0.13, 0], [0, 0.2]], 0.02), 'dark', 0, 0.9, -0.2);
  // cockpit opening + headrest
  add(new THREE.CircleGeometry(1, 28), 'dark', 0, 0.695, 0.5, -Math.PI / 2, 0, 0, 0.24, 0.42, 1);
  add(RB(0.48, 0.1, 0.22, 0.04), 'carbon', 0, 0.71, 0.08);
  // T-cam and antenna
  add(RB(0.12, 0.07, 0.22, 0.03), 'acc', 0, 1.06, -0.34);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.3), 'carbon', 0.08, 1.12, -0.55, 0.3);
  // small engine-cover fin
  add(plate([[0, 0], [-1.25, 0], [-1.2, 0.17], [-0.2, 0.05]], 0.016), 'body', -0.008, 0.93, -0.5, 0, -Math.PI / 2, 0);
  // wide ground-effect floor with edge wings and the fences under the nose
  add(RB(1.84, 0.04, 3.1, 0.02), 'carbon', 0, 0.07, -0.35);
  add(RB(1.15, 0.04, 0.8, 0.02), 'carbon', 0, 0.07, 1.45);
  for (const sx of [1, -1]) { add(RB(0.03, 0.09, 2.6, 0.01), 'carbon', sx * 0.92, 0.12, -0.45); add(RB(0.22, 0.02, 0.55, 0.01), 'carbon', sx * 0.84, 0.17, 0.75, 0, 0, sx * 0.35); add(RB(0.02, 0.12, 0.7, 0.01), 'carbon', sx * 0.35, 0.12, 1.25); }
  // big diffuser + two-element beam wing
  add(RB(1.05, 0.03, 0.75, 0.01), 'carbon', 0, 0.2, -2.0, 0.42);
  for (const sx of [1, -1]) add(RB(0.03, 0.34, 0.75, 0.01), 'carbon', sx * 0.52, 0.22, -2.0);
  add(RB(0.95, 0.03, 0.16, 0.01), 'carbon', 0, 0.44, -2.12, 0.25); add(RB(0.95, 0.025, 0.12, 0.01), 'carbon', 0, 0.52, -2.22, -0.1);
  // front wing: four elements sweeping up outboard, endplates, nose pylons
  const fwEl = [[0, 0.085, 3.38, 0.4, 0, 'fw_carbon'], [1, 0.14, 3.28, 0.2, -0.22, 'fw_body'], [2, 0.19, 3.18, 0.17, -0.42, 'fw_body'], [3, 0.24, 3.09, 0.15, -0.6, 'fw_acc']];
  for (const [n, y, z, d, rx, key] of fwEl) {
    add(RB(1.6, 0.022, d, 0.008), key, 0, y, z, rx, 0, 0);
    for (const sx of [1, -1]) add(RB(0.22, 0.022, d, 0.008), key, sx * 0.9, y + 0.025 + 0.012 * n, z, rx, 0, -sx * 0.28);
  }
  for (const sx of [1, -1]) { add(plate([[0, 0], [0.6, 0], [0.6, 0.22], [0.12, 0.34], [0, 0.28]], 0.022), 'fw_carbon', sx * 1.0 + 0.011, 0.06, 2.92, 0, -Math.PI / 2, 0); add(RB(0.02, 0.13, 0.2), 'fw_carbon', sx * 0.12, 0.17, 3.1); }
  // rear wing: main plane + flap with rolled tips into the endplates, single swan-neck pylon
  add(RB(0.9, 0.05, 0.34, 0.015), 'rw_acc', 0, 0.97, -2.3, 0.1);
  add(RB(0.88, 0.035, 0.22, 0.012), 'rw_body', 0, 1.09, -2.42, -0.35);
  for (const sx of [1, -1]) {
    add(RB(0.06, 0.28, 0.5, 0.025), 'rw_body', sx * 0.47, 0.88, -2.33, 0, 0, sx * 0.55);
    add(plate([[0, 0], [0.6, 0], [0.6, 0.4], [0.18, 0.5], [0, 0.42]], 0.025), 'rw_body', sx * 0.5 + 0.012, 0.62, -2.62, 0, -Math.PI / 2, 0);
  }
  add(RB(0.05, 0.42, 0.1, 0.01), 'carbon', 0, 0.75, -2.12, -0.25);
  // exhaust + rain light
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 12), 'metal', 0, 0.56, -2.0, Math.PI / 2);
  add(RB(0.18, 0.08, 0.03, 0.01), 'light', 0, 0.36, -2.4);
  // halo
  { const c = new THREE.CatmullRomCurve3([[0.34, 0.71, 0.05], [0.34, 0.85, 0.28], [0.26, 0.92, 0.66], [0, 0.94, 0.78], [-0.26, 0.92, 0.66], [-0.34, 0.85, 0.28], [-0.34, 0.71, 0.05]].map(p => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(c, 40, 0.026, 8), 'carbon');
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.94, 0.78), new THREE.Vector3(0, 0.85, 0.88), new THREE.Vector3(0, 0.7, 0.98)]), 10, 0.03, 8), 'carbon'); }
  // mirrors on the sidepods
  for (const sx of [1, -1]) { add(RB(0.02, 0.18, 0.02), 'carbon', sx * 0.58, 0.68, 0.7); add(RB(0.17, 0.08, 0.06, 0.025), 'body', sx * 0.6, 0.79, 0.7); }
  // suspension (push-rod front, pull-rod rear) and wheel-wake deflectors above the front tyres
  const arm = (x0, y0, z0, x1, y1, z1, r = 0.014) => {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 6); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(a.x, a.y, a.z); add(g, 'carbon');
  };
  for (const sx of [1, -1]) {
    const fz = AXLE_F, rz = AXLE_R, fx = sx * (TRACK_F - 0.04), rx = sx * (TRACK_R - 0.04);
    arm(sx * 0.15, 0.44, fz + 0.15, fx, 0.48, fz); arm(sx * 0.15, 0.44, fz - 0.3, fx, 0.48, fz);
    arm(sx * 0.15, 0.25, fz + 0.2, fx, 0.24, fz); arm(sx * 0.15, 0.25, fz - 0.35, fx, 0.24, fz);
    arm(sx * 0.2, 0.25, fz - 0.1, fx, 0.46, fz, 0.012);
    arm(sx * 0.28, 0.45, rz + 0.15, rx, 0.48, rz); arm(sx * 0.28, 0.28, rz - 0.15, rx, 0.25, rz); arm(sx * 0.28, 0.28, rz + 0.3, rx, 0.25, rz);
    add(RB(0.3, 0.018, 0.24, 0.006), 'carbon', fx * 1.02, 0.78, fz - 0.02, 0.15);
  }
  const merged = {};
  for (const k in buckets) if (buckets[k].length) merged[k] = mergeGeometries(buckets[k], false);
  // 18-inch wheels: low-profile tyre and wheel cover
  const tyreProfile = (R, w, rim) => [[rim, -w / 2], [R - 0.045, -w / 2 - 0.003], [R - 0.01, -w / 2 + 0.025], [R, -w / 2 + 0.06], [R, w / 2 - 0.06], [R - 0.01, w / 2 - 0.025], [R - 0.045, w / 2 + 0.003], [rim, w / 2]].map(p => new THREE.Vector2(p[0], p[1]));
  const wheelGeo = (R, w) => ({
    tyre: new THREE.LatheGeometry(tyreProfile(R, w, 0.235), 36).rotateZ(Math.PI / 2),
    rim: new THREE.CylinderGeometry(0.24, 0.24, w - 0.01, 28, 1, true).rotateZ(Math.PI / 2),
    face: new THREE.CircleGeometry(0.24, 28),
    stripe: new THREE.TorusGeometry(R - 0.055, 0.007, 4, 40).rotateY(Math.PI / 2),
    w,
  });
  MODEL = { merged, front: wheelGeo(0.36, 0.3), rear: wheelGeo(0.36, 0.4) };
  MODEL.wheelMats = {
    tyre: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.88 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.4, metalness: 0.8 }),
    face: new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#16171b'; g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2);
      g.strokeStyle = '#3a3d44'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.fillStyle = '#2b2e35'; g.fillRect(-3, 20, 6, 34); }
      g.fillStyle = '#8a8f99'; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
    }, { repeat: false }), roughness: 0.45, metalness: 0.5 }),
    soft: new THREE.MeshStandardMaterial({ color: 0xe2231a, roughness: 0.6 }), medium: new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.6 }), hard: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 }),
    inter: new THREE.MeshStandardMaterial({ color: 0x2bb54a, roughness: 0.6 }), wet: new THREE.MeshStandardMaterial({ color: 0x1e6fe0, roughness: 0.6 }),
  };
  return MODEL;
}

function numberTex(num, color, stroke) {
  return canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'italic 800 100px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = stroke; g.strokeText(String(num), w / 2, h / 2 + 4);
    g.fillStyle = color; g.fillText(String(num), w / 2, h / 2 + 4);
  }, { repeat: false });
}

/* ---- liveries: paint patterns drawn by the body shader from the car's own coordinates (x across, y up,
   z forward), so they wrap every body shape without texture maps. c1 = base, c2 = second colour, c3 = pinstripes */
export const LIVERY_PATTERNS = ['stripes', 'twotone', 'sash', 'nose', 'arrow', 'fade', 'gulf', 'halves'];
function applyLivery(mat, pattern, c2, c3) {
  const k = LIVERY_PATTERNS.indexOf(pattern); if (k < 0) return;
  mat.userData.liv = { uC2: { value: new THREE.Color(c2) }, uC3: { value: new THREE.Color(c3) } };
  mat.customProgramCacheKey = () => 'liv' + k;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, mat.userData.liv);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLivPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLivPos = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLivPos; uniform vec3 uC2; uniform vec3 uC3;
vec3 livery(vec3 p, vec3 c1) {
  float ax = abs(p.x); vec3 c = c1; float e = 0.025;
  #if ${k} == 0
    if (ax > 0.07 && ax < 0.17) c = uC2; else if (ax > 0.17 && ax < 0.17 + e || ax > 0.07 - e && ax < 0.07) c = uC3;
  #elif ${k} == 1
    float b = 0.5 + 0.06 * sin(p.z * 0.8); if (p.y < b) c = uC2; else if (p.y < b + e * 1.4) c = uC3;
  #elif ${k} == 2
    float d = p.z * 0.55 + p.y * 1.1; if (d > -0.25 && d < 0.3) c = uC2; else if (d > 0.3 && d < 0.3 + e * 2.0) c = uC3;
  #elif ${k} == 3
    float f = p.z - 0.25 * ax; if (f > 1.1) c = uC2; else if (f > 1.1 - e * 2.0) c = uC3; if (p.z < -1.6 && p.y > 0.55) c = uC2;
  #elif ${k} == 4
    float v = p.z + ax * 1.6; if (v > 0.2 && v < 0.75) c = uC2; else if (v > 0.75 && v < 0.75 + e * 2.0) c = uC3;
  #elif ${k} == 5
    c = mix(uC2, c1, smoothstep(-1.4, 1.2, p.z)); if (abs(p.z - 0.4 + ax * 0.9) < e) c = uC3;
  #elif ${k} == 6
    if (ax < 0.24) c = uC2; if (abs(ax - 0.24) < e * 1.2) c = uC3;
  #else
    if (p.y + p.z * 0.12 < 0.58) c = uC2; if (abs(p.y + p.z * 0.12 - 0.58) < e) c = uC3;
  #endif
  return c;
}`).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = livery(vLivPos, diffuseColor.rgb);');
  };
}

export function makeCar({ color, accent, helmet = '#ffffff', number = 1, compound = 'medium', model = 'f1', livery = null }) {
  const M = MODEL || buildModel();
  if (model === 'gt3' || model === 'hyper') { const car = makeClosedCar(model, { color, accent, helmet, number, compound }); if (livery) applyLivery(car.mats.body, livery.p, livery.c2 || accent, livery.c3 || '#ffffff'); addInterior(car.group, model); return fitCockpit(car, model, helmet); }
  const g = new THREE.Group();
  const mats = {
    body: new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    acc: new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.35, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    carbon: CARBON, dark: DARK, metal: METAL, light: LIGHT,
  };
  const shadow = new THREE.Mesh(SHADOW, SHADOW_MAT); shadow.position.y = 0.025; shadow.renderOrder = 1; g.add(shadow);
  const fwing = new THREE.Group(), rwing = new THREE.Group(); g.add(fwing, rwing);
  if (livery) applyLivery(mats.body, livery.p, livery.c2 || accent, livery.c3 || '#ffffff');
  if (EXT) { const car = makeExtCar(g, fwing, rwing, mats, compound); if (model === 'indy') addAeroscreen(g); return fitCockpit(car, model, helmet); }
  for (const k in M.merged) {
    const part = k.startsWith('fw_') ? fwing : k.startsWith('rw_') ? rwing : g, mk = k.replace(/^(fw|rw)_/, '');
    part.add(new THREE.Mesh(M.merged[k], mats[mk]));
  }
  const tex = numberTex(number, '#ffffff', 'rgba(0,0,0,.65)');
  const nmat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  for (const sx of [1, -1]) { const p = new THREE.Mesh(NUM_FIN, nmat); p.position.set(sx * 0.014, 0.99, -1.0); p.rotation.y = sx * Math.PI / 2; g.add(p); }
  const nose = new THREE.Mesh(NUM_NOSE, nmat); nose.position.set(0, 0.36, 2.1); nose.rotation.set(-Math.PI / 2 + 0.1, 0, Math.PI); g.add(nose);
  const helmetMesh = new THREE.Group(); helmetMesh.position.set(0, 0.84, 0.34);
  helmetMesh.add(new THREE.Mesh(HELMET, new THREE.MeshPhysicalMaterial({ color: helmet, roughness: 0.2, metalness: 0.3, clearcoat: 1 })), new THREE.Mesh(VISOR, VISOR_MAT));
  g.add(helmetMesh);
  const wheels = [], stripes = [];
  const wheel = (x, z, front) => {
    const W = front ? M.front : M.rear;
    const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(W.tyre, M.wheelMats.tyre), new THREE.Mesh(W.rim, M.wheelMats.rim));
    const face = new THREE.Mesh(W.face, M.wheelMats.face); face.position.x = Math.sign(x) * (W.w / 2 - 0.004); face.rotation.y = Math.sign(x) * Math.PI / 2; spin.add(face);
    for (const s of [1, -1]) { const st = new THREE.Mesh(W.stripe, M.wheelMats[compound]); st.position.x = s * (W.w / 2 + 0.002); spin.add(st); stripes.push(st); }
    wheels.push({ pivot, spin, front });
  };
  wheel(TRACK_F, AXLE_F, true); wheel(-TRACK_F, AXLE_F, true); wheel(TRACK_R, AXLE_R, false); wheel(-TRACK_R, AXLE_R, false);
  const steering = new THREE.Group(); steering.position.set(0, 0.6, 0.7); steering.rotation.x = -0.55; g.add(steering);
  steering.add(new THREE.Mesh(SW, DARK));
  for (const sx of [1, -1]) { const gr = new THREE.Mesh(SW_GRIP, CARBON); gr.position.set(sx * 0.15, -0.01, 0); steering.add(gr); }
  const scr = new THREE.Mesh(SW_SCREEN, SCREEN_MAT); scr.position.set(0, 0.015, -0.026); scr.rotation.y = Math.PI; steering.add(scr);
  steering.visible = false;
  return { group: g, wheels, helmet: helmetMesh, steering, cockpitHide: [helmetMesh], mats, numTex: tex, stripes, fwing, rwing };
}

/* ---- Licensed car model (generic, brandless) ----
   Stored in the game's own encrypted format (js/car.bin) so the original model file is not
   downloadable from the site, as its royalty-free licence requires. */
let EXT = null;
export async function loadCarModel(url) {
  try {
    const res = await fetch(url); if (!res.ok) return false;
    const all = new Uint8Array(await res.arrayBuffer());
    if (String.fromCharCode(...all.slice(0, 4)) !== 'AGP1') return false;
    const metaLen = new DataView(all.buffer).getUint32(4, true);
    const body = all.slice(8);
    let st = 0x9E3779B9 >>> 0;
    for (let i = 0; i < body.length; i++) { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; body[i] ^= st & 255; }
    const meta = JSON.parse(new TextDecoder().decode(body.slice(0, metaLen)));
    const base = metaLen + (4 - (metaLen % 4)) % 4, ab = body.buffer;
    const parts = {};
    for (const p of meta.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ab.slice(base + p.posOff, base + p.posOff + p.nPos * 4)), 3));
      const I = p.i32 ? new Uint32Array(ab.slice(base + p.idxOff, base + p.idxOff + p.nIdx * 4)) : new Uint16Array(ab.slice(base + p.idxOff, base + p.idxOff + p.nIdx * 2));
      geo.setIndex(new THREE.BufferAttribute(I, 1));
      // smooth shading on curved panels, sharp shading across hard edges
      parts[p.name] = { geo: toCreasedNormals(geo, Math.PI / 5), hub: p.hub };
    }
    EXT = { meta, parts };
    AXLE_F = meta.axleF; AXLE_R = meta.axleR;
    buildModel();
    return true;
  } catch (e) { console.warn('car model failed to load, using built-in car', e); return false; }
}
function makeExtCar(g, fwing, rwing, mats, compound) {
  const M = MODEL, P = EXT.parts, R = EXT.meta.R;
  // painted (not metallic) livery
  mats.body.metalness = 0.05; mats.body.roughness = 0.42; mats.body.clearcoatRoughness = 0.18;
  mats.acc.metalness = 0.05; mats.acc.roughness = 0.45;
  const add = (name, mat, parent) => { if (P[name]) parent.add(new THREE.Mesh(P[name].geo, mat)); };
  add('body', mats.body, g); add('acc', mats.acc, g); add('carbon', CARBON, g);
  add('fw_acc', mats.acc, fwing); add('fw_carbon', CARBON, fwing); add('rw_acc', mats.acc, rwing);
  // clean halo (the model's own one was lumpy): a titanium tube round the cockpit plus the centre pillar
  g.add(new THREE.Mesh(EXT_HALO, HALO_MAT), new THREE.Mesh(EXT_PILLAR, HALO_MAT));
  for (const sx of [1, -1]) { const foot = new THREE.Mesh(EXT_FOOT, HALO_MAT); foot.position.set(sx * 0.33, 0.79, 0.13); g.add(foot); }
  // clean 18" wheels built to the model's measured hubs and radius
  const W = extWheels(R), hx = EXT.meta.hubX || { f: 1.02, r: 1.06 };
  const wheels = [], stripes = [];
  for (const [front, sx] of [[true, 1], [true, -1], [false, 1], [false, -1]]) {
    const geo = front ? W.front : W.rear;
    const pivot = new THREE.Group(); pivot.position.set(sx * ((front ? hx.f : hx.r) - geo.w / 2), R, front ? EXT.meta.axleF : EXT.meta.axleR); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(geo.tyre, M.wheelMats.tyre), new THREE.Mesh(geo.rim, M.wheelMats.rim));
    const face = new THREE.Mesh(geo.face, M.wheelMats.face); face.position.x = sx * (geo.w / 2 - 0.004); face.rotation.y = sx * Math.PI / 2; spin.add(face);
    const inner = new THREE.Mesh(geo.face, M.wheelMats.face); inner.position.x = -sx * (geo.w / 2 - 0.004); inner.rotation.y = -sx * Math.PI / 2; spin.add(inner);
    for (const s2 of [1, -1]) { const st = new THREE.Mesh(geo.stripe, M.wheelMats[compound]); st.position.x = s2 * (geo.w / 2 + 0.002); spin.add(st); stripes.push(st); }
    wheels.push({ pivot, spin, front });
  }
  const steering = new THREE.Group(); steering.position.set(0, 0.62, 0.55); steering.rotation.x = -0.55; g.add(steering);
  steering.add(new THREE.Mesh(SW, DARK));
  for (const sx of [1, -1]) { const gr = new THREE.Mesh(SW_GRIP, CARBON); gr.position.set(sx * 0.15, -0.01, 0); steering.add(gr); }
  const scr = new THREE.Mesh(SW_SCREEN, SCREEN_MAT); scr.position.set(0, 0.015, -0.026); scr.rotation.y = Math.PI; steering.add(scr);
  steering.visible = false;
  const numTex = new THREE.Texture();
  return { group: g, wheels, helmet: new THREE.Group(), steering, cockpitHide: [], mats, numTex, stripes, fwing, rwing };
}
const HALO_MAT = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.35, metalness: 0.6 });
const EXT_HALO = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.33, 0.79, 0.13], [0.335, 0.88, 0.3], [0.27, 0.935, 0.6], [0, 0.95, 0.8], [-0.27, 0.935, 0.6], [-0.335, 0.88, 0.3], [-0.33, 0.79, 0.13]].map(p => new THREE.Vector3(...p))), 64, 0.03, 12);
const EXT_PILLAR = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.95, 0.8), new THREE.Vector3(0, 0.9, 0.9), new THREE.Vector3(0, 0.79, 1.02)]), 16, 0.034, 12);
const EXT_FOOT = new THREE.CylinderGeometry(0.035, 0.05, 0.08, 12);
let EXT_WHEELS = null;
function extWheels(R) {
  if (EXT_WHEELS) return EXT_WHEELS;
  // low-profile 18" tyre: rounded shoulders, flat tread, rim + wheel cover
  const prof = (w, rim) => [[rim, -w / 2], [R - 0.045, -w / 2 - 0.004], [R - 0.012, -w / 2 + 0.022], [R, -w / 2 + 0.055], [R, w / 2 - 0.055], [R - 0.012, w / 2 - 0.022], [R - 0.045, w / 2 + 0.004], [rim, w / 2]].map(p => new THREE.Vector2(p[0], p[1]));
  const mk = w => ({
    tyre: new THREE.LatheGeometry(prof(w, 0.24), 48).rotateZ(Math.PI / 2),
    rim: new THREE.CylinderGeometry(0.245, 0.245, w - 0.01, 32, 1, true).rotateZ(Math.PI / 2),
    face: new THREE.CircleGeometry(0.245, 32),
    stripe: new THREE.TorusGeometry(R - 0.06, 0.008, 4, 48).rotateY(Math.PI / 2),
    w,
  });
  return (EXT_WHEELS = { front: mk(0.32), rear: mk(0.4) });
}

export function setCompound(c, comp) { const m = MODEL.wheelMats[comp] || MODEL.wheelMats.medium; c.stripes.forEach(s => s.material = m); }
export function disposeCar(c) { c.mats.body.dispose(); c.mats.acc.dispose(); c.numTex.dispose(); }

/* Safety car: a low grand-tourer with a light bar */
/* IndyCar: the aeroscreen, a tinted wraparound screen round the front of the cockpit on a titanium frame */
const SCREEN_GLASS = new THREE.MeshPhysicalMaterial({ color: 0x8fa6b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
const AERO_GEO = new THREE.CylinderGeometry(0.36, 0.44, 0.3, 28, 1, true, -Math.PI * 0.56, Math.PI * 1.12);
const AERO_RIM = new THREE.TorusGeometry(0.36, 0.008, 6, 28, Math.PI * 1.12).rotateX(Math.PI / 2).rotateY(Math.PI * 0.5 - Math.PI * 0.56 + Math.PI);
function addAeroscreen(g) {
  const sc = new THREE.Mesh(AERO_GEO, SCREEN_GLASS); sc.position.set(0, 0.93, 0.32); sc.renderOrder = 2; g.add(sc);
  const rim = new THREE.Mesh(AERO_RIM, HALO_MAT); rim.position.set(0, 1.08, 0.32); g.add(rim);
}

/* ---- closed cars: GT3 (front-engined coupé) and Le Mans Hypercar (prototype) ----
   Lofted bodies [z, halfWidth, halfHeight, centreY, roundness], the same wheels as the single-seater,
   and the same parts list (wheels, wings, steering, numbers) so the rest of the game treats them alike. */
const CLOSED = {
  gt3: {
    body: [[-2.3, 0.82, 0.25, 0.67, 4], [-2.18, 0.95, 0.3, 0.66, 6], [-1.75, 0.97, 0.31, 0.66, 8], [-1.0, 0.94, 0.3, 0.66, 8], [0.0, 0.92, 0.29, 0.65, 8],
      [0.9, 0.93, 0.27, 0.62, 8], [1.45, 0.95, 0.24, 0.58, 7], [1.95, 0.93, 0.19, 0.53, 6], [2.25, 0.86, 0.13, 0.47, 4], [2.37, 0.74, 0.08, 0.43, 3]],
    glass: [[-1.25, 0.55, 0.1, 0.95, 3], [-0.85, 0.66, 0.3, 0.98, 3.5], [0.15, 0.68, 0.32, 0.98, 3.5], [0.65, 0.62, 0.22, 0.95, 3], [0.98, 0.5, 0.05, 0.94, 2.5]],
    roof: [[-0.95, 0.6, 0.035, 1.272, 4], [0.1, 0.62, 0.035, 1.284, 4], [0.45, 0.58, 0.03, 1.262, 4]],
    axF: 1.42, axR: -1.38, track: 0.8, helmet: [0.3, 1.0, -0.25], wing: { y: 1.32, z: -2.02, w: 1.86 }, num: [0.995, 0.64, -0.15],
  },
  hyper: {
    body: [[-2.58, 0.88, 0.15, 0.56, 5], [-2.3, 0.98, 0.21, 0.56, 7], [-1.75, 0.98, 0.23, 0.56, 8], [-1.0, 0.9, 0.2, 0.52, 8], [0, 0.86, 0.19, 0.5, 8],
      [0.9, 0.88, 0.18, 0.49, 8], [1.55, 0.9, 0.17, 0.47, 7], [2.1, 0.86, 0.13, 0.43, 6], [2.45, 0.8, 0.09, 0.38, 4], [2.62, 0.68, 0.05, 0.34, 3]],
    pods: true,
    glass: [[-1.05, 0.35, 0.05, 0.86, 3], [-0.7, 0.46, 0.22, 0.9, 3], [0.25, 0.48, 0.24, 0.9, 3], [0.75, 0.4, 0.14, 0.86, 3], [1.15, 0.24, 0.03, 0.82, 2.5]],
    roof: [[-0.75, 0.3, 0.03, 1.118, 4], [0.2, 0.32, 0.03, 1.135, 4]],
    axF: 1.5, axR: -1.5, track: 0.82, helmet: [0, 0.95, -0.15], wing: { y: 1.05, z: -2.42, w: 1.95 }, num: [0.97, 0.62, -1.1], fin: true,
  },
};
const CLOSED_GEO = {};
const GLASS_MAT = new THREE.MeshPhysicalMaterial({ color: 0x0b0f16, roughness: 0.06, metalness: 0.4, clearcoat: 1 });
const HEAD_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 2.2 });
const TAIL_MAT = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a1a, emissiveIntensity: 2.4 });
const PLATE_MAT = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 });
const MIRROR_MAT = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 1 });
function closedGeo(kind) {
  if (CLOSED_GEO[kind]) return CLOSED_GEO[kind];
  const C = CLOSED[kind], box = (w, h, d, x, y, z, ry = 0, rx = 0) => new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).translate(x, y, z);
  const W = C.wing, gw = {
    body: loft(C.body, 40), glass: loft(C.glass, 28), roof: loft(C.roof, 28),
    wing: mergeGeometries([box(W.w, 0.035, 0.34, 0, W.y, W.z, 0, -0.12), box(0.025, 0.24, 0.5, W.w / 2, W.y - 0.05, W.z + 0.02), box(0.025, 0.24, 0.5, -W.w / 2, W.y - 0.05, W.z + 0.02),
      box(0.04, W.y - 0.82, 0.1, 0.42, (W.y + 0.82) / 2, W.z + 0.08), box(0.04, W.y - 0.82, 0.1, -0.42, (W.y + 0.82) / 2, W.z + 0.08)]),
    splitter: box(1.7, 0.025, 0.2, 0, 0.2, C.body[C.body.length - 1][0] - 0.22),
    sill: mergeGeometries([box(0.05, 0.12, 2.1, 0.975, 0.42, 0.05), box(0.05, 0.12, 2.1, -0.975, 0.42, 0.05)]),
    heads: kind === 'gt3' ? mergeGeometries([box(0.36, 0.07, 0.06, 0.6, 0.66, 2.2, 0.35), box(0.36, 0.07, 0.06, -0.6, 0.66, 2.2, -0.35)])
      : mergeGeometries([box(0.05, 0.04, 0.5, 0.74, 0.74, 2.12, 0.55), box(0.05, 0.04, 0.5, -0.74, 0.74, 2.12, -0.55), box(0.05, 0.04, 0.3, 0.6, 0.7, 2.3, 1.1), box(0.05, 0.04, 0.3, -0.6, 0.7, 2.3, -1.1)]),
    tails: kind === 'gt3' ? mergeGeometries([box(0.5, 0.06, 0.04, 0.55, 0.86, -2.27), box(0.5, 0.06, 0.04, -0.55, 0.86, -2.27)]) : box(1.72, 0.035, 0.03, 0, 0.84, -2.56),
    fin: C.fin ? box(0.03, 0.32, 1.55, 0, 0.98, -1.55) : null,
  };
  const f = C.body[C.body.length - 1][0], r = C.body[0][0], cyl = (rt, rb, h, x, y, z) => new THREE.CylinderGeometry(rt, rb, h, 14).rotateX(Math.PI / 2).translate(x, y, z);
  // flared wheel arches (GT3) or tall fender pods running the length of the car (Hypercar)
  const arch = (z, sx) => loft([[z - 0.62, 0.05, 0.05, 0.6, 3, sx * 0.86], [z - 0.45, 0.17, 0.22, 0.64, 4, sx * 0.88], [z, 0.2, 0.31, 0.62, 5, sx * 0.88], [z + 0.45, 0.17, 0.22, 0.62, 4, sx * 0.88], [z + 0.62, 0.05, 0.05, 0.58, 3, sx * 0.86]], 20);
  const pod = sx => loft([[-2.45, 0.08, 0.08, 0.6, 3, sx * 0.76], [-1.95, 0.22, 0.3, 0.6, 5, sx * 0.76], [-1.2, 0.22, 0.27, 0.58, 5, sx * 0.76], [-0.5, 0.18, 0.17, 0.54, 5, sx * 0.78],
    [0.5, 0.18, 0.17, 0.53, 5, sx * 0.78], [1.15, 0.22, 0.3, 0.58, 5, sx * 0.76], [1.95, 0.21, 0.27, 0.56, 5, sx * 0.75], [2.45, 0.1, 0.1, 0.48, 3, sx * 0.72]], 22);
  gw.flares = mergeGeometries(C.pods ? [pod(1), pod(-1)] : [arch(C.axF, 1), arch(C.axF, -1), arch(C.axR, 1), arch(C.axR, -1)]);
  gw.dark = mergeGeometries([
    box(kind === 'gt3' ? 1.0 : 0.7, 0.13, 0.06, 0, 0.36, f - 0.02),                                   // front grille / intake
    box(0.36, 0.09, 0.05, 0.62, 0.34, f - 0.06), box(0.36, 0.09, 0.05, -0.62, 0.34, f - 0.06),        // brake ducts
    box(0.32, 0.015, 0.36, 0.33, kind === 'gt3' ? 0.86 : 0.67, 1.3, 0, -0.18), box(0.32, 0.015, 0.36, -0.33, kind === 'gt3' ? 0.86 : 0.67, 1.3, 0, -0.18), // bonnet vents
    box(1.5, 0.12, 0.34, 0, 0.27, r + 0.12),                                                           // diffuser
    ...[-0.5, -0.17, 0.17, 0.5].map(x => box(0.02, 0.16, 0.36, x, 0.3, r + 0.14)),
    box(0.06, 0.2, 0.7, 0.955, 0.6, -0.95), box(0.06, 0.2, 0.7, -0.955, 0.6, -0.95),                  // side intakes
    ...(kind === 'hyper' ? [box(0.22, 0.14, 0.4, 0, 1.18, -0.75)] : []),                               // roof snorkel
  ]);
  const mz = kind === 'gt3' ? 0.72 : 0.95, mx = kind === 'gt3' ? 0.86 : 0.76, my = kind === 'gt3' ? 1.04 : 0.84;
  gw.mirrors = mergeGeometries([box(0.16, 0.09, 0.06, mx + 0.08, my, mz), box(0.16, 0.09, 0.06, -mx - 0.08, my, mz), box(0.12, 0.025, 0.04, mx, my - 0.04, mz + 0.02), box(0.12, 0.025, 0.04, -mx, my - 0.04, mz + 0.02)]);
  gw.mirrorGlass = mergeGeometries([new THREE.PlaneGeometry(0.13, 0.065).rotateY(Math.PI).translate(mx + 0.08, my, mz - 0.032), new THREE.PlaneGeometry(0.13, 0.065).rotateY(Math.PI).translate(-mx - 0.08, my, mz - 0.032)]);
  gw.exhaust = kind === 'gt3' ? mergeGeometries([cyl(0.045, 0.045, 0.2, 0.42, 0.34, r + 0.04), cyl(0.045, 0.045, 0.2, -0.42, 0.34, r + 0.04)]) : cyl(0.05, 0.05, 0.2, 0, 0.62, r + 0.1);
  return (CLOSED_GEO[kind] = gw);
}
function makeClosedCar(kind, { color, accent, helmet, number, compound }) {
  const C = CLOSED[kind], G = closedGeo(kind), M = MODEL, g = new THREE.Group();
  const mats = {
    body: new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }),
    acc: new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.4, metalness: 0.1, clearcoat: 0.8 }),
    carbon: CARBON, dark: DARK, metal: METAL, light: LIGHT,
  };
  const shadow = new THREE.Mesh(SHADOW, SHADOW_MAT); shadow.position.y = 0.025; shadow.scale.set(1, 1, 0.9); shadow.renderOrder = 1; g.add(shadow);
  const fwing = new THREE.Group(), rwing = new THREE.Group(); g.add(fwing, rwing);
  g.add(new THREE.Mesh(G.body, mats.body), new THREE.Mesh(G.glass, GLASS_MAT), new THREE.Mesh(G.roof, mats.body), new THREE.Mesh(G.sill, mats.acc),
    new THREE.Mesh(G.heads, HEAD_MAT), new THREE.Mesh(G.tails, TAIL_MAT));
  if (G.fin) g.add(new THREE.Mesh(G.fin, mats.body));
  g.add(new THREE.Mesh(G.flares, mats.body), new THREE.Mesh(G.dark, DARK), new THREE.Mesh(G.mirrors, mats.body), new THREE.Mesh(G.mirrorGlass, MIRROR_MAT), new THREE.Mesh(G.exhaust, METAL));
  fwing.add(new THREE.Mesh(G.splitter, CARBON)); rwing.add(new THREE.Mesh(G.wing, kind === 'gt3' ? CARBON : mats.acc));
  // door numbers on white roundels
  const tex = numberTex(number, '#111111', 'rgba(255,255,255,0)');
  const nmat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  for (const sx of [1, -1]) {
    const pl = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), PLATE_MAT); pl.position.set(sx * C.num[0], C.num[1], C.num[2]); pl.rotation.y = sx * Math.PI / 2; g.add(pl);
    const n = new THREE.Mesh(NUM_FIN, nmat); n.scale.setScalar(0.9); n.position.set(sx * (C.num[0] + 0.004), C.num[1], C.num[2]); n.rotation.y = sx * Math.PI / 2; g.add(n);
  }
  const helmetMesh = new THREE.Group(); helmetMesh.position.set(...C.helmet);
  helmetMesh.add(new THREE.Mesh(HELMET, new THREE.MeshPhysicalMaterial({ color: helmet, roughness: 0.2, metalness: 0.3, clearcoat: 1 })), new THREE.Mesh(VISOR, VISOR_MAT));
  g.add(helmetMesh);
  const wheels = [], stripes = [];
  for (const [front, sx] of [[true, 1], [true, -1], [false, 1], [false, -1]]) {
    const Wg = front ? M.front : M.rear;
    const pivot = new THREE.Group(); pivot.position.set(sx * (C.track + 0.04), 0.36, front ? C.axF : C.axR); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(Wg.tyre, M.wheelMats.tyre), new THREE.Mesh(Wg.rim, M.wheelMats.rim));
    const face = new THREE.Mesh(Wg.face, M.wheelMats.face); face.position.x = sx * (Wg.w / 2 - 0.004); face.rotation.y = sx * Math.PI / 2; spin.add(face);
    for (const s2 of [1, -1]) { const st = new THREE.Mesh(Wg.stripe, M.wheelMats[compound]); st.position.x = s2 * (Wg.w / 2 + 0.002); spin.add(st); stripes.push(st); }
    wheels.push({ pivot, spin, front });
  }
  const steering = new THREE.Group(); steering.position.set(C.helmet[0], 0.8, C.helmet[2] + 0.45); steering.rotation.x = -0.9; g.add(steering);
  steering.add(new THREE.Mesh(SW, DARK)); steering.visible = false;
  return { group: g, wheels, helmet: helmetMesh, steering, cockpitHide: [helmetMesh], mats, numTex: tex, stripes, fwing, rwing, closed: kind };
}

/* ---- cockpit: a detailed steering wheel (formula-style or round), gloves on the grips, a live screen
   showing gear and speed, and a row of shift lights. Only the player's is shown, in the cockpit camera. */
const RUBBER = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.95 });
const LED_OFF = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4 });
const KNOB_COLS = [0xe11d48, 0xf5c400, 0x2563eb, 0xf4f4f4];
function buildWheel(round, glove) {
  const w = new THREE.Group(), leds = [];
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(round ? 0.1 : 0.12, round ? 0.05 : 0.06), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.85 }), cuffMat = new THREE.MeshStandardMaterial({ color: glove, roughness: 0.7 });
  const cuff = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12).rotateX(Math.PI / 2);
  const gl = new RoundedBoxGeometry(0.075, 0.11, 0.085, 3, 0.03), thumb = new RoundedBoxGeometry(0.03, 0.05, 0.03, 2, 0.012);
  if (!round) {
    w.add(new THREE.Mesh(new RoundedBoxGeometry(0.29, 0.15, 0.035, 3, 0.02), CARBON));
    for (const sx of [1, -1]) {
      const grip = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.19, 0.07, 3, 0.03), RUBBER); grip.position.set(sx * 0.16, -0.012, -0.01); w.add(grip);
      const hand = new THREE.Mesh(gl, gloveMat); hand.position.set(sx * 0.165, 0.0, -0.035); w.add(hand);
      const cf = new THREE.Mesh(cuff, cuffMat); cf.position.set(sx * 0.17, -0.02, 0.025); w.add(cf);
      const th = new THREE.Mesh(thumb, gloveMat); th.position.set(sx * 0.125, 0.035, -0.04); w.add(th);
      for (const [k, y] of [[0, -0.045], [1, 0.01]]) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: KNOB_COLS[(k + (sx > 0 ? 2 : 0)) % 4], roughness: 0.4 })); kn.position.set(sx * 0.085, y, -0.022); w.add(kn); }
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.006), CARBON); paddle.position.set(sx * 0.11, 0.02, 0.03); w.add(paddle);
    }
    for (const [x, y, c] of [[-0.035, -0.055, 0x22c55e], [0, -0.058, 0xf4f4f4], [0.035, -0.055, 0xe11d48]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); b.position.set(x, y, -0.02); w.add(b); }
    scr.position.set(0, 0.012, -0.0185);
    for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.006), LED_OFF); m.position.set(-0.081 + k * 0.018, 0.062, -0.02); w.add(m); leds.push(m); }
  } else {
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.021, 10, 40), RUBBER));
    w.add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.11, 0.035, 3, 0.02), CARBON));
    for (const a of [Math.PI, 0, -Math.PI / 2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.02), CARBON); sp.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.1, 0); sp.rotation.z = a; w.add(sp); }
    for (const sx of [1, -1]) {
      const hand = new THREE.Mesh(gl, gloveMat); hand.position.set(sx * 0.17, 0.02, -0.025); hand.rotation.z = sx * 0.3; w.add(hand);
      const cf = new THREE.Mesh(cuff, cuffMat); cf.position.set(sx * 0.18, 0.0, 0.03); w.add(cf);
      for (const [k, y] of [[0, -0.03], [1, 0.02]]) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: KNOB_COLS[(k + (sx > 0 ? 1 : 3)) % 4], roughness: 0.4 })); kn.position.set(sx * 0.072, y, -0.022); w.add(kn); }
    }
    scr.position.set(0, 0.008, -0.0185);
    for (let k = 0; k < 10; k++) { const a = Math.PI * (0.78 - k * 0.0622), m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.007, 0.006), LED_OFF); m.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14 - 0.05, -0.018); m.rotation.z = a - Math.PI / 2; w.add(m); leds.push(m); }
  }
  scr.rotation.y = Math.PI; w.add(scr);
  return { group: w, leds, tex, ctx: cv.getContext('2d') };
}
const LED_ON = [0x22c55e, 0x22c55e, 0x22c55e, 0x22c55e, 0xef4444, 0xef4444, 0xef4444, 0x3b82f6, 0x3b82f6, 0x3b82f6].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.5, toneMapped: false }));
/* live wheel screen and shift lights (player only, a few times a second) */
export function updateDash(car, { gear, kmh, rpm, frac, lap, pos, delta }) {
  const d = car.dash; if (!d) return;
  const lit = Math.round(Math.min(1, Math.max(0, frac)) * 10), flash = frac > 0.97 && (performance.now() / 90 | 0) % 2;
  d.leds.forEach((m, k) => { m.material = flash ? LED_ON[9] : k < lit ? LED_ON[k] : LED_OFF; });
  const g = d.ctx; g.fillStyle = '#05070a'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffcc00'; g.font = '800 92px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(gear, 128, 66);
  g.font = '700 30px "Barlow Condensed", Arial'; g.fillStyle = '#e5e7eb'; g.textAlign = 'left'; g.fillText(String(kmh), 12, 28); g.textAlign = 'right'; g.fillText(pos || '', 244, 28);
  g.fillStyle = delta && delta[0] === '-' ? '#22c55e' : '#e5e7eb'; g.font = '700 26px "Barlow Condensed", Arial'; g.textAlign = 'left'; g.fillText(lap || '', 12, 104); g.textAlign = 'right'; g.fillText(delta || '', 244, 104);
  d.tex.needsUpdate = true;
}
/* replace a car's simple wheel with the detailed one, placed for its cockpit */
function fitCockpit(car, kind, glove) {
  const W = buildWheel(kind === 'gt3' || kind === 'hyper', glove);
  const P = { f1: { wheel: [0, 0.8, 0.4, -0.5], eye: [0, 1.06, 0.0] }, gt3: { wheel: [0.32, 0.95, 0.24, -0.3], eye: [0.32, 1.07, -0.18], scale: 0.8 }, hyper: { wheel: [0, 0.78, 0.36, -0.34], eye: [0, 0.98, 0.02], scale: 0.72 } }[kind === 'indy' ? 'f1' : kind] || { wheel: [0, 0.8, 0.4, -0.5], eye: [0, 1.06, 0.0] };
  const st = car.steering; st.clear(); st.position.set(P.wheel[0], P.wheel[1], P.wheel[2]); st.rotation.set(P.wheel[3], 0, 0); st.add(W.group); if (P.scale) W.group.scale.setScalar(P.scale); st.visible = false;
  car.dash = W; car.eye = P.eye;
  // T-cam mount: above the airbox on single-seaters; at the front of the roof, over the windscreen, on closed cars
  car.tcam = { gt3: [0, 1.5, 0.5, 1.05], hyper: [0, 1.32, 0.78, 0.92] }[kind] || [0, 1.36, -0.5, 0.8];
  return car;
}
/* closed cars: dashboard, A-pillars, roof header, rear-view mirror, so the cockpit view looks out of a cabin */
function addInterior(g, kind) {
  const dashM = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 }), I = new THREE.Group();
  const pillar = (a, b, r) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 8), dashM); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); I.add(m); };
  if (kind === 'gt3') {
    const dash = new THREE.Mesh(new RoundedBoxGeometry(1.32, 0.16, 0.42, 3, 0.04), dashM); dash.position.set(0, 0.92, 0.66); I.add(dash);
    const hood = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.07, 0.2, 2, 0.03), dashM); hood.position.set(0.32, 1.02, 0.5); I.add(hood);
    pillar([0.64, 0.98, 0.93], [0.6, 1.27, 0.44], 0.035); pillar([-0.64, 0.98, 0.93], [-0.6, 1.27, 0.44], 0.035);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.12), dashM); head.position.set(0, 1.255, 0.42); I.add(head);
    const rvm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.02), dashM); rvm.position.set(0, 1.19, 0.4); I.add(rvm);
    const rvg = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.05), MIRROR_MAT); rvg.position.set(0, 1.19, 0.388); rvg.rotation.y = Math.PI; I.add(rvg);
    const liner = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.2), dashM); liner.position.set(0, 1.245, -0.4); I.add(liner);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.3), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.4, metalness: 0.7 })); cage.position.set(0.58, 1.22, -0.3); I.add(cage);
  } else {
    const dash = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.12, 0.34, 3, 0.04), dashM); dash.position.set(0, 0.82, 0.72); I.add(dash);
    pillar([0.42, 0.84, 1.05], [0.4, 1.09, 0.52], 0.03); pillar([-0.42, 0.84, 1.05], [-0.4, 1.09, 0.52], 0.03);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.04, 0.1), dashM); head.position.set(0, 1.09, 0.5); I.add(head);
    const liner = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.02, 0.9), dashM); liner.position.set(0, 1.105, -0.45); I.add(liner);
  }
  g.add(I); return I;
}

/* ---- working mirrors (player only): they show a live rear-view picture the game renders a few times a
   second. Single-seaters: two side mirrors; GT3: rear-view mirror plus door mirrors; Hypercar: a rear-camera
   screen on the dash, as the real cars have. uv halves: the left mirror shows the left side and so on. */
export function addLiveMirrors(car, tex) {
  const g = car.group, kind = car.closed || 'open', mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
  const plane = (w, h, u0, u1, x, y, z, ry = Math.PI, rx = 0) => {
    const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); g.add(m); return m;
  };
  const housing = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.015), car.mats.body); m.position.set(x, y, z); g.add(m); };
  if (kind === 'open') {
    for (const sx of [1, -1]) {
      housing(0.27, 0.11, 0.05, sx * 0.48, 0.93, 0.72);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), CARBON); st.position.set(sx * 0.45, 0.83, 0.72); st.rotation.z = sx * 0.3; g.add(st);
      plane(0.25, 0.09, sx > 0 ? 0 : 0.5, sx > 0 ? 0.5 : 1, sx * 0.48, 0.93, 0.692, Math.PI - sx * 0.3);
    }
  } else if (kind === 'gt3') {
    plane(0.22, 0.05, 0.2, 0.8, 0, 1.19, 0.387);
    plane(0.13, 0.065, 0, 0.45, 0.94, 1.04, 0.687, Math.PI - 0.25); plane(0.13, 0.065, 0.55, 1, -0.94, 1.04, 0.687, Math.PI + 0.25);
  } else {
    const scr = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.1, 0.03, 2, 0.01), DARK); scr.position.set(0, 0.935, 0.66); scr.rotation.x = -0.25; g.add(scr);
    plane(0.28, 0.085, 0, 1, 0, 0.937, 0.644, Math.PI, 0.25);
  }
}

export function makeSafetyCar() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#c9ced6', roughness: 0.25, metalness: 0.7, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0d1117', roughness: 0.05, metalness: 0.5, clearcoat: 1 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.5 });
  g.add(new THREE.Mesh(loft([[-2.3, 0.85, 0.3, 0.55, 4], [-1.6, 0.97, 0.36, 0.6, 4], [0.4, 0.97, 0.36, 0.6, 4], [1.8, 0.92, 0.3, 0.52, 4], [2.3, 0.8, 0.2, 0.45, 3]], 32), paint));
  g.add(new THREE.Mesh(loft([[-1.3, 0.62, 0.05, 0.95, 3], [-0.9, 0.68, 0.24, 1.08, 3], [0.2, 0.68, 0.26, 1.08, 3], [0.8, 0.6, 0.06, 0.95, 3]], 24), glass));
  const bar = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.1, 0.25, 2, 0.04), new THREE.MeshStandardMaterial({ color: '#111' })); bar.position.set(0, 1.38, -0.3); g.add(bar);
  const lamps = [];
  for (const sx of [-0.32, -0.12, 0.12, 0.32]) { const m = new THREE.MeshBasicMaterial({ color: '#ffb000', toneMapped: false }); const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), m); l.position.set(sx, 1.44, -0.3); g.add(l); lamps.push(m); }
  for (const sx of [1, -1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 3.8), stripe); s.position.set(sx * 0.975, 0.6, 0); g.add(s); }
  const tyreG = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 20).rotateZ(Math.PI / 2), tm = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 });
  for (const [x, z] of [[0.85, 1.45], [-0.85, 1.45], [0.85, -1.4], [-0.85, -1.4]]) { const w = new THREE.Mesh(tyreG, tm); w.position.set(x, 0.34, z); g.add(w); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.2).rotateX(-Math.PI / 2), SHADOW_MAT); sh.position.y = 0.025; g.add(sh);
  return { group: g, lamps };
}

const CARBON = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.45, metalness: 0.35 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.8 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.3, metalness: 0.9 });
const LIGHT = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1010, emissiveIntensity: 3 });
const VISOR_MAT = new THREE.MeshPhysicalMaterial({ color: 0x0a0a12, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
const SCREEN_MAT = new THREE.MeshBasicMaterial({ color: 0x33ff99, toneMapped: false });
const HELMET = new THREE.SphereGeometry(0.145, 20, 14);
const VISOR = new THREE.SphereGeometry(0.148, 20, 8, -Math.PI * 0.32 + Math.PI / 2, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.2);
const NUM_FIN = new THREE.PlaneGeometry(0.36, 0.18);
const NUM_NOSE = new THREE.PlaneGeometry(0.22, 0.11);
const SW = new RoundedBoxGeometry(0.27, 0.13, 0.04, 2, 0.02);
const SW_GRIP = new RoundedBoxGeometry(0.06, 0.16, 0.06, 2, 0.025);
const SW_SCREEN = new THREE.PlaneGeometry(0.1, 0.05);
const SHADOW = new THREE.PlaneGeometry(2.4, 6.0).rotateX(-Math.PI / 2);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(64, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, h / 2); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.7, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { repeat: false }) });
