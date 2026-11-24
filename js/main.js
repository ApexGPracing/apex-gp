import * as THREE from 'three';
import { W, KERB, kerbHeight, DS, AI_GRIP, TRACKS, getTrack, previewPoints, locate, bankH, elevAt, pitRoad, mergeWallAt, speedProfiles } from './tracks.js?v=conc27c';
import { World } from './world.js?v=conc27c';
import { addLodProxy, setCarLod, mergeCarStatic, makeCar, disposeCar, setCompound, makeSafetyCar, loadCarModel, updateDash, addLiveMirrors, AXLE_F, AXLE_R } from './car.js?v=conc27c';
import { Sound } from './audio.js?v=conc27c';
import { Particles, Skids, Fireworks } from './fx.js?v=conc27c';
import { Weather } from './weather.js?v=conc27c';
import { SUPABASE_URL, SUPABASE_ANON_KEY, METERED_APP, METERED_KEY } from './config.js?v=conc27c';
import { SERIES, CLASSES, SERIES_ORDER } from './series.js?v=conc27c';
import { Net, newCode, loadTurn } from './net.js?v=conc27c';
import { VIP_CODES } from './codes.js?v=conc27c';
import { clamp, angDiff, rng, fmt, store, setMaxAniso, smooth } from './util.js?v=conc27c';
import { OC_ON, oc, ocMe, agreedSlot, ocStandings, ocRoomCode } from './champs.js?v=conc27c';

const $ = id => document.getElementById(id);
const VMAX = 100;

/* ---------------- Teams, drivers, tyres ---------------- */
// the 2026 grid: 11 teams, 2 drivers each (DRIVERS lists them in team order)
let TEAMS = [
  { name: 'McLaren', color: '#ff8000', accent: '#111111', liv: { p: 'twotone', c2: '#111111', c3: '#1fb4ff' } },
  { name: 'Ferrari', color: '#dc0000', accent: '#fff200', liv: { p: 'sash', c2: '#f4f4f4', c3: '#111111' } },
  { name: 'Red Bull Racing', color: '#1e2a5a', accent: '#e10600', liv: { p: 'arrow', c2: '#e10600', c3: '#ffcc00' } },
  { name: 'Mercedes', color: '#c8ccd0', accent: '#00a19c', liv: { p: 'fade', c2: '#111111', c3: '#00d2be' } },
  { name: 'Aston Martin', color: '#006f62', accent: '#cedc00', liv: { p: 'stripes', c2: '#cedc00', c3: '#0a2b26' } },
  { name: 'Alpine', color: '#0078c1', accent: '#ff87bc', liv: { p: 'fade', c2: '#ff87bc', c3: '#ffffff' } },
  { name: 'Williams', color: '#1868db', accent: '#ffffff', liv: { p: 'halves', c2: '#0a1e3d', c3: '#64c4ff' } },
  { name: 'Racing Bulls', color: '#f4f4f4', accent: '#1634cb', liv: { p: 'sash', c2: '#1634cb', c3: '#e10600' } },
  { name: 'Audi', color: '#5b5f63', accent: '#ff2d1a', liv: { p: 'nose', c2: '#ff2d1a', c3: '#111111' } },
  { name: 'Haas', color: '#f2f2f2', accent: '#e10600', liv: { p: 'twotone', c2: '#2a2a2a', c3: '#e10600' } },
  { name: 'Cadillac', color: '#111111', accent: '#e5e5e5', liv: { p: 'gulf', c2: '#e5e5e5', c3: '#b08d57' } },
];
let DRIVERS = [
  ['Lando Norris', 'NOR'], ['Oscar Piastri', 'PIA'],
  ['Charles Leclerc', 'LEC'], ['Lewis Hamilton', 'HAM'],
  ['Max Verstappen', 'VER'], ['Isack Hadjar', 'HAD'],
  ['George Russell', 'RUS'], ['Kimi Antonelli', 'ANT'],
  ['Fernando Alonso', 'ALO'], ['Lance Stroll', 'STR'],
  ['Pierre Gasly', 'GAS'], ['Franco Colapinto', 'COL'],
  ['Alex Albon', 'ALB'], ['Carlos Sainz', 'SAI'],
  ['Liam Lawson', 'LAW'], ['Arvid Lindblad', 'LIN'],
  ['Nico Hulkenberg', 'HUL'], ['Gabriel Bortoleto', 'BOR'],
  ['Esteban Ocon', 'OCO'], ['Oliver Bearman', 'BEA'],
  ['Sergio Perez', 'PER'], ['Valtteri Bottas', 'BOT'],
];
/* driver personalities: skill (pace), agg (how hard they attack and how late they brake when passing),
   def (how hard they defend), cons (consistency: fewer mistakes), tyre (wear rate: lower = kinder to tyres) */
const PERSONA = {
  NOR: [0.93, 0.7, 0.6, 0.85, 1.0], PIA: [0.92, 0.6, 0.7, 0.92, 0.95], LEC: [0.93, 0.75, 0.7, 0.8, 1.05], HAM: [0.92, 0.65, 0.8, 0.9, 0.9],
  VER: [0.98, 0.95, 0.95, 0.95, 0.95], HAD: [0.84, 0.75, 0.6, 0.75, 1.05], RUS: [0.91, 0.75, 0.75, 0.88, 1.0], ANT: [0.85, 0.8, 0.55, 0.72, 1.05],
  ALO: [0.9, 0.8, 0.95, 0.93, 0.85], STR: [0.78, 0.55, 0.55, 0.75, 1.0], GAS: [0.84, 0.65, 0.7, 0.85, 1.0], COL: [0.78, 0.8, 0.5, 0.68, 1.05],
  ALB: [0.85, 0.6, 0.75, 0.88, 0.95], SAI: [0.88, 0.65, 0.85, 0.9, 0.9], LAW: [0.8, 0.8, 0.7, 0.75, 1.05], LIN: [0.78, 0.75, 0.5, 0.7, 1.05],
  HUL: [0.83, 0.6, 0.8, 0.9, 0.95], BOR: [0.8, 0.65, 0.6, 0.78, 1.0], OCO: [0.82, 0.7, 0.9, 0.85, 0.95], BEA: [0.81, 0.8, 0.6, 0.75, 1.0],
  PER: [0.84, 0.6, 0.75, 0.82, 0.85], BOT: [0.83, 0.5, 0.7, 0.88, 0.95],
};
let SERIES_PERSONA = {};
const personaOf = code => { const a = PERSONA[code] || SERIES_PERSONA[code] || [0.85, 0.7, 0.7, 0.85, 1]; return { skill: a[0], agg: a[1], def: a[2], cons: a[3], tyre: a[4] }; };
let CAR_NUMS = [4, 81, 16, 44, 3, 6, 63, 12, 14, 18, 10, 43, 23, 55, 30, 41, 27, 5, 31, 87, 11, 77];
let TEAM_MAP = DRIVERS.map((_, i) => Math.floor(i / 2));
const teamIdxOf = di => TEAM_MAP[di];
/* fixed line-ups: each driver always drives for their own team */
let FIXED_TEAMS = DRIVERS.map((_, i) => Math.floor(i / 2));
function shuffleTeams() { return FIXED_TEAMS.slice(); }
/* ---------------- Racing series ---------------- */
const F1_GRID = { teams: TEAMS, drivers: DRIVERS, nums: CAR_NUMS };
let SER = SERIES.f1;
const realCal = () => SER.calendar.map(id => TRACKS.findIndex(t => t.id === id)).filter(i => i >= 0);
const idsToIdx = ids => (ids || []).map(id => TRACKS.findIndex(t => t.id === id)).filter(i => i >= 0);
/* the calendar in play: a custom season's own list, otherwise the series' real one */
const calIdx = () => { const s = settings.mode === 'champ' && loadSeason(); return s && s.cal && !s.finished ? idsToIdx(s.cal) : realCal(); };
/* building a custom season in the menu (championship mode, custom picked, no season running) */
const buildingCustom = () => { if (settings.mode !== 'champ' || settings.champType !== 'custom') return false; const s = loadSeason(); return !s || s.finished; };
/* a season's own rules (custom seasons store quali / weather / damage), otherwise the menu settings */
const rule = k => (settings.mode === 'champ' && game.season && game.season[k] !== undefined) ? game.season[k] : settings[k];
function applySeries(id) {
  SER = SERIES[id] || SERIES.f1;
  if (SER.id === 'f1') { TEAMS = F1_GRID.teams; DRIVERS = F1_GRID.drivers; CAR_NUMS = F1_GRID.nums; SERIES_PERSONA = {}; }
  else {
    TEAMS = SER.teams; DRIVERS = SER.drivers.map(d => [d[0], d[1]]);
    CAR_NUMS = SER.drivers.map((d, i) => d[3] ?? i + 2);
    SERIES_PERSONA = Object.fromEntries(SER.drivers.map(d => [d[1], d[2]]));
  }
  // teams can run two or three cars: the driver list says which team each driver is in
  FIXED_TEAMS = SER.id === 'f1' ? DRIVERS.map((_, i) => Math.floor(i / 2)) : SER.drivers.map((d, i) => d[4] ?? Math.floor(i / 2)); TEAM_MAP = FIXED_TEAMS.slice();
  builtFor = -1;
  if (settings.mode === 'champ') { const cal = calIdx(); if (!cal.includes(settings.track)) settings.track = cal[0]; }
}
// the class (physics, model, sound) a car races in
const PATS = ['stripes', 'twotone', 'sash', 'nose', 'arrow', 'fade', 'gulf', 'halves'];
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
function liveryFor(teamIdx) {
  const t = TEAMS[teamIdx]; if (!t) return null;
  return t.liv || { p: PATS[(teamIdx * 3 + SER.id.length) % PATS.length], c2: t.accent, c3: lum(t.color) > 0.55 ? '#111111' : '#ffffff' };
}
function classFor(teamIdx, isMine) {
  if (SER.multiClass) { if (isMine) return settings.lmClass === 'gt3' ? 'gt3' : 'hyper'; return (TEAMS[teamIdx] && TEAMS[teamIdx].cls) || SER.cls; }
  return SER.cls;
}
const LIVERIES = ['#ffcc00', '#f8fafc', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#111827', '#d4af37', '#c9ced6', '#39ff14', '#202226', '#e8a598', '#b3121f', '#9fd8ff', '#16171a'];
/* VIP liveries (unlocked with a code): special paint finishes */
const VIP_FROM = 7, VIP_LIV = { 7: { name: 'Gold', metal: 0.95, rough: 0.18 }, 8: { name: 'Chrome', metal: 1, rough: 0.06 }, 9: { name: 'Neon', metal: 0.2, rough: 0.3, glow: '#39ff14' }, 10: { name: 'Carbon & Gold', metal: 0.35, rough: 0.3, c2: '#d4af37' },
  11: { name: 'Rose Gold', metal: 0.95, rough: 0.15 }, 12: { name: 'Red Chrome', metal: 1, rough: 0.07 }, 13: { name: 'Ice Chrome', metal: 1, rough: 0.06 }, 14: { name: 'Matte Black', metal: 0.1, rough: 0.85, c2: '#ff2d2d' } };
/* VIP extras: gold rims, coloured underglow (both seen by other players online) and podium fireworks */
const GLOWS = [null, '#22d3ee', '#ff2bd6', '#39ff14', '#ffcc00', '#ff3b30'], GLOW_NAMES = ['Off', 'Blue', 'Pink', 'Green', 'Gold', 'Red'];
const myExtras = () => isVip() ? { rims: settings.vipRims !== false ? 1 : 0, glow: settings.vipGlow || 0, smoke: settings.vipSmoke || 0, flames: settings.vipFlames !== false ? 1 : 0 } : { rims: 0, glow: 0, smoke: 0, flames: 0 };
const SMOKES = [null, '#f2c94c', '#ff2bd6', '#22d3ee', '#39ff14', '#ff3b30', '#a855f7'], SMOKE_NAMES = ['Normal', 'Gold', 'Pink', 'Blue', 'Green', 'Red', 'Purple'];
const QCHAT = ['GG!', 'Nice move!', 'Sorry!', 'Thanks!', 'Good race!', 'See ya!'];
function makeCrown() { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#d4af37', emissive: '#7a5a00', emissiveIntensity: 0.6, metalness: 1, roughness: 0.25 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20, 1, true), m)); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), m); c.position.set(Math.cos(a) * 0.42, 0.26, Math.sin(a) * 0.42); g.add(c); } g.position.y = 2.1; return g; }   // gold rims on unless switched off
let goldRim = null, goldFace = null, glowTex = null;
function vipExtras(car, x) {
  if (!car || !x) return;
  car.smokeCol = x.smoke && SMOKES[x.smoke] ? new THREE.Color(SMOKES[x.smoke]) : null; car.flames = !!x.flames;
  if (x.rims) {
    goldRim = goldRim || new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.18, metalness: 1 });
    if (!goldFace) {
      // the wheel face you actually see: polished gold with five spokes and a bright centre nut
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.fillStyle = '#8a6a12'; g.fillRect(0, 0, 128, 128); g.translate(64, 64);
      g.strokeStyle = '#f2d27a'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 57, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.fillStyle = '#e8c45a'; g.beginPath(); g.moveTo(-7, 14); g.lineTo(7, 14); g.lineTo(4, 54); g.lineTo(-4, 54); g.fill(); }
      g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      goldFace = new THREE.MeshStandardMaterial({ map: t, roughness: 0.22, metalness: 0.9 });
    }
    car.group.traverse(o => { if (!o.isMesh || !o.material || !o.material.userData) return; if (o.material.userData.part === 'rim') o.material = goldRim; else if (o.material.userData.part === 'face') o.material = goldFace; });
  }
  const g = GLOWS[x.glow | 0];
  if (g) {
    if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(cv); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: g, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.y = 0.03; m.renderOrder = 2; car.group.add(m);
  }
}
const isVip = () => store.get('apexgp-vip') === '1';
const myLivery = () => settings.livery >= VIP_FROM && !isVip() ? 0 : settings.livery;
function vipFinish(car, k) {
  const v = VIP_LIV[k], m = car && car.mats && car.mats.body; if (!v || !m) return;
  m.metalness = v.metal; m.roughness = v.rough; if (v.glow && m.emissive) { m.emissive.set(v.glow); m.emissiveIntensity = 0.35; }
  m.needsUpdate = true;
}
/* more VIP perks: own car number, helmet design, night racing, victory donuts, Time Trial ghost, win horn and message */
const HELMETS = [['White & black', '#f4f4f4', '#111111'], ['Gold', '#d4af37', '#111111'], ['Black & gold', '#111111', '#d4af37'], ['Red', '#e10600', '#ffffff'], ['Blue', '#1e5fd0', '#ffffff'], ['Neon', '#39ff14', '#111111'], ['Pink', '#ff2bd6', '#ffffff'], ['Chrome', '#c9ced6', '#e10600']];
const myNum = () => isVip() && settings.vipNum ? settings.vipNum : 1;
const myHelmet = () => isVip() ? (settings.vipHelmet || 0) : -1;
const myNight = () => isVip() && !!settings.vipNight;
const vipMsgText = () => String(settings.vipMsg || '').replace(/[<>&]/g, '').slice(0, 40);
const helmetTex = {};
function helmetDesign(car, k) {
  const H = HELMETS[k]; if (!H || !car || !car.helmet) return;
  if (!helmetTex[k]) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = H[1]; g.fillRect(0, 0, 256, 128);
    g.fillStyle = H[2]; g.fillRect(0, 40, 256, 14); g.fillRect(116, 0, 24, 128);              // band and crown stripe
    g.fillStyle = H[1] === '#d4af37' || H[2] === '#d4af37' ? '#f7e7a1' : H[2]; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.arc(x + 16, 92, 6, 0, 7); g.fill(); }
    helmetTex[k] = new THREE.CanvasTexture(cv); helmetTex[k].colorSpace = THREE.SRGBColorSpace;
  }
  car.helmet.traverse(o => { if (o.isMesh && o.material && o.material.clearcoat === 1 && o.material.color) { o.material = o.material.clone(); o.material.color.set('#ffffff'); o.material.map = helmetTex[k]; o.material.metalness = k === 7 ? 0.9 : 0.3; o.material.needsUpdate = true; } });
}
function nightTheme(th) {
  if (th.night) return th;
  return Object.assign({}, th, { night: true, lights: true, nightSky: ['#03050d', '#1b2340'], exposure: Math.max(0.9, th.exposure || 0), bloom: Math.max(0.5, th.bloom || 0), fog: '#0b1020' });
}
let vipNames = null;
async function loadVipNames() {
  if (vipNames || !LB_ON) return vipNames || new Set();
  try { const r = await fetch(SUPABASE_URL + '/rest/v1/vip_names?select=name&limit=2000', { headers: lbHeaders }); vipNames = new Set(r.ok ? (await r.json()).map(x => x.name) : []); } catch (e) { vipNames = new Set(); }
  return vipNames;
}
function registerVipName() {
  const n = lbName(); if (!n || !isVip() || !LB_ON) return;
  fetch(SUPABASE_URL + '/rest/v1/vip_names', { method: 'POST', headers: { ...lbHeaders, Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ name: n }) }).catch(() => {});
  if (vipNames) vipNames.add(n);
}
const accentFor = k => VIP_LIV[k] && VIP_LIV[k].c2 ? VIP_LIV[k].c2 : LIVERIES[k] === '#111827' ? '#ffcc00' : '#111827';
async function redeemVip(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 8) return 'Type the whole code, like APEX-XXXX-XXXX.';
  let hash = '';
  try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('apexgp-vip:' + code)); hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'Your browser could not check the code.'; }
  if (!VIP_CODES.includes(hash.slice(0, 24))) return 'That code is not valid.';
  // each code works once: the first redeem is recorded online (if the codes table is set up)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/vip_redeemed', { method: 'POST', headers: { ...lbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ code_hash: hash }) });
      if (r.status === 409) return 'That code has already been used.';
    } catch (e) { return 'Could not check the code online. Check your internet and try again.'; }
  }
  store.set('apexgp-vip', '1');
  return true;
}
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
// 100 = right on the limit and slightly over it (they rely on kerbs and run-off); 75 ≈ old Hard
const aiPace = s => 0.8 + 0.225 * Math.pow(clamp(s, 0, 100) / 100, 0.75);
// skill 80-100 also get extra grip, braking and power so the very top is genuinely hard to beat
const aiBoost = s => 1 + BOOST_MAX * Math.pow(clamp((s - 70) / 30, 0, 1), 2);
const BOOST_MAX = 0.16;
const GEARS = [0, 22, 33, 44, 54, 64, 74, 84, 200];
const CAMS = ['COCKPIT', 'T-CAM', 'CHASE'];
const COMP = {
  soft: { name: 'Soft', s: 'S', color: '#e2231a', grip: 1.035, life: 0.4 },
  medium: { name: 'Medium', s: 'M', color: '#f5c400', grip: 1.0, life: 0.68 },
  hard: { name: 'Hard', s: 'H', color: '#e8e8e8', grip: 0.972, life: 0.8 },
  inter: { name: 'Intermediate', s: 'I', color: '#2bb54a', grip: 0.93, life: 0.7 },
  wet: { name: 'Wet', s: 'W', color: '#1e6fe0', grip: 0.9, life: 0.95 },
};
const SLICK = c => c === 'soft' || c === 'medium' || c === 'hard';
const lerp4 = (pts, w) => { for (let i = 1; i < pts.length; i++) if (w <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (w - a) / (b - a); } return pts[pts.length - 1][1]; };
function tyreGrip(comp, wear, wet) {
  let g;
  if (SLICK(comp)) g = COMP[comp].grip * lerp4([[0, 1], [0.3, 0.84], [0.6, 0.67], [1, 0.52]], wet);
  else if (comp === 'inter') g = lerp4([[0, 0.86], [0.3, 0.93], [0.6, 0.9], [1, 0.74]], wet);
  else g = lerp4([[0, 0.78], [0.3, 0.85], [0.6, 0.9], [1, 0.89]], wet);
  return g * clamp(1 - 0.16 * Math.min(wear, 1) ** 2 - 0.3 * Math.max(0, wear - 1), 0.55, 1);
}

/* ---------------- Renderer & world ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = false;
setMaxAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.08, 20000);
const world = new World(renderer, scene);
const weather = new Weather(scene);
const smoke = new Particles(scene, 1600, false);
const sparks = new Particles(scene, 500, true);
const fireworks = new Fireworks(scene);
const skids = new Skids(scene);

const settings = Object.assign({ steer: 'normal', series: 'f1', lmClass: 'hyper', track: 0, mode: 'race', laps: 5, opp: 9, ai: 50, line: 'off', livery: 0, quali: 'on', weather: 'random', damage: 'sim', champType: 'real' }, store.json('apexgp2-settings', {}));
if (SERIES[settings.series] && SERIES[settings.series].vip && store.get('apexgp-vip') !== '1') settings.series = 'f1';   // VIP-only series need a code
if (settings.track >= TRACKS.length) settings.track = 0;
if (typeof settings.diff === 'string') { settings.ai = { easy: 25, medium: 50, hard: 72 }[settings.diff] ?? 50; delete settings.diff; }
delete settings.gfx;
const saveSettings = () => store.set('apexgp2-settings', JSON.stringify(settings));

let builtFor = null;
function buildTrack(i) {
  const key = i + (myNight() ? ':night' : '');
  if (builtFor === key) return getTrack(i);
  const T = getTrack(i);
  T.baseTheme = T.baseTheme || T.theme; T.theme = myNight() ? nightTheme(T.baseTheme) : T.baseTheme;   // VIP: night racing anywhere
  world.build(T, 0, TEAMS.map(t => t.color), TEAMS.map(t => t.name));
  builtFor = key;
  smoke.clear(); sparks.clear(); skids.clear();
  return T;
}

/* ---------------- Audio ---------------- */
const sound = new Sound();
sound.muted = store.get('apexgp-muted') === '1';
const audio = { init() { sound.init(); }, set() {}, get muted() { return sound.muted; }, set muted(v) { sound.muted = v; } };

/* ---------------- Championship ---------------- */
const seasonKey = () => 'apexgp3-season' + (SER.id === 'f1' ? '' : '-' + SER.id);
const loadSeason = () => store.json(seasonKey(), null);
const saveSeason = s => store.set(seasonKey(), JSON.stringify(s));
function newSeason() {
  const r = rng(Date.now() & 0xfffff);
  const order = DRIVERS.map((d, i) => i).sort(() => r() - 0.5).slice(0, settings.opp);
  const s = { round: 0, laps: settings.laps, ai: settings.ai, opp: settings.opp, lineup: order.map(di => ({ di, rating: 0.99 + r() * 0.02 })), pts: {}, finished: false };
  if (settings.champType === 'custom' && customCal().length) Object.assign(s, { cal: customCal().slice(), quali: settings.quali, weather: settings.weather, damage: settings.damage });
  s.teamMap = shuffleTeams(r, s.lineup.slice(1).map(l => l.di));
  s.pts.YOU = 0; order.forEach(di => s.pts[DRIVERS[di][1]] = 0);
  saveSeason(s); return s;
}

/* ---------------- Game state ---------------- */
const game = { state: 'menu', T: null, cars: [], player: null, mate: null, session: null, phase: 'idle', lightsT: 0, goAt: 0, raceTime: 0, camMode: 2, paused: false, finishCount: 0, orbit: 0, resultsAt: 0, season: null, laps: 5, skill: 50, q: null, grid: null, wx: {}, to: null, fastest: Infinity };
const cm = parseInt(store.get('apexgp-cam'), 10); if (cm >= 0 && cm < 3) game.camMode = cm;
const keys = {};
const v10On = () => isVip() && !!settings.vipV10 && settings.mode !== 'mp';   // VIP V10 monster (not online)
const serKey = id => (v10On() ? 'v10-' : SER.id === 'f1' ? '' : SER.id + '-') + id;   // V10 times kept separate
const bestKey = T => 'apexgp2-best-' + serKey(T.def.id);
const recordFor = T => { const v = parseFloat(store.get(bestKey(T))); return isFinite(v) ? v : 0; };
const T = () => game.T;
const isRace = () => game.session === 'race';
const racing = () => isRace() && game.phase === 'race';
const curLap = c => Math.max(1, c.maxDone + 1);

function clearCars() { world.resetCrews(); for (const c of game.cars) { scene.remove(c.group); disposeCar(c); } game.cars = []; game.player = null; game.mate = null; }

function resetState(c) {
  Object.assign(c, {
    x: 0, z: 0, h: 0, vh: 0, v: 0, steer: 0, spin: 0, slip: 0, idx: 0, prog: 0, lat: 0, surf: 0, gripNow: 1, maxDone: -1, lapStart: 0, lastLap: 0, bestLap: Infinity,
    lapInvalid: false, lapTimes: [], finished: false, finishTime: 0, finishOrder: 0, splits: {}, lastBucket: -1e9, laneOff: 0, laneTarget: 0, blockT: 0, startDelay: 0,
    autopilot: false, inp: { throttle: 0, brake: 0, steer: 0 }, gear: 0, rpm: 4000, wheelRot: 0, hitT: 0, scrub: 0, sparkT: Math.random(),
    drsArmed: -1, drsOpen: false, drsGap: Infinity, offLimits: false, strikes: 0, penalty: 0, contactT: -9, pitReq: false, pit: null, pits: 0,
    dmg: { fw: 0, rw: 0, susp: 0, punct: false, pull: 0 }, dnf: false, retire: null, yieldT: 0, active: true, sessBest: Infinity, timedLaps: 0, evalT: 0, wearWarn: 0, outLap: false, inPitRoad: false, impact: 0, pitExitT: -99, lift: 0,
  });
  c.fwing.visible = c.rwing.visible = true;
}
function setTyres(c, comp) { c.tyre = { comp, wear: 0 }; c.tyreLap = Math.max(1, (c.maxDone ?? -1) + 1); c.stints = c.stints || []; c.stints.push(comp); setCompound(c, comp); }

/* Build the field: player, teammate (in Your Team colours) and AI rivals */
function makeField(lineup, skill) {
  clearCars();
  const lv = myLivery(), colr = LIVERIES[lv], acc = accentFor(lv);
  const basePcls = classFor(TEAMS.length, true), pcls = v10On() ? 'v10' : basePcls;
  const myLiv = { p: PATS[(lv * 5) % PATS.length], c2: acc, c3: acc === '#111827' ? '#ffcc00' : '#ffffff' };
  const p = Object.assign(makeCar({ color: colr, accent: acc, helmet: '#ffffff', number: myNum(), compound: 'medium', model: CLASSES[pcls].model, livery: myLiv }), { name: 'You', code: 'YOU', team: 'Your Team', color: colr, isPlayer: true, pace: 1, teamIdx: TEAMS.length, cls: pcls, spec: CLASSES[pcls] });
  vipFinish(p, lv); vipExtras(p, myExtras()); helmetDesign(p, myHelmet()); p.vip = isVip(); mergeCarStatic(p); game.cars.push(p); game.player = p; addLiveMirrors(p, mirrorRT.texture); p.hasMirrors = true;
  lineup.forEach((L, k) => {
    const di = L.di, mate = k === 0 && settings.mode !== 'tt';
    const tm = TEAMS[teamIdxOf(di)], cls = mate ? basePcls : classFor(teamIdxOf(di), false);
    const c = Object.assign(makeCar({ color: mate ? colr : tm.color, accent: mate ? acc : tm.accent, helmet: ['#ffffff', '#ffcc00', '#ff4d4d', '#4da6ff'][di % 4], number: CAR_NUMS[di], compound: 'medium', model: CLASSES[cls].model, livery: mate ? myLiv : liveryFor(teamIdxOf(di)) }), { cls, spec: CLASSES[cls] },
      { name: DRIVERS[di][0], code: DRIVERS[di][1], team: mate ? 'Your Team' : tm.name, color: mate ? colr : tm.color, isPlayer: false, mate, teamIdx: mate ? TEAMS.length : teamIdxOf(di),
        per: personaOf(DRIVERS[di][1]), pace: Math.min(1.035, aiPace(skill) * L.rating * (1 + (personaOf(DRIVERS[di][1]).skill - 0.86) * 0.03)), lateBrake: skill >= 70, rating: L.rating, boost: aiBoost(skill) });
    mergeCarStatic(c); addLodProxy(c); game.cars.push(c); if (mate) game.mate = c;
  });
  for (const c of game.cars) { resetState(c); c.stints = []; scene.add(c.group); }
  p.steering.visible = true;
}

/* ---------------- Placement: grid, garage ---------------- */
function placeOnTrack(c, idx, lat, Tr) {
  c.idx = idx; c.lat = lat; c.x = Tr.px[idx] + Tr.nx[idx] * lat; c.z = Tr.pz[idx] + Tr.nz[idx] * lat; c.h = c.vh = Math.atan2(Tr.tx[idx], Tr.tz[idx]);
}
function placeGrid(order, Tr) {
  order.forEach((c, s) => {
    const back = 8 + s * 8, idx = (Tr.N - Math.round(back / DS)) % Tr.N, lane = (s % 2 === 0 ? 1 : -1) * 3.2;
    placeOnTrack(c, idx, lane, Tr); c.prog = idx - Tr.N; c.laneOff = lane - Tr.race[idx]; c.laneTarget = (Math.random() - 0.5) * 1.2;
    c.startDelay = c.isPlayer ? 0 : 0.12 + Math.random() * 0.35; c.gridPos = s + 1;
  });
}
const boxIdx = (c, Tr) => (Tr.pit.boxStart + c.teamIdx * Tr.pit.boxGap) % Tr.N;
const boxK = (c, Tr) => (boxIdx(c, Tr) - Tr.pit.entry + Tr.N) % Tr.N;
function placeGarage(c, Tr) {
  c.pit = { stage: 'garage', k: boxK(c, Tr), lat0: Tr.pit.fast, wait: 0, stopAtBox: true, total: 1 };
  c.prog = boxIdx(c, Tr) - Tr.N; c.v = 0; pitPose(c, Tr);
}

/* ---------------- Weekend flow ---------------- */
let lapEstCache = null;
const profOf = (c, Tr) => speedProfiles(Tr, c.spec || CLASSES.f1)[c.lateBrake ? 1 : 0];
function estimateLap(Tr, pace, prof, boost = 1, spec = CLASSES.f1) {
  if (prof === null) { const pp = speedProfiles(Tr, spec); prof = pp[0]; }
  const vm = VMAX * spec.vmax * Math.sqrt(boost), sp = pace * Math.sqrt(boost);
  let v = prof[0] * sp, t = 0;
  for (let pass = 0; pass < 2; pass++) { t = 0; for (let i = 0; i < Tr.N; i++) { const lim = prof[(i + 1) % Tr.N] * sp, a = 11.5 * boost * spec.power * (1 - (v / vm) ** 2) - (0.3 + 0.00028 * (spec.drag || 1) * v * v); const nv = Math.min(lim, Math.sqrt(Math.max(1, v * v + 2 * a * DS))); t += DS / ((v + nv) / 2); v = nv; } }
  return t * 1.002; // AI drive almost exactly on the profile
}

function startWeekend() {
  const champ = settings.mode === 'champ', tt = settings.mode === 'tt', derby = settings.mode === 'derby' && isVip();
  if (derby) { if (SER.id !== 'bus') applySeries('bus'); settings.track = TRACKS.findIndex(t => t.id === 'derbyarena'); }   // bus demolition derby in the arena
  if (champ) { const old = loadSeason(); game.season = old && !old.finished ? old : newSeason(); settings.track = calIdx()[game.season.round] ?? calIdx()[0]; }
  const Tr = game.T = buildTrack(settings.track);
  game.laps = tt ? Infinity : derby ? 999 : (champ ? game.season.laps : settings.laps);
  game.skill = champ ? (game.season.ai ?? 50) : settings.ai;
  const r = rng((Date.now() & 0xffff) + 1);
  let lineup = [];
  if (champ) TEAM_MAP = shuffleTeams();
  if (champ) lineup = game.season.lineup.slice();
  else if (!tt) lineup = DRIVERS.map((d, i) => i).sort(() => r() - 0.5).slice(0, derby ? clamp(settings.opp, 7, 11) : settings.opp).map(di => ({ di, rating: 0.99 + r() * 0.02 }));
  if (!champ && !tt) TEAM_MAP = shuffleTeams(r, lineup.slice(1).map(l => l.di));
  makeField(lineup, game.skill);
  game.seed = (Date.now() & 0xfffff) + 3;
  game.lapEst = estimateLap(Tr, aiPace(game.skill), null, 1, CLASSES[SER.cls]);
  game.record = recordFor(Tr); game.fastest = Infinity;
  game.wxMode = tt ? 'dry' : rule('weather');
  $('menu').classList.add('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden');
  buildMinimap(Tr);
  audio.init();
  if (tt) return startSession('tt');
  if (rule('quali') === 'on' && !derby) {
    const n = game.cars.length;
    game.q = { stages: n >= 12 ? ['Q1', 'Q2', 'Q3'] : ['Q'], idx: 0, entrants: game.cars.slice(), out: [], results: {} };
    if (n >= 12) { const rest = n - 10; game.q.elim = { Q1: Math.ceil(rest / 2), Q2: rest - Math.ceil(rest / 2), Q3: 0 }; } else game.q.elim = { Q: 0 };
    return startSession(game.q.stages[0]);
  }
  // no qualifying: grid by pace (with a little randomness), player mid-field
  const order = game.cars.filter(c => !c.isPlayer).map(c => [c, c.pace * ((c.spec && c.spec.vmax) || 1) * (1 + (r() - 0.5) * 0.006)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  // player mid-field (within their own class in multi-class races)
  const same = order.filter(c => c.cls === game.player.cls), at = same.length ? order.indexOf(same[Math.floor(same.length * 0.55)] || same[same.length - 1]) : Math.floor(game.cars.length * 0.55);
  order.splice(at, 0, game.player);
  game.grid = order;
  showStrategy();
}

function hideAllOverlays() { ['results', 'pause', 'qres', 'strategy'].forEach(id => $(id).classList.add('hidden')); }

function startSession(kind) {
  world.resetCrews();
  const Tr = game.T, p = game.player;
  hideAllOverlays();
  clearSC(); game.flag = null; $('flag').className = 'hidden';
  game.wx = { announced: 0, level: 0, raining: false, forecastSaid: false };
  game.session = kind; game.raceTime = 0; game.finishCount = 0; game.paused = false; game.resultsAt = 0; game.state = 'race';
  game.drsCross = Tr.drs.map(() => ({}));
  const quali = kind !== 'tt' && kind !== 'race';
  const dur = quali ? game.lapEst * 3.2 : game.lapEst * 30;
  weather.setup(Tr, game.wxMode, dur, game.seed + (quali ? 11 : 0));
  for (const c of game.cars) { const keep = c.stints; resetState(c); c.stints = []; c.active = c.isPlayer; c.group.visible = c.isPlayer; }
  const wetStart = weather.average() > 0.3;
  setTyres(p, wetStart ? (weather.average() > 0.6 ? 'wet' : 'inter') : 'soft');
  placeGarage(p, Tr);
  game.phase = 'garage';
  if (quali) {
    const entrants = game.q.entrants, sess = { name: kind, times: {}, reveal: [] };
    const factor = { Q1: 1, Q2: 0.998, Q3: 0.996, Q: 1 }[kind];
    for (const c of entrants) {
      if (c.isPlayer || c.remote) continue;
      const base = estimateLap(Tr, Math.min(1.04, c.pace), profOf(c, Tr), c.boost || 1, c.spec || CLASSES.f1) * factor * 1.012;
      const wetPen = 1 + 0.16 * weather.average();
      const t = base * wetPen * (1 + (Math.random() - 0.5) * 0.006);
      sess.reveal.push({ c, t, at: 25 + Math.random() * (dur - 30) });
    }
    game.q.cur = sess;
    radio((kind === 'Q' ? 'Qualifying. Out lap, then two flying laps.' : kind + '. Out lap, then two flying laps. Bottom ' + game.q.elim[kind] + ' are knocked out.') + ' DRS is free in the zones.', 'info', 7);
  } else if (kind === 'tt') { radio('Time trial. Leave the garage when ready; DRS is free in the zones.', 'info', 6); if (isVip()) { const [g, sv, b] = medalTimes(); setTimeout(() => radio('Medal times · Gold ' + fmt(g) + ' · Silver ' + fmt(sv) + ' · Bronze ' + fmt(b), 'info', 8), 6500); } }
  $('board').classList.toggle('hidden', kind === 'tt'); $('tl').classList.toggle('hidden', kind === 'tt');
  $('startLights').classList.add('hidden'); $('garageBar').classList.remove('hidden');
  $('trackTag').textContent = (settings.mode === 'champ' ? 'ROUND ' + (calIdx().indexOf(settings.track) + 1) + ' · ' : '') + Tr.def.name.toUpperCase() + ' · ' + sessionLabel();
  $('radio').innerHTML = ''; updatePenTag();
  world.setRaceLine(settings.line === 'on'); colorLineForPlayer();
  setCam(game.camMode, true);
}
const sessionLabel = () => ({ Q1: 'QUALIFYING 1', Q2: 'QUALIFYING 2', Q3: 'QUALIFYING 3', Q: 'QUALIFYING', race: 'RACE', tt: 'TIME TRIAL' })[game.session];

function leaveGarage() {
  const p = game.player; if (!p.pit || p.pit.stage !== 'garage') return;
  p.pit.stage = 'out'; game.phase = 'run'; $('garageBar').classList.add('hidden');
}

function endQualiSession() {
  const q = game.q, s = q.cur, p = game.player;
  if (q.mp) { game.phase = 'idle'; p.active = false; mpQualiTable(); return; }
  for (const r of s.reveal) s.times[r.c.code] = r.t;
  s.times.YOU = p.sessBest;
  const ent = q.entrants.slice().sort((a, b) => (s.times[a.code] ?? 1e9) - (s.times[b.code] ?? 1e9));
  const elim = q.elim[s.name] || 0, keep = ent.slice(0, ent.length - elim), out = ent.slice(ent.length - elim);
  q.results[s.name] = ent.map(c => ({ c, t: s.times[c.code] }));
  q.out = out.concat(q.out);  // later sessions' eliminations go in front
  q.entrants = keep;
  game.phase = 'idle'; p.active = false;
  showQualiResults(s.name, ent, elim);
}
function nextQualiStep() {
  const q = game.q, p = game.player;
  q.idx++;
  const playerIn = q.entrants.includes(p);
  if (q.idx < q.stages.length && playerIn) return startSession(q.stages[q.idx]);
  // simulate remaining sessions without the player
  while (q.idx < q.stages.length) {
    const name = q.stages[q.idx], f = { Q2: 0.998, Q3: 0.996 }[name] || 1;
    const times = {}; q.entrants.forEach(c => times[c.code] = estimateLap(game.T, Math.min(1.04, c.pace), profOf(c, game.T), c.boost || 1, c.spec || CLASSES.f1) * f * 1.012 * (1 + (Math.random() - 0.5) * 0.006));
    const ent = q.entrants.slice().sort((a, b) => times[a.code] - times[b.code]), elim = q.elim[name] || 0;
    q.results[name] = ent.map(c => ({ c, t: times[c.code] }));
    q.out = ent.slice(ent.length - elim).concat(q.out); q.entrants = ent.slice(0, ent.length - elim);
    q.idx++;
  }
  const last = q.results[q.stages[q.stages.length - 1]];
  game.grid = last.map(r => r.c).concat(q.out);
  showStrategy();
}

/* ---------------- Strategy ---------------- */
function strategyOptions() {
  const L = game.laps, wetNow = weather.average();
  if (wetNow > 0.3) return [
    { name: 'Start on Intermediates', stints: [['inter', 0]], note: 'Pit when the engineer calls it' },
    { name: 'Start on Full Wets', stints: [['wet', 0]], note: 'Safest if the rain gets heavier' },
  ];
  if (L < 5) return [
    { name: 'Flat out on Softs', stints: [['soft', 0]], note: 'Short race: no stop needed' },
    { name: 'Mediums, no stop', stints: [['medium', 0]], note: 'Less grip, more consistent' },
    { name: 'Hards, no stop', stints: [['hard', 0]], note: 'Lowest grip, never fades' },
  ];
  const o = [
    { name: '1-stop: Medium → Hard', stints: [['medium', 0], ['hard', Math.round(L * 0.5)]] },
    { name: '1-stop: Soft → Hard', stints: [['soft', 0], ['hard', Math.max(2, Math.round(L * 0.36))]] },
  ];
  if (L >= 8) o.push({ name: '2-stop: Soft → Medium → Soft', stints: [['soft', 0], ['medium', Math.round(L * 0.3)], ['soft', Math.round(L * 0.68)]] });
  else o.push({ name: '1-stop: Soft → Medium', stints: [['soft', 0], ['medium', Math.round(L * 0.45)]] });
  return o;
}
function forecastText() {
  const t = weather.nextRain(0), dur = game.lapEst * game.laps;
  if (weather.average() > 0.3) return 'Wet race: the track is soaked.';
  if (t < dur) return 'Forecast: rain likely around lap ' + Math.max(1, Math.round(t / game.lapEst)) + '.';
  return game.wxMode === 'dry' ? 'Forecast: dry all race.' : 'Forecast: dry, small chance of showers.';
}
function showStrategy() {
  // prepare race weather now so the forecast is meaningful
  game.session = 'race-prep';
  weather.setup(game.T, game.wxMode, game.lapEst * game.laps, game.seed + 99);
  const opts = strategyOptions(), box = $('stratCards');
  $('stratSub').textContent = game.T.def.name + ' · ' + game.laps + ' laps · Grid P' + (game.grid.indexOf(game.player) + 1) + ' of ' + game.grid.length;
  $('stratWx').textContent = forecastText() + (game.laps >= 5 && weather.average() < 0.3 ? ' Rule: dry races need two different dry compounds.' : '');
  box.innerHTML = '';
  opts.forEach((o, k) => {
    const el = document.createElement('button'); el.className = 'scard panel' + (k === 0 ? ' on' : '');
    el.innerHTML = '<div class="sn">' + o.name + '</div><div class="tyres">' + o.stints.map(([c, lap]) => '<span class="tb" style="--tc:' + COMP[c].color + '">' + COMP[c].s + '</span>' + (lap ? '<small>box lap ' + lap + '</small>' : '')).join('<i>→</i>') + '</div>' + (o.note ? '<div class="note">' + o.note + '</div>' : '');
    el.onclick = () => { box.querySelectorAll('.scard').forEach(b => b.classList.remove('on')); el.classList.add('on'); game.stratPick = k; };
    box.appendChild(el);
  });
  game.stratPick = 0; game.stratOpts = opts;
  hideAllOverlays(); $('hud').classList.add('hidden'); $('strategy').classList.remove('hidden');
  game.phase = 'idle';
}

function aiPlan(c, L) {
  const wetNow = weather.average();
  if (wetNow > 0.3) return [[wetNow > 0.6 && Math.random() < 0.6 ? 'wet' : 'inter', 0]];
  if (L < 5) return [[Math.random() < 0.6 ? 'soft' : 'medium', 0]];
  const opts = [[['medium', 0], ['hard', Math.round(L * 0.5)]], [['soft', 0], ['hard', Math.round(L * 0.36)]], [['soft', 0], ['medium', Math.round(L * 0.45)]], [['hard', 0], ['medium', Math.round(L * 0.6)]]];
  return opts[Math.floor(Math.random() * opts.length)].map(([cmp, lap]) => [cmp, lap ? Math.max(2, lap + Math.round((Math.random() - 0.5) * 2)) : 0]);
}

function startRace() {
  const Tr = game.T;
  hideAllOverlays(); $('hud').classList.remove('hidden');
  game.session = 'race'; game.raceTime = 0; game.finishCount = 0; game.paused = false; game.resultsAt = 0; game.state = 'race'; game.fastest = Infinity; game.mode = 1; engMenu(false); if (game.player) game.player.tyreChoice = null; game.derby = settings.mode === 'derby' && isVip() ? { t: 0, limit: 180, out: 0 } : null; for (const c of game.cars) c.hp = 100; $('derbyHud').classList.toggle('hidden', !game.derby); if (game.derby) radio('DEMOLITION DERBY! Ram the other buses. Last bus running wins (3 minutes).', 'info', 6); game.fwDone = false; fireworks.stop(); game.fwCar = null; game.champ = null;
  clearSC(); game.flag = null; game.dnfTimes = []; game.redWx = false; game.drsHoldLap = 0; $('flag').className = 'hidden';
  game.drsCross = Tr.drs.map(() => ({})); game.to = { issued: null }; game.wx = { announced: 0, level: 0, raining: false, forecastSaid: false };
  for (const c of game.cars) { resetState(c); c.stints = []; c.active = true; c.group.visible = true; }
  world.resetCrews(); placeGrid(game.grid, Tr);
  const pick = game.stratOpts[game.stratPick || 0];
  game.player.plan = pick.stints.map(s => s.slice());
  for (const c of game.cars) { if (!c.isPlayer) c.plan = aiPlan(c, game.laps); c.planIdx = 0; setTyres(c, c.plan[0][0]); }
  game.phase = 'lights'; game.lightsT = 0; game.goAt = 5.6 + Math.random() * 1.4;
  world.setStartLights(0);
  $('board').classList.remove('hidden'); $('tl').classList.remove('hidden'); $('garageBar').classList.add('hidden');
  $('startLights').classList.remove('hidden');
  $('trackTag').textContent = (settings.mode === 'champ' ? 'ROUND ' + (settings.track + 1) + ' · ' : '') + Tr.def.name.toUpperCase() + ' · RACE';
  $('radio').innerHTML = ''; updatePenTag();
  world.setRaceLine(settings.line === 'on'); colorLineForPlayer();
  setCam(game.camMode, true);
  radio(forecastText() + ' Starting on ' + COMP[game.player.tyre.comp].name + 's.', 'info', 7);
}

/* ---------------- Physics ---------------- */
function surfaceOf(c, Tr) {
  if (Tr.def.arena) return 0;   // derby arena: the whole floor is driveable
  const a = Math.abs(c.lat);
  if (a <= W + 0.3) return 0;
  if (a <= W + KERB) return 1;
  const s = c.lat > 0 ? 1 : -1;
  // pit entry / exit roads are proper tarmac
  if (Tr.pit && s === Tr.pit.side) { const pr = pitRoad(Tr, c.idx); if (pr && a >= pr.a - 0.6 && a <= pr.b + 0.6) return 0; }
  // the tarmac strip between the track and the pit wall
  if (Tr.pit && s === Tr.pit.side) { const P = Tr.pit, kk = (c.idx - P.entry + Tr.N) % Tr.N; if (kk > P.limIn - 8 && kk < P.limOut + 8 && a < P.wall) return 2; }
  // escape roads are asphalt
  for (const z of Tr.escapes || []) if (z.off.has(c.idx) && Math.abs(c.lat - z.off.get(c.idx)) < 3.8) return 0;
  if (Tr.street) return 2;
  for (const z of Tr.runZones || []) if (z.side === s && ((c.idx - z.a + Tr.N) % Tr.N) <= z.len && a > W + KERB + 2.4) return z.kind === 'gravel' ? 3 : 2;
  if (Tr.def.runoffStyle && a > W + KERB) return Tr.gravel[c.idx] === s && a > W + KERB + 2.4 ? 3 : 2;
  if (a <= W + KERB + 2.4) return 2;
  if (Tr.gravel[c.idx] === s) return 3;
  return 4;
}
const GRIP = [1, 0.93, 0.88, 0.45, 0.6];
const PLAYER_GRIP = 1.18; // extra grip for the player's car
// driving modes the player can ask the engineer for: more grip and pace, or kinder to the tyres
const MODES = [{ name: 'SAVE', grip: 0.98, wear: 0.6 }, { name: 'STANDARD', grip: 1, wear: 1 }, { name: 'PUSH', grip: 1.03, wear: 1.5 }];
const DRAG = [0, 0, 0, 0.95, 0.4];

function setVel(c, vx, vz) {
  const sp = Math.hypot(vx, vz), fwd = vx * Math.sin(c.h) + vz * Math.cos(c.h);
  if (sp < 1e-3) { c.v = 0; return; }
  if (fwd >= 0) { c.v = sp; c.vh = Math.atan2(vx, vz); } else { c.v = -sp; c.vh = Math.atan2(-vx, -vz); }
}

function stepCar(c, inp, dt, Tr) {
  if (c.pit) return pitStep(c, dt, Tr);
  if (c.dnf) return retireStep(c, dt, Tr);
  const surf = c.surf = surfaceOf(c, Tr), wet = weather.wetAt(c.idx);
  // gravity along the slope: uphill slows the car, downhill speeds it up
  if (Tr.grade[c.idx] && Math.abs(c.v) > 1) c.v -= 9.81 * Tr.grade[c.idx] * Math.sign(c.v) * dt;
  const tg = tyreGrip(c.tyre.comp, c.tyre.wear, wet), d = c.dmg;
  const dmgF = 1 - 0.2 * d.fw - 0.1 * d.susp - (d.punct ? 0.3 : 0);
  const boost = c.boost || 1;
  const spec = c.spec || CLASSES.f1;
  for (const sg of Tr.sausages || []) {
    const di = ((c.idx - sg.i + Tr.N + Tr.N / 2) % Tr.N) - Tr.N / 2, base = W + KERB + 0.35;
    if (Math.abs(di) <= sg.half && Math.abs(c.lat - sg.side * base) < 0.45 && Math.abs(c.v) > 8 && (c.sausT || 0) <= 0) {
      c.sausT = 0.35; c.lift = Math.max(c.lift || 0, 0.12); c.spin += (Math.random() - 0.5) * 1.6; c.v *= 0.94; c.hitT = Math.max(c.hitT || 0, 0.3);
      if (c.isPlayer) c.impact = Math.max(c.impact || 0, 0.35);
    }
  }
  if (c.sausT > 0) { c.sausT -= dt; c.lift = Math.max(0, (c.lift || 0) - dt * 0.5); }
  const grip = c.gripNow = GRIP[surf] * tg * dmgF * (surf >= 3 ? 1 - 0.3 * wet : 1) * boost * spec.grip * (Tr.gripMul || 1) * (c.isPlayer ? PLAYER_GRIP * MODES[game.mode ?? 1].grip : AI_GRIP);
  c.gripTD = tg * dmgF;
  let v = c.v;
  const vm = VMAX * spec.vmax * (c.drsOpen ? 1.08 : 1) * (1 + 0.04 * (c.tow || 0)) * (1 - 0.05 * d.rw) * (d.punct ? 0.35 : 1) * Math.sqrt(boost);
  let yaw, slip;
  if ((c.isPlayer && !c.autopilot) || c.dynamic) {
    // the player's car uses a proper chassis/tyre model
    const st = clamp(inp.steer + d.pull, -1, 1);
    const bankA = Tr.bankSin[c.idx] * 9.81 * 1.6 * (st * Tr.curv[c.idx] > 0 ? 1 : -0.3);
    yaw = dynStep(c, inp, dt, grip, vm, bankA, st, surf, d);
    slip = c.slip; v = c.v;
  } else {
  if (inp.throttle > 0) {
    if (v < -0.2) v += 28 * dt * inp.throttle;
    else { const f = 1 - Math.pow(Math.max(v, 0) / vm, 2); v += 11.5 * boost * spec.power * inp.throttle * Math.max(f, 0) * (surf >= 3 ? 0.55 : 1) * Math.min(1, 0.45 + 0.6 * grip) * dt; }
  }
  if (inp.brake > 0) {
    if (v > 0.4) v = Math.max(0, v - 36 * grip * spec.brake * inp.brake * dt);
    else if (inp.throttle === 0) v = Math.max(v - 7 * dt, -12);
  }
  const dec = (0.3 + dragK(c) * v * v + (inp.throttle === 0 ? 1.2 : 0) + DRAG[surf] * Math.abs(v) + (d.punct ? 0.05 * Math.abs(v) : 0)) * dt;
  if (v > 0) v = Math.max(0, v - dec); else if (v < 0) v = Math.min(0, v + dec);

  const st = clamp(inp.steer + d.pull, -1, 1);
  const bankA = Tr.bankSin[c.idx] * 9.81 * 1.6 * (st * Tr.curv[c.idx] > 0 ? 1 : -0.3);
  const sp = Math.abs(v), geo = sp * Math.tan(0.42) / 3.6, dyn = ((18 + 0.25 * sp) * grip + bankA) / Math.max(sp, 1);
  yaw = st * Math.min(geo, dyn) * (v < 0 ? -1 : 1);
  // throttle-on oversteer when grip is low (wet, worn tyres, rear wing damage)
  const loose = Math.max(0, 0.84 - grip + 0.15 * d.rw) * inp.throttle * Math.min(1, sp / 30);
  c.h += (yaw + st * loose * 0.9 + c.spin) * dt;
  c.spin *= Math.exp(-2.2 * dt);
  c.scrub = (geo > dyn && Math.abs(st) > 0.6 && sp > 15) ? Math.abs(st) : 0;
  if (c.scrub) v -= Math.sign(v) * c.scrub * 2.2 * dt;
  // the direction of travel lags the nose when grip is low: the car slides
  const relax = clamp(16 * grip * grip - 4 * d.rw, 1.4, 16);
  c.vh += angDiff(c.h, c.vh) * Math.min(1, relax * dt);
  slip = c.slip = angDiff(c.h, c.vh);
  if (Math.abs(slip) > 0.12 && sp > 2) v -= Math.sign(v) * Math.min(sp, Math.abs(slip) * 7 * dt * (1 + sp / 40));
  c.x += Math.sin(c.vh) * v * dt; c.z += Math.cos(c.vh) * v * dt; c.v = v;
  }
  const sp = Math.abs(v);

  // tyre wear: faster when cornering hard, much faster for wet-weather tyres on a dry track
  const lapsLife = isRace() ? Math.max(2, COMP[c.tyre.comp].life * game.laps) : COMP[c.tyre.comp].life * 20;
  const load = Math.min(1, Math.abs(yaw * sp) / 30) + Math.abs(slip);
  const dryPen = !SLICK(c.tyre.comp) ? (c.tyre.comp === 'inter' ? 1 + 2.5 * Math.max(0, 0.25 - wet) * 4 : 1 + 4 * Math.max(0, 0.4 - wet) * 2.5) : 1;
  const wearK = c.isPlayer ? MODES[game.mode ?? 1].wear : (c.per ? c.per.tyre : 1);
  if (isRace()) c.tyre.wear += sp * dt / DS / (lapsLife * Tr.N) * (0.7 + 0.6 * load) * dryPen * wearK;

  const ni = locate(Tr, c.x, c.z, c.idx);
  let dn = ni - c.idx; if (dn > Tr.N / 2) dn -= Tr.N; else if (dn < -Tr.N / 2) dn += Tr.N;
  c.idx = ni; c.prog += dn;
  c.lat = (c.x - Tr.px[ni]) * Tr.nx[ni] + (c.z - Tr.pz[ni]) * Tr.nz[ni];
  // pit entry/exit roads: the pit-side wall has gaps there, and inside the pit lane the pit wall and outer wall apply
  const P = Tr.pit, kk = (ni - P.entry + Tr.N) % Tr.N, inRange = kk < P.len, pl = P.side * c.lat;
  const gap = inRange && (kk < 40 || kk > P.len - 40);
  if (gap && pl > P.wall - 0.3) c.inPitRoad = true;
  if (!inRange || pl < P.wall - 1.2) c.inPitRoad = false;
  const s = c.lat >= 0 ? 1 : -1, lim = (s > 0 ? Tr.limL[ni] : Tr.limR[ni]) - 1.05;
  if (inRange && s === P.side && (gap || c.inPitRoad)) {
    if (pl > P.outer - 1.05) wallHit(c, Tr, ni, s, P.outer - 1.05);
    else if (!gap && c.inPitRoad) wallHit(c, Tr, ni, -s, -(P.wall + 1.65));
  } else if (Math.abs(c.lat) > lim) wallHit(c, Tr, ni, s, lim);
  // the wall between a pit exit lane and the track (Interlagos): solid from both sides
  const mw = mergeWallAt(Tr, ni);
  if (mw && s === P.side) { const p2 = P.side * c.lat; if (p2 < mw) wallHit(c, Tr, ni, s, mw - 1.05); else wallHit(c, Tr, ni, -s, -(mw + 1.05)); }
}
/* ---- Player chassis model ----
   Bicycle model with Pacejka-style tyres: separate front/rear slip angles, a friction circle per axle
   (braking or driving uses up cornering grip), lock-ups, longitudinal weight transfer (trail-braking
   rotation, power oversteer), yaw inertia, and speed-dependent grip from downforce. The total grip
   envelope matches the AI's (18 + 0.25 v) m/s², so racing stays fair. Forces are per unit mass. */
// rearGrip > 1 gives the slight stability bias real cars run; muX = tyres grip harder in a straight line than sideways
// air drag: DRS opens the rear wing (big cut), a tow behind another car cuts it further
const dragK = c => 0.00028 * ((c.spec && c.spec.drag) || 1) * (c.drsOpen ? 0.58 : 1) * (1 - 0.35 * (c.tow || 0));
const DYN = { L: 3.6, a: 1.98, b: 1.62, h: 0.3, k2: 2.0, B: 16.7, C: 1.6, brakeF: 0.6, rearGrip: 1.1, muX: 1.35 };
const tyreCurve = a => Math.sin(DYN.C * Math.atan(DYN.B * a));
function dynStep(c, inp, dt, grip, vm, bankA, st, surf, d) {
  // rally cars: a gentler tyre curve that keeps most of its grip at big slip angles, a slightly loose rear,
  // less yaw damping and four-wheel drive, so they hang the tail out in long, catchable slides
  const SL = c.spec && c.spec.slide, tB = SL ? SL.B : DYN.B, tC = SL ? SL.C : DYN.C, tyre = SL ? (a => Math.sin(tC * Math.atan(tB * a))) : tyreCurve;
  const P = DYN, sh0 = Math.sin(c.h), ch0 = Math.cos(c.h);
  const vx0 = c.v * Math.sin(c.vh), vz0 = c.v * Math.cos(c.vh);
  let u = vx0 * sh0 + vz0 * ch0, vl = vx0 * ch0 - vz0 * sh0, r = (c.r || 0) + c.spin; c.spin = 0;
  c.lock = false; c.scrub = 0;
  if (u < 6) {
    // walking pace and reverse: simple, stable kinematic steering
    if (inp.throttle > 0) u += (u < -0.2 ? 28 : 9 * Math.min(1, 0.45 + 0.6 * grip)) * inp.throttle * dt;
    if (inp.brake > 0) { if (u > 0.4) u = Math.max(0, u - 36 * grip * inp.brake * dt); else if (inp.throttle === 0) u = Math.max(u - 7 * dt, -12); }
    const dec = (0.3 + (inp.throttle === 0 ? 1.2 : 0) + DRAG[surf] * Math.abs(u)) * dt;
    if (u > 0) u = Math.max(0, u - dec); else if (u < 0) u = Math.min(0, u + dec);
    vl *= Math.exp(-10 * dt);
    const rk = u * Math.tan(st * 0.42) / P.L;
    r += (rk - r) * Math.min(1, dt * 12);
  } else {
    const mu = 2.0 * grip, Ntot = 9 + 0.125 * u + Math.max(0, bankA) / 2;
    const Cfast = tB * tC * mu * Ntot;                       // total cornering stiffness (per rad)
    const n = Math.min(10, Math.max(1, Math.ceil(dt / (0.7 * u / Cfast))));
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      const drive = SL && inp.hb ? 0 : inp.throttle > 0 ? 11.5 * (c.boost || 1) * (c.spec ? c.spec.power : 1) * inp.throttle * Math.max(0, 1 - (u / vm) ** 2) * (surf >= 3 ? 0.55 : 1) : 0;
      // braking is the original strong, consistent braking (no lock-ups)
      const brake = (inp.brake > 0 ? 36 * grip * (c.spec ? c.spec.brake : 1) * inp.brake : 0) + (SL && inp.hb ? 7 : 0);
      const drag = 0.3 + dragK(c) * u * u + (inp.throttle === 0 ? 1.2 : 0) + DRAG[surf] * u + (d.punct ? 0.05 * u : 0);
      // longitudinal weight transfer: braking loads the front, acceleration loads the rear
      const dN = clamp((drive - drag) * P.h / P.L, -4, 4);
      const Nf = Math.max(0.5, Ntot * 0.45 - dN), Nr = Math.max(0.5, Ntot * 0.55 + dN);
      // speed-sensitive steering: plenty of lock in slow corners, much less at high speed
      // (peak front grip arrives a little before full lock, so there is steering in reserve)
      const delta = st * clamp(0.05 + 1.2 * P.L * mu * Ntot / (u * u), 0.05, SL ? SL.lock : 0.4);
      const hb = SL && inp.hb, muR = mu * (SL ? SL.rearGrip : P.rearGrip) * (hb ? 0.32 : 1), xF = P.muX * mu * Nf, xR = P.muX * muR * Nr;
      // braking/driving use up some cornering grip (friction ellipse), never all of it
      const useF = SL && SL.awd ? Math.min(0.6, 0.4 * drive / xF) : 0, useR = SL && SL.awd ? Math.min(0.95, 0.75 * drive / xR) : Math.min(0.85, drive / xR);
      const capF = mu * Nf * Math.sqrt(1 - useF * useF), capR = muR * Nr * Math.sqrt(1 - useR * useR);
      const af = Math.atan2(vl + P.a * r, u) - delta, ar = Math.atan2(vl - P.b * r, u);
      const Fyf = -capF * tyre(af), Fyr = -capR * tyre(ar);
      const cd = Math.cos(delta), sd = Math.sin(delta);
      const du = drive - brake - Fyf * sd - drag + vl * r;
      const dvl = Fyf * cd + Fyr - u * r;
      const dr = (P.a * Fyf * cd - P.b * Fyr) / P.k2;
      u = Math.max(0, u + du * h); vl += dvl * h; r += dr * h;
      // yaw damping grows with speed: aero stability keeps the car calm in fast corners
      r *= Math.exp(-(SL ? SL.yawDamp + 0.008 * u : 0.5 + 0.02 * u) * h);
      c.scrub = Math.max(c.scrub, Math.abs(af) > 0.14 ? Math.min(1, (Math.abs(af) - 0.14) * 6) : 0);
    }
  }
  c.r = r; c.h += r * dt;
  const sh = Math.sin(c.h), ch = Math.cos(c.h), wx = u * sh + vl * ch, wz = u * ch - vl * sh;
  setVel(c, wx, wz);
  c.x += wx * dt; c.z += wz * dt;
  c.slip = Math.abs(c.v) > 2 ? angDiff(c.h, c.vh) : 0;
  return r;
}

/* push the car back from a barrier on side d (+1 left, -1 right) at lateral distance L along d, and bounce */
function wallHit(c, Tr, ni, d, L) {
  const pen = c.lat * d - L; if (pen <= 0) return;
  const ox = Tr.nx[ni] * d, oz = Tr.nz[ni] * d;
  c.x -= ox * pen; c.z -= oz * pen; c.lat -= d * pen;
  let vx = c.v * Math.sin(c.vh), vz = c.v * Math.cos(c.vh);
  const vn = vx * ox + vz * oz;
  if (vn <= 0) return;
  // bounce off the barrier, keep most of the sliding speed along it
  vx -= 1.25 * vn * ox; vz -= 1.25 * vn * oz;
  const fr = 1 - 0.35 * Math.min(1, vn / 12); vx *= fr; vz *= fr;
  setVel(c, vx, vz);
  const fx = Math.sin(c.h), fz = Math.cos(c.h), fdot = fx * ox + fz * oz;
  const th = Math.atan2(Tr.tx[ni], Tr.tz[ni]), tgt = (fx * Tr.tx[ni] + fz * Tr.tz[ni]) >= 0 ? th : th + Math.PI;
  c.h += angDiff(tgt, c.h) * Math.min(0.5, 0.15 + vn * 0.02);
  c.spin += -d * (fdot > 0 ? 1 : -1) * Math.min(3, vn * 0.12) * (1 - Math.abs(fdot));
  if (vn > 4) { c.hitT = Math.min(1, vn / 25); c.hitSide = d; if (c.isPlayer) c.impact = Math.min(1, vn / 20); damage(c, vn, fdot > 0.55 ? 'front' : fdot < -0.55 ? 'rear' : 'side'); }
}

/* VIP quick chat in online races: preset messages only, shown to everyone in the race */
function quickChat(k) {
  if (!game.mp || !isVip() || !QCHAT[k]) return;
  const now = performance.now(); if (now - (game.chatT || 0) < 1500) return; game.chatT = now;
  net.broadcast('chat', { k }); radio('★ You: ' + QCHAT[k], 'info', 3);
}
/* VIP Time Trial medals: gold, silver and bronze target times for your car on every track */
function medalTimes() { const Tr = game.T, sp = (game.player && game.player.spec) || CLASSES.f1, est = estimateLap(Tr, 1, null, 1, sp); return [est, est * 1.04, est * 1.09]; }
const medalKey = () => 'apexgp-medal-' + serKey(game.T.def.id);
function ttMedal(lt) {
  if (!isVip() || game.mp) return;
  const [g, sv, b] = medalTimes(), m = lt <= g ? 3 : lt <= sv ? 2 : lt <= b ? 1 : 0; if (!m) return;
  const best = +(store.get(medalKey()) || 0);
  if (m > best) { store.set(medalKey(), String(m)); flashMsg(['', 'BRONZE MEDAL', 'SILVER MEDAL', 'GOLD MEDAL'][m], 2.5, fmt(lt)); radio(['', 'Bronze medal! Silver is ' + fmt(sv) + '.', 'Silver medal! Gold is ' + fmt(g) + '.', 'GOLD MEDAL! Mega lap, mate!'][m], 'good', 5); }
}
/* VIP Time Trial ghost: your best lap is recorded and replayed as a see-through car to race against */
const ghostKey = () => 'apexgp-ghost2-' + serKey(game.T.def.id);   // v2: old Nordschleife ghosts were recorded the wrong way round
function ghostLap(lt, valid) {
  const G = game.ghost || (game.ghost = { rec: [], start: null });
  if (valid && G.rec.length > 20 && G.start !== null) {
    let best = null; try { best = JSON.parse(store.get(ghostKey()) || 'null'); } catch (e) { /* none */ }
    if (!best || lt < best.t) { const data = { t: lt, f: G.rec }; try { store.set(ghostKey(), JSON.stringify(data)); } catch (e) { /* storage full */ } G.data = data; if (isVip() && settings.vipGhost !== false) flashMsg('GHOST SAVED', 1.5, fmt(lt)); }
  }
  G.rec = []; G.start = game.raceTime;
}
function ghostTick(dt) {
  const p = game.player, on = p && game.session === 'tt' && isVip() && settings.vipGhost !== false && !game.mp;
  const G = game.ghost;
  if (!on) { if (G && G.car) { scene.remove(G.car.group); disposeCar(G.car); G.car = null; } return; }
  const g = game.ghost || (game.ghost = { rec: [], start: null });
  if (g.key !== ghostKey()) { g.key = ghostKey(); g.data = null; try { g.data = JSON.parse(store.get(g.key) || 'null'); } catch (e) { g.data = null; } if (g.car) { scene.remove(g.car.group); disposeCar(g.car); g.car = null; } }
  if (g.start === null) return;
  const t = game.raceTime - g.start; if (t < 0) { g.start = null; g.rec = []; return; }
  // record this lap (10 per second)
  if (!g.rec.length || t - g.rec[g.rec.length - 1][0] >= 0.1) g.rec.push([+t.toFixed(2), +p.x.toFixed(1), +p.z.toFixed(1), +p.h.toFixed(3), +p.group.position.y.toFixed(2)]);
  if (!g.data || !g.data.f || g.data.f.length < 2) return;
  if (!g.car) {
    g.car = makeCar({ color: '#ffffff', accent: '#d4af37', number: myNum(), model: p.spec ? p.spec.model : 'f1' });
    g.car.group.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.28; o.material.depthWrite = false; } });
    scene.add(g.car.group);
  }
  const F = g.data.f; let k = g.ki || 0; if (k >= F.length || F[k][0] > t) k = 0; while (k < F.length - 2 && F[k + 1][0] <= t) k++; g.ki = k;
  const a = F[k], b = F[Math.min(F.length - 1, k + 1)], u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  g.car.group.visible = t <= F[F.length - 1][0];
  g.car.group.position.set(a[1] + (b[1] - a[1]) * u, a[4] + (b[4] - a[4]) * u, a[2] + (b[2] - a[2]) * u);
  g.car.group.rotation.set(0, a[3] + angDiff(b[3], a[3]) * u, 0);
}
/* driving the wrong way round the track: warnings, then disqualified after 15 seconds of it */
function wrongWay(c, dt, Tr) {
  if (game.derby) return;
  if (!isRace() || !racing() || c.dnf || c.finished || c.pit) { c.wrongT = 0; return; }
  const along = c.v * (Math.sin(c.vh) * Tr.tx[c.idx] + Math.cos(c.vh) * Tr.tz[c.idx]);
  if (along < -2) c.wrongT = (c.wrongT || 0) + dt; else if (along > 3) c.wrongT = Math.max(0, (c.wrongT || 0) - dt * 3);
  if (!c.isPlayer) return;
  const left = 15 - (c.wrongT || 0), sec = Math.ceil(left);
  if (c.wrongT > 2 && sec !== c.wrongSaid && sec >= 1 && (sec % 5 === 0 || sec <= 3)) { c.wrongSaid = sec; radio('WRONG WAY! Turn around or you will be disqualified in ' + sec + ' s.', 'bad', 2.5); }
  if (c.wrongT >= 15) disqualify(c, 'driving the wrong way');
}
function disqualify(c, why) {
  if (c.dnf) return;
  c.dsq = why; retire(c, 'dsq');
  if (c.isPlayer) { radio('You have been DISQUALIFIED for ' + why + '.', 'bad', 8); if (game.mp) net.broadcast('dsq', { why }); }
  else radio(c.code + ' has been disqualified for ' + why + '.', 'warn', 5);
}
/* Car retiring: coast to the side of the track and park */
function retire(c, why) {
  if (c.dnf) return;
  c.dnf = true; c.drsOpen = false; c.retire = { why, side: c.lat >= 0 ? 1 : -1, dmg: { ...c.dmg } };
  if (c.isPlayer) { if (why !== 'dsq' && why !== 'wrecked') radio(why === 'accident' ? 'Car is too badly damaged. We have to retire it. Sorry.' : 'We have to retire the car.', 'bad', 8); game.resultsAt = game.raceTime + 3; }
  else if (isRace() && why !== 'dsq') radio('Yellow flag: ' + c.code + ' is out of the race.', 'warn', 4);
  if (why === 'accident') incident(c.code + ' has crashed');
}
function retireStep(c, dt, Tr) {
  c.v = Math.max(0, c.v - 10 * dt);
  const lim = (c.retire.side > 0 ? Tr.limL[c.idx] : Tr.limR[c.idx]) - 1.6;
  c.lat += (c.retire.side * lim - c.lat) * Math.min(1, dt * 0.8);
  const ds = c.v * dt / DS; c.prog += ds;
  const i0 = Math.floor(((c.prog % Tr.N) + Tr.N) % Tr.N) % Tr.N;
  c.idx = i0; c.x = Tr.px[i0] + Tr.nx[i0] * c.lat; c.z = Tr.pz[i0] + Tr.nz[i0] * c.lat;
  c.h += angDiff(Math.atan2(Tr.tx[i0], Tr.tz[i0]) + c.retire.side * 0.5, c.h) * Math.min(1, dt); c.vh = c.h;
}

/* ---------------- Pit lane ---------------- */
/* Between the two blue limiter lines the car runs on the limiter: it follows the fast lane,
   swings into its box (box lane) if it is stopping, then back out to the fast lane. Entry and
   exit roads either side of the limiter lines are driven normally. */
function pitLat(c, k, Tr) {
  const P = Tr.pit, kb = boxK(c, Tr);
  let lat = P.fast;
  if (k < P.limIn + 14) lat = c.pit.lat0 + (P.fast - c.pit.lat0) * smooth(P.limIn - 1, P.limIn + 14, k);
  if (c.pit.stopAtBox) {
    if (k > kb - 16 && k <= kb) lat = P.fast + (P.lat - P.fast) * smooth(kb - 16, kb, k);
    else if (k > kb && k < kb + 16) lat = P.lat + (P.fast - P.lat) * smooth(kb, kb + 16, k);
  }
  return lat;
}
function pitPose(c, Tr) {
  const P = Tr.pit, k = c.pit.k, i0 = (P.entry + Math.floor(k)) % Tr.N, i1 = (i0 + 1) % Tr.N, f = k - Math.floor(k);
  const lat = pitLat(c, k, Tr), lat2 = pitLat(c, k + 1, Tr);
  const px = Tr.px[i0] + (Tr.px[i1] - Tr.px[i0]) * f, pz = Tr.pz[i0] + (Tr.pz[i1] - Tr.pz[i0]) * f;
  c.x = px + Tr.nx[i0] * lat; c.z = pz + Tr.nz[i0] * lat; c.idx = i0; c.lat = lat;
  c.h = c.vh = Math.atan2(Tr.tx[i0], Tr.tz[i0]) - Math.atan2(lat2 - lat, DS) * 1;
}
function pitStep(c, dt, Tr) {
  const p = c.pit, P = Tr.pit, kb = boxK(c, Tr);
  if (p.stage === 'garage') { c.v = 0; pitPose(c, Tr); return; }
  if (p.stage === 'stop') {
    c.v = 0; p.wait -= dt;
    const prog = clamp(1 - p.wait / p.total, 0, 1);
    world.crewAnim(c.teamIdx, prog);
    c.lift = 0.08 * clamp((prog - 0.04) / 0.06, 0, 1) * (1 - clamp((prog - 0.8) / 0.06, 0, 1));
    // wheels come off and go back on in the middle of the stop
    const tyresOff = p.wait < p.total * 0.75 && p.wait > p.total * 0.3;
    c.wheels.forEach(w => w.spin.visible = !tyresOff);
    if (p.wait <= 0) { p.stage = 'out'; c.lift = 0; c.wheels.forEach(w => w.spin.visible = true); if (c.isPlayer) radio('Go, go, go!', 'good', 2); }
    pitPose(c, Tr); return;
  }
  let target = 22;
  if (p.stage === 'in' && p.stopAtBox) {
    const d = (kb - p.k) * DS; target = Math.min(22, Math.sqrt(Math.max(0, 2 * 9 * d)));
    if (d < 90 && !p.crewReady) { p.crewReady = true; world.crewPose(c.teamIdx, true, c); }
    if (d <= 0.5) { p.stage = 'stop'; c.v = 0; serviceCar(c); p.total = p.wait; if (!p.crewReady) { p.crewReady = true; world.crewPose(c.teamIdx, true, c); } world.crewAnim(c.teamIdx, 0); pitPose(c, Tr); return; }
  }
  if (p.stage === 'out' && !p.crewBack && p.k > kb + 10) { p.crewBack = true; world.crewPose(c.teamIdx, null); }
  else if (p.stage === 'out' && !p.crewBack && p.crewReady) world.crewAnim(c.teamIdx, 1 + (p.k - kb) / 10);
  else if (p.stage === 'in' && p.crewReady) world.crewAnim(c.teamIdx, -1);
  c.v = c.v > target ? Math.max(target, c.v - 28 * dt) : Math.min(target, c.v + 9 * dt);
  const dk = c.v * dt / DS; p.k += dk; c.prog += dk;
  if (p.k >= P.limOut) {
    // past the exit limiter line: hand control back to the driver on the pit-exit road
    if (!p.crewBack) world.crewPose(c.teamIdx, null);
    pitPose(c, Tr); c.pit = null; c.inPitRoad = true; c.pitReq = false; c.pitExitT = game.raceTime;
    c.laneOff = 0; c.laneTarget = 0;
    if (c.isPlayer) radio('Limiter off. Watch the white line on pit exit.', 'info', 3);
    return;
  }
  pitPose(c, Tr);
}
function nextCompound(c) {
  if (c.isPlayer && c.tyreChoice) return c.tyreChoice; // the player picked it over the radio
  const w = weather.average(), used = c.stints || [];
  if (w > 0.55) return 'wet';
  if (w > 0.2) return 'inter';
  const plan = c.plan && c.plan[c.planIdx + 1];
  if (plan && SLICK(plan[0]) && !SLICK(c.tyre.comp) === false) return plan[0];
  if (plan) return plan[0];
  const lapsLeft = game.laps - curLap(c);
  if (!used.includes('hard') && lapsLeft > game.laps * 0.4) return 'hard';
  return used.includes('medium') ? (lapsLeft < game.laps * 0.35 ? 'soft' : 'hard') : 'medium';
}
function serviceCar(c) {
  let t = 2.2 + Math.random() * 0.6; const notes = [];
  if (Math.random() < 0.05) { t += 2.5; notes.push('slow stop, sorry'); }
  if (c.dmg.fw > 0.05) { t += 6.5; c.dmg.fw = 0; c.fwing.visible = true; notes.push('new front wing'); }
  if (c.dmg.rw > 0.05) { t += 8; c.dmg.rw = 0; c.rwing.visible = true; notes.push('new rear wing'); }
  c.dmg.punct = false;
  if (isRace() || c.isPlayer) {
    const wq = weather.average(), comp = isRace() ? nextCompound(c) : (wq > 0.55 ? 'wet' : wq > 0.2 ? 'inter' : 'soft');
    if (c.plan && c.plan[c.planIdx + 1] && c.plan[c.planIdx + 1][0] === comp) c.planIdx++;
    else if (c.plan) c.planIdx++;
    setTyres(c, comp);
  }
  c.pits++; c.pitReq = false; c.pit.wait = t;
  if (c.isPlayer) radio('Stop ' + t.toFixed(1) + 's. ' + COMP[c.tyre.comp].name + 's fitted' + (notes.length ? ', ' + notes.join(', ') : '') + '.', 'info', 5);
}

/* ---------------- Damage ---------------- */
function damage(c, impact, where, scale = 1) {
  if (game.derby) return;   // the derby uses its own bus health
  if (rule('damage') === 'off' || settings.mode === 'tt' || game.mp) return; // time trial: never any damage
  const k = (rule('damage') === 'reduced' ? 0.5 : 1) * scale, d = c.dmg, before = { ...d };
  if (impact < 5 || k <= 0) return;
  if (where === 'front') d.fw = Math.min(1, d.fw + impact * k / 22);
  else if (where === 'rear') d.rw = Math.min(1, d.rw + impact * k / 28);
  else { d.susp = Math.min(1, d.susp + Math.max(0, impact - 9) * k / 40); d.pull = clamp(d.pull + (Math.random() < 0.5 ? -1 : 1) * Math.max(0, impact - 7) * k / 300, -0.14, 0.14); }
  if (impact > 15 && Math.random() < 0.3 * k) d.punct = true;
  if (d.fw >= 0.85 && c.fwing.visible) { c.fwing.visible = false; c.fwing.userData.lodPrev = false; debris(c, 1.9); if (racing() && !game.flag && Math.random() < 0.35) deployFlag('vsc', 'debris on track'); }
  if (d.rw >= 0.9 && c.rwing.visible) { c.rwing.visible = false; c.rwing.userData.lodPrev = false; debris(c, -2.3); }
  if (impact > 30 / Math.max(k, 0.3) || d.susp >= 1) { retire(c, 'accident'); return; }
  if (c.isPlayer && isRace()) {
    if (d.fw - before.fw > 0.15) radio(d.fw > 0.6 ? 'Front wing is badly damaged. Box this lap.' : 'We have some front wing damage. Car will understeer.', d.fw > 0.6 ? 'bad' : 'warn');
    else if (d.rw - before.rw > 0.15) radio('Rear wing damage. Expect less grip at the rear.', 'warn');
    else if (d.susp - before.susp > 0.1) radio('Suspension damage. The car will pull to one side.', 'warn');
    if (d.punct && !before.punct) radio('Puncture! Bring it back to the pits.', 'bad');
    if (d.fw > 0.6 || d.punct) c.pitReq = true;
  }
}
const DEBRIS = new THREE.Color('#1a1b1f');
function debris(c, zOff) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h), ey = c.group.position.y;
  for (let k = 0; k < 26; k++) smoke.spawn(c.x + fx * zOff, ey + 0.3, c.z + fz * zOff, fx * c.v * 0.6 + (Math.random() - 0.5) * 6, 2 + Math.random() * 4, fz * c.v * 0.6 + (Math.random() - 0.5) * 6, 1.6 + Math.random(), 0.35, 0.3, 1, DEBRIS, 0.6, 9.8);
}

/* ---------------- Driver inputs ---------------- */
/* steering feel: how fast the wheel turns and how much it calms down at speed */
const STEER = { smooth: { rate: 0.7, back: 0.85, speed: 1.25 }, normal: { rate: 1, back: 1, speed: 1 }, sharp: { rate: 1.45, back: 1.25, speed: 0.8 } };
/* game controller: left stick (or d-pad) steers, right trigger accelerates, left trigger brakes */
function padInput() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) {
    if (!g || !g.connected) continue;
    let x = g.axes[0] || 0; if (Math.abs(x) < 0.08) x = 0; else x = Math.sign(x) * ((Math.abs(x) - 0.08) / 0.92) ** 1.4;
    if (g.buttons[14] && g.buttons[14].pressed) x = -1; if (g.buttons[15] && g.buttons[15].pressed) x = 1;
    const thr = Math.max(g.buttons[7] ? g.buttons[7].value : 0, g.buttons[0] && g.buttons[0].pressed ? 1 : 0), brk = Math.max(g.buttons[6] ? g.buttons[6].value : 0, g.buttons[1] && g.buttons[1].pressed ? 1 : 0);
    const hb = !!(g.buttons[2] && g.buttons[2].pressed);
    if (x || thr > 0.02 || brk > 0.02 || hb) return { steer: -x, thr, brk, hb };
  }
  return null;
}
function playerInput(c, dt) {
  const S = STEER[settings.steer] || STEER.normal, pad = padInput();
  const slow = 1 + Math.max(0, Math.abs(c.v) - 25) / (35 * S.speed);
  if (pad) {
    // analog: follow the stick closely, with less lock at speed
    const want = pad.steer / Math.sqrt(slow);
    c.steer += clamp(want - c.steer, -9 * S.rate * dt, 9 * S.rate * dt);
    return { throttle: pad.thr, brake: pad.brk, steer: c.steer, hb: pad.hb || !!keys.hb };
  }
  const tgt = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
  // keyboard: the wheel winds on progressively the longer the key is held, and snaps back quicker when released
  c.held = tgt === 0 ? 0 : (Math.sign(tgt) === Math.sign(c.held || 0) ? c.held + dt : dt);
  const build = 0.6 + Math.min(1, c.held / 0.35) * 0.6;
  const rate = (tgt === 0 ? 7 * S.back : (c.steer !== 0 && Math.sign(tgt) !== Math.sign(c.steer) ? 9 : 4.2 * build) * S.rate) / slow;
  c.steer += clamp(tgt - c.steer, -rate * dt, rate * dt);
  return { throttle: keys.w ? 1 : 0, brake: keys.s ? 1 : 0, steer: c.steer, hb: !!keys.hb };   // Space: handbrake (rally cars)
}

function aiInput(c, dt, Tr) {
  if (game.derby) return derbyAI(c, dt);
  const N = Tr.N;
  c.blockT -= dt; c.yieldT -= dt; c.attackT = (c.attackT || 0) - dt; c.defT = (c.defT || 0) - dt; c.mistT = (c.mistT || 0) - dt;
  // ovals: cars hold their lane (packs run two and three wide); road courses: drift back to the racing line
  const oval = !!Tr.def.oval;
  if (c.blockT <= 0) c.laneTarget *= Math.pow(oval ? 0.93 : 0.5, dt);
  const per = c.per || personaOf(c.code), straight = Math.abs(Tr.curv[c.idx]) < 0.004;
  const flagged = !!(game.flag && (game.flag.type === 'sc' || game.flag.type === 'vsc') && racing());
  // only start an overtaking move when there is a straight ahead, not into or through a corner
  let clearRun = true; for (let k = 0; k < 30; k += 3) if (Math.abs(Tr.curv[(c.idx + k) % N]) > 0.006) { clearRun = false; break; }
  let follow = Infinity, pressure = false;
  for (const o of game.cars) {
    if (o === c || !o.active || o.pit) continue;
    const dp = o.prog - c.prog;
    if (flagged) {
      // Safety Car / VSC: no overtaking at all; hold station behind whoever is ahead
      // (the Safety Car queue itself is handled by flagSpeed; this only stops anyone driving into/past the car ahead)
      if (dp > 0 && !o.dnf && !o.inPitRoad && (dp < 5 || (game.flag.type === 'vsc' && dp < 10))) follow = Math.min(follow, Math.max(0, o.v - (dp < 4 ? 2.5 : 0.3)));
      continue;
    }
    if (Math.abs(dp) <= 3 && Math.abs(o.lat - c.lat) < 3.6) {
      const want = clamp(o.lat + (c.lat >= o.lat ? 3.8 : -3.8), -(W - 1.2), W - 1.2);
      if (Math.abs(want - o.lat) >= 3) { c.laneTarget = want - Tr.race[c.idx]; c.blockT = Math.max(c.blockT, 0.8); }
    }
    if (dp > 0 && dp < 10 + 10 * per.agg && Math.abs(o.lat - c.lat) < 2.6) {
      if ((c.v > o.v - 0.5 && (clearRun || dp < 4)) || o.dnf) {
        const leftRoom = W - 1.4 - o.lat, rightRoom = o.lat + W - 1.4;
        c.laneTarget = clamp((leftRoom > rightRoom ? o.lat + 3.0 : o.lat - 3.0) - Tr.race[c.idx], -2 * W, 2 * W); c.blockT = 1.6;
        if (!o.dnf) c.attackT = 1.2;
      }
    }
    // car-following: in line with a car ahead, keep a speed-dependent gap (brake early, not into its gearbox)
    if (dp > 0 && dp < (oval ? 24 : 16) && !o.dnf && Math.abs(o.lat - c.lat) < (oval ? 3.2 : 2.4)) {
      const gap = dp * DS - 2.5, want = (oval ? 9 : 6) + o.v * (oval ? 0.16 : 0.12);
      follow = Math.min(follow, o.v + (gap - want) * 0.7);
    }
    // multi-class (Le Mans): a car from a faster class closing in behind gets waved through
    if (dp < -1 && dp > -18 && !o.dnf && o.spec && c.spec && o.spec.vmax > c.spec.vmax + 0.05) {
      c.laneTarget = clamp((o.lat >= c.lat ? -1 : 1) * (W - 1.6) - Tr.race[c.idx], -2 * W, 2 * W); c.blockT = 0.8; continue;
    }
    // defending: a faster car close behind on a straight gets one move to cover the inside
    if (dp < -2 && dp > -14 && !o.dnf && !o.finished) {
      pressure = true;
      if (racing() && straight && c.defT <= 0 && c.yieldT <= 0 && !game.flag && !(c.mate && o.isPlayer) && o.v > c.v - 1) {
        c.defT = 6;
        if (Math.random() < per.def * 0.6) { c.laneTarget = clamp(c.lat + (o.lat - c.lat) * 0.6, -(W - 1.4), W - 1.4) - Tr.race[c.idx]; c.blockT = 1.2; }
      }
    }
  }
  const P = Tr.pit, toEntry = (P.entry - c.idx + N) % N, inEntryRoad = ((c.idx - P.entry + N) % N) < P.limIn + 2;
  const pitting = c.pitReq && !c.pit && ((toEntry < 140 && toEntry > 0) || inEntryRoad);
  if (c.yieldT > 0) { c.laneTarget = clamp((c.lat >= 0 ? W - 1.6 : -(W - 1.6)) - Tr.race[c.idx], -2 * W, 2 * W); c.blockT = 0.5; }
  if (flagged) { c.laneTarget = 0; c.blockT = 0; }
  c.laneOff += (c.laneTarget - c.laneOff) * Math.min(1, dt * 1.6);
  // precise line following: short look-ahead + feed-forward of the line's curvature + lateral error correction
  const sp0 = Math.max(Math.abs(c.v), 5);
  const ti = (c.idx + Math.round((5 + sp0 * 0.2) / DS)) % N;
  const edge = W - 1.1;
  let off = clamp(Tr.race[ti] + c.laneOff, -edge, edge);
  const pathAhead = pitPathLat(c, ti, Tr), pathHere = pitPathLat(c, c.idx, Tr);
  if (pathAhead !== null) off = pathAhead;
  const wide = pathHere !== null || pathAhead !== null ? 0 : Math.abs(c.lat) - (W - 0.5);   // on a pit road: not running wide
  if (wide > 0) off -= Math.sign(c.lat) * Math.min(3, wide * 2);
  let tgtH = Math.atan2(Tr.px[ti] + Tr.nx[ti] * off - c.x, Tr.pz[ti] + Tr.nz[ti] * off - c.z);
  // after a spin, line the car back up with the track before going again
  const trackH = Math.atan2(Tr.tx[c.idx], Tr.tz[c.idx]), facing = Math.abs(angDiff(trackH, c.h));
  if (facing > 1.2 && Math.abs(c.v) < 6) { c.h += angDiff(trackH, c.h) * Math.min(1, dt * 1.5); c.vh = c.h; }
  const err = angDiff(tgtH, c.h) - c.slip * 0.6;
  const maxYaw = Math.max(0.05, Math.min(sp0 * Math.tan(0.42) / 3.6, (18 + 0.25 * sp0) * (c.gripNow || 1) / sp0));
  const ahead = (c.idx + Math.round(sp0 * 0.06 / DS)) % N;
  const ff = (pathHere !== null ? pitPathK(c, ahead, Tr) : Tr.rk[ahead]) * sp0 / maxYaw;
  const latErr = (pathHere !== null ? pathHere : clamp(Tr.race[c.idx] + c.laneOff, -edge, edge)) - c.lat;
  const want = clamp(ff + err * 2.2 + latErr * (pathHere !== null ? 0.12 : 0.05), -1, 1);
  c.steer += clamp(want - c.steer, -10 * dt, 10 * dt);
  let target = Infinity;
  const pp = speedProfiles(Tr, c.spec || CLASSES.f1), prof = c.lateBrake ? pp[1] : pp[0];
  for (let k = 1; k <= 6; k++) target = Math.min(target, prof[(c.idx + k) % N]);
  // on a pit road (Spa: the exit lane round the inside of La Source) the corner speed is set by that road's own radius
  if (pathHere !== null) for (let k = 0; k <= 12; k += 3) { const kp = Math.abs(pitPathK(c, (c.idx + k) % N, Tr)); if (kp > 1e-3) target = Math.min(target, Math.sqrt(17 * (c.gripNow || 1) / kp)); }
  // going over the limit only pays in slow corners; in fast sweepers the best AI drive exactly on it
  const pace = c.pace > 1 ? 1 + (c.pace - 1) * clamp((72 - target) / 30, 0, 1) : c.pace;
  target = Math.min(target * pace * Math.sqrt(Math.min(1.04, c.gripTD || 1) * (c.boost || 1)) * (c.yieldT > 0 ? 0.9 : 1), follow);
  // aggressive drivers brake later when they are attacking
  if (c.attackT > 0 && clearRun) target *= 1 + 0.012 * per.agg;
  if (racing() && c.maxDone < 0 && game.raceTime < 40 && !clearRun) target *= 0.96;
  if (oval && !clearRun) target *= 0.975; // a little margin into oval turns, where everyone is close together
  // mistakes: lock-ups and running wide, more likely in the wet and under pressure
  if (racing() && !game.flag && c.mistT <= -4 && c.v > 30 && c.v > target + 4) {
    const rate = (1 - per.cons) * 0.008 * (weather.wetAt(c.idx) > 0.3 ? 2.5 : 1) * (pressure ? 1.8 : 1);
    if (Math.random() < rate * dt) {
      c.mistT = 1.1; c.lockFx = 0.45;
      const p = game.player;
      if (p && !p.dnf && Math.abs(c.prog - p.prog) < 350 && clock - (game.mistSaid || -99) > 12) { game.mistSaid = clock; radio(c.code + (Math.random() < 0.5 ? ' has locked up and gone wide!' : ' has made a mistake, run wide!'), 'good', 4); }
    }
  }
  if (c.mistT > 0) target *= 1.06;
  if (c.lockFx > 0) c.lockFx -= dt;
  if (wide > 0) target = Math.min(target, c.v * (1 - Math.min(0.08, wide * 0.03)));
  if (c.surf >= 3) target = Math.min(target, 35);
  if (c.dmg.punct) target = Math.min(target, 28);
  if (pitting) { const dl = ((P.entry + P.limIn - c.idx + N) % N) * DS; target = Math.min(target, Math.sqrt(21.5 * 21.5 + 2 * 16 * dl)); }
  if (game.flag && racing()) target = Math.min(target, flagSpeed(c, Tr, target));
  let throttle = 0, brake = 0;
  if (c.v < target - 0.25) throttle = facing > 1.2 ? 0.4 : 1; else if (c.v > target + 0.6) brake = clamp((c.v - target) / 3, 0.3, 1); else throttle = 0.7;
  return { throttle, brake, steer: c.steer };
}

/* signed curvature of an AI car's pit road path at sample i (same convention as the racing line's Tr.rk) */
function pitPathK(c, i, Tr) {
  const N = Tr.N, pt = j => { j = (j + N) % N; const l = pitPathLat(c, j, Tr) ?? Tr.race[j]; return [Tr.px[j] + Tr.nx[j] * l, Tr.pz[j] + Tr.nz[j] * l]; };
  const [ax, az] = pt(i - 4), [bx, bz] = pt(i), [cx, cz] = pt(i + 4);
  const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d = Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz) * Math.hypot(cx - ax, cz - az);
  return d > 0 ? -2 * cross / d : 0;
}
/* lateral target for an AI car on the pit entry or pit exit road (null when not relevant) */
function pitPathLat(c, i, Tr) {
  const P = Tr.pit, N = Tr.N, kk = (i - P.entry + N) % N, before = (P.entry - i + N) % N, edge = P.side * (W + 0.6);
  if (c.pitReq && !c.pit) {
    if (before > 0 && before < 75) return Tr.race[i] + (edge - Tr.race[i]) * smooth(75, 0, before);
    if (kk <= P.limIn + 2) return edge + (P.fast - edge) * smooth(0, P.limIn - 6, kk);
  }
  if (P.merge && !c.pit && game.raceTime - (c.pitExitT ?? -99) < 25 && kk >= P.limOut - 2 && kk <= P.len + Math.round(P.merge / DS) + 30) { const r2 = pitRoad(Tr, i); if (r2) return P.side * (r2.c ?? (r2.a + r2.b) / 2); }
  if (c.inPitRoad && !c.pit && kk >= P.limOut - 2 && kk < P.len) return P.fast + (P.side * (W - 1.5) - P.fast) * smooth(P.limOut, P.len - 4, kk);
  return null;
}

/* slipstream: being close behind another car (and roughly in line with it) at speed */
function computeTow() {
  const cars = game.cars;
  for (const c of cars) {
    c.tow = 0;
    if (!c.active || c.pit || c.dnf || Math.abs(c.v) < 30) continue;
    const fx = Math.sin(c.h), fz = Math.cos(c.h), lx = Math.cos(c.h), lz = -Math.sin(c.h);
    for (const o of cars) {
      if (o === c || !o.active || o.pit || o.dnf || Math.abs(o.v) < 25) continue;
      const dx = o.x - c.x, dz = o.z - c.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * lx + dz * lz);
      if (ahead < 4 || ahead > 45 || side > 3) continue;
      c.tow = Math.max(c.tow, (1 - (ahead - 4) / 41) * (1 - side / 3));
    }
  }
}

/* ---------------- Collisions (impulse based) ---------------- */
function collide() {
  const cars = game.cars.filter(c => c.active && !c.pit && !c.celebrate && !(c.dnf && Math.abs(c.v) < 1));
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b], dx0 = B.x - A.x, dz0 = B.z - A.z;
    // a car is two overlapping circles along its length; a double-decker is four bigger ones
    const HA = A.closed === 'bus' ? BUS_HIT : CAR_HIT, HB = B.closed === 'bus' ? BUS_HIT : CAR_HIT, reach = HA.reach + HB.reach;
    if (dx0 * dx0 + dz0 * dz0 > reach * reach) continue;
    if (game.T.elev && Math.abs(game.T.elev[A.idx] - game.T.elev[B.idx]) > 3) continue;   // one on a bridge, one underneath
    const fa = [Math.sin(A.h), Math.cos(A.h)], fb = [Math.sin(B.h), Math.cos(B.h)], rr = HA.r + HB.r;
    let best = null;
    for (const oa of HA.offs) for (const ob of HB.offs) {
      const ax = A.x + fa[0] * oa, az = A.z + fa[1] * oa, bx = B.x + fb[0] * ob, bz = B.z + fb[1] * ob, d = Math.hypot(bx - ax, bz - az);
      if (d < rr && d > 1e-4 && (!best || d < best.d)) best = { d, dx: (bx - ax) / d, dz: (bz - az) / d, oa, ob };
    }
    if (!best) continue;
    const { d, dx, dz, oa, ob } = best, push = (rr - d) / 2;
    if (A.remote || B.remote) {
      // online: each player owns their own car, so only the local car is pushed, and gently (lag-friendly)
      if ((A.remote && B.remote) || A.netPit || B.netPit || !A.group.visible || !B.group.visible) continue;
      const L = A.remote ? B : A, sg = L === A ? -1 : 1;
      L.x += sg * dx * push * 1.6; L.z += sg * dz * push * 1.6;
      const vax2 = A.v * Math.sin(A.vh), vaz2 = A.v * Math.cos(A.vh), vbx2 = B.v * Math.sin(B.vh), vbz2 = B.v * Math.cos(B.vh), vn2 = (vbx2 - vax2) * dx + (vbz2 - vaz2) * dz;
      if (vn2 < 0) { const j2 = -vn2 * 0.55; if (L === A) setVel(A, vax2 - j2 * dx, vaz2 - j2 * dz); else setVel(B, vbx2 + j2 * dx, vbz2 + j2 * dz); if (-vn2 > 4) game.player.impact = Math.min(0.6, -vn2 / 25); }
      continue;
    }
    A.x -= dx * push; A.z -= dz * push; B.x += dx * push; B.z += dz * push;
    const vax = A.v * Math.sin(A.vh), vaz = A.v * Math.cos(A.vh), vbx = B.v * Math.sin(B.vh), vbz = B.v * Math.cos(B.vh);
    const vn = (vbx - vax) * dx + (vbz - vaz) * dz;
    if (vn >= 0) continue;
    const cs = -vn, j = cs * (1 + 0.3) / 2;
    setVel(A, vax - j * dx, vaz - j * dz); setVel(B, vbx + j * dx, vbz + j * dz);
    // off-centre hits make cars rotate
    const la = Math.cos(A.h) * dx - Math.sin(A.h) * dz, lb = Math.cos(B.h) * dx - Math.sin(B.h) * dz;
    if (cs > 3) { A.spin += clamp(-oa * j * la * 0.09, -2.5, 2.5); B.spin += clamp(ob * j * lb * 0.09, -2.5, 2.5); }
    if (game.derby && cs > 1.5 && racing()) derbyHit(A, B, cs, fa[0] * dx + fa[1] * dz, -(fb[0] * dx + fb[1] * dz));
    if (cs > 5) {
      const aF = fa[0] * dx + fa[1] * dz, bF = -(fb[0] * dx + fb[1] * dz);
      if (A.isPlayer || B.isPlayer) game.player.impact = Math.min(1, cs / 18);
      A.hitT = B.hitT = Math.min(1, cs / 20); A.hitSide = la > 0 ? 1 : -1; B.hitSide = lb > 0 ? -1 : 1;
      // AI-vs-AI bumps in the pack are softened so races are not decided by AI jostling
      const sc = (A.isPlayer || B.isPlayer) ? 1 : 0.35;
      damage(A, cs * 0.85, aF > 0.55 ? 'front' : aF < -0.55 ? 'rear' : 'side', sc);
      damage(B, cs * 0.85, bF > 0.55 ? 'front' : bF < -0.55 ? 'rear' : 'side', sc);
      if (aF > bF) contactFault(A, B, cs); else contactFault(B, A, cs);
    }
  }
}

const CAR_HIT = { offs: [1.35, -1.35], r: 1.075, reach: 2.6 }, BUS_HIT = { offs: [3.6, 1.2, -1.2, -3.6], r: 1.3, reach: 5.2 };

/* ---------------- London bus demolition derby (VIP): buses ram each other, last one running wins ---------------- */
function derbyHit(A, B, cs, aF, bF) {
  // the bus that is hit side-on or from behind takes more damage than the one doing the ramming
  for (const [c, f] of [[A, aF], [B, bF]]) {
    if (c.dnf) continue;
    c.hp = Math.max(0, (c.hp ?? 100) - cs * 1.4 * (f > 0.55 ? 0.9 : f < -0.55 ? 1.6 : 2.2));
    c.hitT = Math.min(1, cs / 14);
    if (c.hp <= 0) derbyWreck(c);
  }
  if ((A.isPlayer || B.isPlayer) && cs > 4) { game.player.impact = Math.min(1, cs / 14); try { sound.boom(Math.min(0.5, cs / 30)); } catch (e) { /* no sound */ } }
}
function derbyWreck(c) {
  if (c.dnf) return;
  c.wrecked = true; c.derbyOut = ++game.derby.out; retire(c, 'wrecked');
  for (let k = 0; k < 40; k++) smoke.spawn(c.x, c.group.position.y + 2 + Math.random() * 2, c.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 3 + Math.random() * 2, 2, 9, 0.6, DERBY_SMOKE, 0.6);
  radio(c.isPlayer ? 'Your bus is wrecked! You are out of the derby.' : c.name + ' is wrecked! ' + derbyAlive().length + ' buses left.', c.isPlayer ? 'bad' : 'warn', 4);
}
const derbyAlive = () => game.cars.filter(c => c.active && !c.dnf);
function derbyAI(c, dt) {
  // hunt the nearest bus (often the player) and ram it; back out when stuck against a wall
  if (c.dnf) return { throttle: 0, brake: 1, steer: 0 };
  c.huntT = (c.huntT || 0) - dt;
  if (!c.prey || c.prey.dnf || c.huntT <= 0) {
    let best = null, bd = 1e9; for (const o of derbyAlive()) { if (o === c) continue; const d = Math.hypot(o.x - c.x, o.z - c.z) * (o.isPlayer ? 0.7 : 1) * (0.8 + Math.random() * 0.4); if (d < bd) { bd = d; best = o; } }
    c.prey = best; c.huntT = 3 + Math.random() * 3;
  }
  if (Math.abs(c.v) < 1.2 && game.raceTime > 3) c.stuckT = (c.stuckT || 0) + dt; else c.stuckT = Math.max(0, (c.stuckT || 0) - dt);
  if (c.reverseT > 0 || c.stuckT > 1.3) { if (!(c.reverseT > 0)) { c.reverseT = 1.4; c.stuckT = 0; c.revSteer = Math.random() < 0.5 ? 1 : -1; } c.reverseT -= dt; c.steer = c.revSteer; return { throttle: 0, brake: 1, steer: c.steer }; }
  const p = c.prey; if (!p) return { throttle: 0.4, brake: 0, steer: 0 };
  const lead = Math.min(1.2, Math.hypot(p.x - c.x, p.z - c.z) / 25), tx = p.x + Math.sin(p.vh) * p.v * lead, tz = p.z + Math.cos(p.vh) * p.v * lead;
  const err = angDiff(Math.atan2(tx - c.x, tz - c.z), c.h);
  c.steer += clamp(clamp(err * 2.2, -1, 1) - c.steer, -6 * dt, 6 * dt);
  return { throttle: Math.abs(err) > 1.6 ? 0.5 : 1, brake: 0, steer: c.steer };
}
function derbyTick(dt) {
  const D = game.derby; if (!D || !racing() || D.over) return;
  D.t += dt;
  const alive = derbyAlive(), p = game.player;
  $('derbyHp').style.width = Math.max(0, p.hp ?? 100) + '%';
  $('derbyLeft').textContent = alive.length + ' buses left · ' + Math.max(0, Math.ceil(D.limit - D.t)) + ' s';
  if (alive.length <= 1 || D.t >= D.limit) {
    D.over = true;
    const order = alive.slice().sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100));
    order.forEach((c, k) => { c.finished = true; c.finishTime = game.raceTime; c.finishOrder = ++game.finishCount; });
    const w = order[0];
    radio(w ? (w.isPlayer ? 'YOU WIN THE DEMOLITION DERBY! Last bus standing!' : w.name + ' wins the demolition derby!') : 'Everyone is wrecked!', w && w.isPlayer ? 'good' : 'info', 6);
    game.phase = 'finished'; game.resultsAt = game.raceTime + 4;
  }
}

/* ---------------- Race rules ---------------- */
function addPenalty(c, secs, why) {
  c.penalty += secs; (c.penLog = c.penLog || []).push(why);
  if (c.isPlayer) { radio(secs + ' second time penalty: ' + why + '.', 'bad'); updatePenTag(); }
  else if (Math.abs(positionOf(c) - positionOf(game.player)) <= 3) radio(c.code + ' gets a ' + secs + 's penalty for ' + why + '.', 'info', 4);
}
function contactFault(hitter, victim, cs) {
  if (!racing() || !(hitter.isPlayer || victim.isPlayer) || game.raceTime - hitter.contactT < 3) return;
  hitter.contactT = game.raceTime;
  if (cs >= 11) addPenalty(hitter, 5, 'causing a collision');
  else if (hitter.isPlayer) radio('Careful, that contact with ' + victim.code + ' is being looked at.', 'warn');
}
/* pit entry and exit roads count as track: no track-limit strikes on the pit side while using them */
function onPitRoad(c, Tr) {
  if (c.pit || c.inPitRoad) return true;
  const P = Tr.pit, N = Tr.N;
  if (c.lat * P.side <= 0) return false;
  const kk = (c.idx - P.entry + N) % N, before = (P.entry - c.idx + N) % N;
  if (kk < P.limIn + 20 || (kk > P.limOut - 20 && kk < P.len)) return true;    // entry and exit roads
  if (before <= 40 && c.pitReq) return true;                                     // diving across to the pit entry
  const dt0 = game.raceTime - (c.pitExitT ?? -99); return dt0 >= 0 && dt0 < 5;                               // rejoining after the pit exit
}
function trackLimits(c) {
  if (game.derby) return;
  const out = Math.abs(c.lat) > W + KERB + 0.9 && !c.dnf && !onPitRoad(c, game.T);
  if (out && !c.offLimits && Math.abs(c.v) > 12) {
    if (c.isPlayer && !c.lapInvalid && !isRace() && game.session !== 'tt' && c.maxDone >= 0) radio('Lap deleted for track limits.', 'bad', 3);
    if (c.isPlayer) c.lapInvalid = true;
    if (racing()) {
      c.strikes++;
      if (c.strikes > 3 && c.isPlayer) addPenalty(c, 5, 'track limits');
      else if (c.isPlayer) { radio(c.strikes === 3 ? 'Black and white flag. One more and it is a penalty.' : 'Track limits warning, ' + c.strikes + ' of 3.', c.strikes === 3 ? 'bad' : 'warn'); updatePenTag(); }
    }
  }
  c.offLimits = out;
}
const crossed = (N, from, to, mark) => { const span = (to - from + N) % N; const m = (mark - from + N) % N; return span > 0 && span < N / 2 && m > 0 && m <= span; };
const inZone = (N, i, z) => ((i - z.start + N) % N) <= ((z.end - z.start + N) % N);
function carAhead(c) {
  let best = null, bd = Infinity;
  for (const o of game.cars) { if (o === c || !o.active || o.finished || o.dnf || o.pit) continue; const d = o.prog - c.prog; if (d > 0 && d < bd) { bd = d; best = o; } }
  return best;
}
const freeDrs = () => !isRace() && weather.average() < 0.25;
const drsEnabled = c => freeDrs() || (racing() && !game.flag && c.maxDone >= 1 && c.maxDone >= (game.drsHoldLap || 0) && weather.average() < 0.25);
function drsLogic(c, prevIdx, Tr) {
  if (c.pit || c.dnf || (c.spec && !c.spec.drs)) { c.drsOpen = false; return; }
  const N = Tr.N;
  Tr.drs.forEach((z, k) => {
    if (crossed(N, prevIdx, c.idx, z.detect)) {
      game.drsCross[k][c.code] = game.raceTime;
      const a = carAhead(c), t = a ? game.drsCross[k][a.code] : undefined;
      c.drsGap = t !== undefined ? game.raceTime - t : Infinity;
      c.drsArmed = (freeDrs() || (drsEnabled(c) && c.drsGap < 1.0)) ? k : -1;
      if (c.isPlayer && racing() && c.maxDone >= 1) {
        if (weather.average() >= 0.25) radio('DRS disabled: track is too wet.', 'info', 2.5);
        else radio(c.drsArmed === k ? 'DRS enabled, gap ' + c.drsGap.toFixed(2) + 's.' : (isFinite(c.drsGap) ? 'No DRS, gap ' + c.drsGap.toFixed(2) + 's.' : 'No DRS this time.'), c.drsArmed === k ? 'good' : 'info', 2.5);
      }
    }
    if (crossed(N, prevIdx, c.idx, z.start) && c.drsArmed === k) c.drsOpen = true;
  });
  if (c.drsOpen) { const z = Tr.drs[c.drsArmed]; if (!z || c.inp.brake > 0 || !inZone(N, c.idx, z)) { c.drsOpen = false; c.drsArmed = -1; } }
}

/* Pit decisions: evaluated ~300 m before pit entry each lap */
function pitDecision(c, prevIdx, Tr) {
  if (game.derby) return;
  if (game.phase === 'run' && c.isPlayer) return qualiPitDecision(c, prevIdx, Tr);
  if (!racing() || c.pit || c.dnf || c.finished) return;
  const evalAt = (Tr.pit.entry - 150 + Tr.N) % Tr.N;
  if (!crossed(Tr.N, prevIdx, c.idx, evalAt)) return;
  const lap = curLap(c), lapsLeft = game.laps - lap, w = weather.average(), comp = c.tyre.comp;
  if (lap >= game.laps) return;
  let reason = null;
  if (SLICK(comp) && w > 0.32) reason = w > 0.6 ? 'wet' : 'inter';
  else if (comp === 'inter' && w < 0.12 && lapsLeft >= 1) reason = 'slicks';
  else if (comp === 'wet' && w < 0.45) reason = 'inter';
  else if (c.dmg.fw > 0.45 || c.dmg.punct || c.dmg.rw > 0.5) reason = 'damage';
  else if (c.plan && c.plan[c.planIdx + 1] && lap >= c.plan[c.planIdx + 1][1] && lapsLeft >= 1) reason = 'plan';
  else if (c.tyre.wear > 1.15 && lapsLeft >= 2) reason = 'wear';
  if (!reason) return;
  if (c.isPlayer) {
    if (c.pitReq) return;
    c.pitReq = true;
    const msg = { wet: 'Box, box. Heavy rain, we are going to full wets.', inter: 'Box, box. Rain is here, box for intermediates.', slicks: 'Track is drying. Box, box for slicks.', damage: 'Box this lap, we will fix the car.', plan: 'Box, box. Box this lap for ' + COMP[nextCompound(c)].name + 's.', wear: 'Tyres are finished. Box this lap.' }[reason];
    radio(msg + ' (P to stay out)', 'warn', 8);
  } else c.pitReq = true;
}

/* ---------------- Flags: VSC, Safety Car, Red flag ---------------- */
let scObj = null, sc = null;
function clearSC() { if (sc && scObj) scene.remove(scObj.group); sc = null; }
function flagBanner(text, cls) { const el = $('flag'); el.textContent = text; el.className = cls; }
function flagSpeed(c, Tr, target) {
  const f = game.flag;
  if (f.type === 'vsc') return Math.max(20, Tr.vprof[c.idx] * 0.6);
  if (f.type === 'sc') {
    // no overtaking: queue up behind the car (or the safety car) ahead with a ~14 m gap
    let ahead = null, bd = Infinity;
    for (const o of game.cars) { if (o === c || !o.active || o.dnf || o.pit || o.finished) continue; const dp = o.prog - c.prog; if (dp > 0 && dp < bd) { bd = dp; ahead = o; } }
    if (sc) { const dp = sc.prog - c.prog; if (dp > 0 && dp < bd) { bd = dp; ahead = { v: sc.v }; } }
    // everyone slows to the safety-car delta straight away (a little quicker if far behind, to close up)
    let cap = Math.min(55, Tr.vprof[c.idx] * 0.62);
    if (!ahead || bd * DS > 200) cap = Math.min(62, Tr.vprof[c.idx] * 0.7);
    if (ahead && bd * DS < 80) cap = Math.min(cap, Math.max(0, ahead.v + (bd * DS - 14) * 0.6));
    return cap;
  }
  return target;
}
function deployFlag(type, why) {
  if (game.derby) return;
  if (!racing() || game.flag || game.phase !== 'race') return;
  if (type === 'red') return redFlag(why);
  const p = game.player;
  game.flag = { type, t: game.raceTime, end: type === 'vsc' ? game.raceTime + 30 + Math.random() * 20 : Infinity, ahead: new Set(standings().slice(0, Math.max(0, positionOf(p) - 1)).map(c => c.code)), vscOver: 0, passT: 0, delta: 1.0, deltaLow: 0, dProg: null };
  for (const c of game.cars) { c.drsOpen = false; c.drsArmed = -1; }
  if (type === 'vsc') { radio('Virtual Safety Car: ' + why + '. Slow down and keep to the delta.', 'warn', 6); flagBanner('VIRTUAL SAFETY CAR', 'vsc'); }
  else {
    radio('Safety Car deployed: ' + why + '. No overtaking, close up to the car ahead.', 'warn', 7); flagBanner('SAFETY CAR', 'sc');
    const L = standings()[0];
    if (!scObj) scObj = makeSafetyCar();
    scene.add(scObj.group);
    sc = { prog: L.prog + 140, v: 40, inLap: false, last: 0 }; game.flag.startLap = L.maxDone;
  }
}
function clearFlag() {
  game.flag = null; $('delta').className = 'hidden'; game.drsHoldLap = standings()[0].maxDone + 1;
  flagBanner('GREEN FLAG', 'green'); setTimeout(() => { if (!game.flag) $('flag').className = 'hidden'; }, 2500);
  radio('Green flag! Racing resumes.', 'good', 4);
}
function updateFlags(dt) {
  const f = game.flag; if (!f || !racing()) { if ($('delta').className !== 'hidden') $('delta').className = 'hidden'; return; }
  const Tr = game.T, st = standings(), L = st[0], p = game.player;
  if (f.type === 'vsc') {
    if (game.raceTime > f.end - 6 && !f.ending) { f.ending = true; radio('VSC ending. Get ready to go.', 'info', 4); flagBanner('VSC ENDING', 'vsc'); }
    // the player must keep the delta positive (slower than the VSC reference lap)
    deltaStep(f, p, Tr, dt, true);
    if (game.raceTime >= f.end) clearFlag();
    return;
  }
  if (f.type === 'sc') {
    // until the player has caught the queue, they must also keep to the Safety Car delta
    deltaStep(f, p, Tr, dt, !closeBehind(p));
    if (sc) {
      const gapS = (sc.prog - L.prog) * DS;
      const i = Math.floor(((sc.prog % Tr.N) + Tr.N) % Tr.N) % Tr.N;
      let tgt = clamp(Tr.vprof[i] * 0.58, 24, 48); if (gapS > 160) tgt = 18;
      sc.v += clamp(tgt - sc.v, -10 * dt, 6 * dt); sc.prog += sc.v * dt / DS;
      const i2 = Math.floor(((sc.prog % Tr.N) + Tr.N) % Tr.N) % Tr.N;
      scObj.group.position.set(Tr.px[i2], bankH(Tr, i2, 0), Tr.pz[i2]); scObj.group.rotation.y = Math.atan2(Tr.tx[i2], Tr.tz[i2]);
      scObj.lamps.forEach((l, k) => l.color.set(sc.inLap ? '#222222' : ((performance.now() / 250 | 0) + k) % 2 ? '#ffb000' : '#3a2a00'));
      if (!sc.inLap && L.maxDone - f.startLap >= 2 && gapS < 40) { sc.inLap = true; radio('Safety Car in this lap. Leader controls the restart.', 'info', 5); flagBanner('SAFETY CAR IN THIS LAP', 'sc'); }
      if (sc.inLap && crossed(Tr.N, sc.last, i2, Tr.pit.entry)) { scene.remove(scObj.group); sc = null; f.restartLap = L.maxDone; }
      else sc.last = i2;
    } else if (f.restartLap !== undefined && L.maxDone > f.restartLap) clearFlag();
    // no overtaking under the safety car
    const passed = [...f.ahead].map(code => game.cars.find(c => c.code === code)).filter(c => c && !c.dnf && !c.pit && c.prog < p.prog - 2);
    if (passed.length && !p.pit) {
      f.passT += dt;
      if (f.passT > 0.5 && !f.toldBack) { f.toldBack = true; radio('You overtook ' + passed[0].code + ' under the Safety Car. Give the place back!', 'bad', 6); }
      if (f.passT > 12) { addPenalty(p, 5, 'overtaking under the Safety Car'); passed.forEach(c => f.ahead.delete(c.code)); f.passT = 0; f.toldBack = false; }
    } else { f.passT = 0; f.toldBack = false; }
  }
}
/* F1-style delta: time taken since the flag minus the reference time for the same distance at the
   VSC / Safety Car reference pace. Positive = slower than the reference (fine), negative = too fast. */
function refSpeed(f, Tr, i) { return f.type === 'vsc' ? Math.max(20, Tr.vprof[i] * 0.6) * 1.03 : Math.min(56, Tr.vprof[i] * 0.64); }
function closeBehind(c) {
  for (const o of game.cars) { if (o === c || !o.active || o.dnf || o.pit) continue; const d = (o.prog - c.prog) * DS; if (d > 0 && d < 150) return true; }
  return sc ? (sc.prog - c.prog) * DS > 0 && (sc.prog - c.prog) * DS < 150 : false;
}
function deltaStep(f, p, Tr, dt, enforce) {
  const el = $('delta');
  if (p.pit || p.dnf || p.finished) { f.dProg = null; el.className = 'hidden'; return; }
  if (f.dProg === null) f.dProg = p.prog;
  const ds = Math.max(0, p.prog - f.dProg) * DS; f.dProg = p.prog;
  f.delta += dt - ds / refSpeed(f, Tr, p.idx);
  f.delta = Math.min(f.delta, 9.9);
  const d = f.delta;
  el.className = d >= 0.3 ? 'ok' : d >= -0.3 ? 'close' : 'bad';
  $('deltaVal').textContent = (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1);
  if (!enforce) { f.deltaLow = 0; return; }
  if (d < -0.3) {
    f.deltaLow += dt;
    if (f.deltaLow > 1.5 && !f.warned) { f.warned = true; radio('Delta is negative. Slow down and get back above the delta!', 'bad', 4); }
    if (f.deltaLow > 5 && !f.penal) { f.penal = true; addPenalty(p, 5, f.type === 'vsc' ? 'not respecting the VSC delta' : 'not respecting the Safety Car delta'); }
  } else f.deltaLow = Math.max(0, f.deltaLow - dt);
}
function redFlag(why) {
  $('delta').className = 'hidden';
  game.flag = { type: 'red', t: game.raceTime }; game.phase = 'red'; game.redT = 4;
  if (sc) { scene.remove(scObj.group); sc = null; }
  radio('RED FLAG: ' + why + '. Session suspended, back to the grid.', 'bad', 8); flagBanner('RED FLAG', 'red');
}
function restartFromRed() {
  const Tr = game.T, order = standings().filter(c => !c.dnf), L = Math.max(0, order[0].maxDone);
  if (game.laps - L < 1) { for (const c of order) if (!c.finished) { c.finished = true; c.finishTime = game.raceTime; c.finishOrder = ++game.finishCount; } game.phase = 'finished'; showResults(); return; }
  placeGrid(order, Tr);
  const w = weather.average();
  for (const c of order) {
    c.prog += L * Tr.N; c.maxDone = L; c.lapStart = game.raceTime; c.splits = {}; c.lastBucket = Math.floor(c.prog / 25);
    c.v = 0; c.spin = 0; c.pit = null; c.inPitRoad = false; c.pitReq = false; c.drsOpen = false; c.drsArmed = -1;
    c.dmg = { fw: 0, rw: 0, susp: Math.min(c.dmg.susp, 0.5), punct: false, pull: 0 }; c.fwing.visible = c.rwing.visible = true;
    setTyres(c, w > 0.55 ? 'wet' : w > 0.2 ? 'inter' : (SLICK(c.tyre.comp) && c.tyre.comp !== 'soft' ? c.tyre.comp : 'medium'));
  }
  game.flag = null; game.phase = 'lights'; game.lightsT = 0; game.goAt = 5.6 + Math.random() * 1.2; game.drsHoldLap = L + 1;
  $('startLights').classList.remove('hidden'); flagBanner('RESTART', 'green'); setTimeout(() => { if (!game.flag) $('flag').className = 'hidden'; }, 3000);
  radio('Standing restart. ' + (game.laps - L) + ' laps to go. Fresh tyres fitted.', 'info', 6);
}
function incident(why) {
  if (!racing() || game.mp || game.derby) return;
  game.dnfTimes = (game.dnfTimes || []).filter(t => game.raceTime - t < 15); game.dnfTimes.push(game.raceTime);
  if (game.dnfTimes.length >= 3) return deployFlag('red', 'multiple cars crashed');
  if (game.flag) return;
  deployFlag(Math.random() < 0.55 ? 'sc' : 'vsc', why);
}

function qualiPitDecision(c, prevIdx, Tr) {
  if (c.pit || c.pitReq) return;
  const evalAt = (Tr.pit.entry - 150 + Tr.N) % Tr.N;
  if (!crossed(Tr.N, prevIdx, c.idx, evalAt)) return;
  const w = weather.average(), comp = c.tyre.comp, q = game.session !== 'tt';
  let msg = null;
  if (SLICK(comp) && w > 0.32) msg = (q ? 'We know it is quali, but it is raining too hard for slicks. ' : 'Too wet for slicks now. ') + (w > 0.6 ? 'Box, box for full wets.' : 'Box, box for inters.');
  else if (comp === 'inter' && w < 0.12) msg = 'Track is dry enough now. Box for softs, there is time to find.';
  else if (comp === 'wet' && w < 0.45) msg = 'Rain has eased. Box for inters.';
  else if (c.dmg.fw > 0.45 || c.dmg.punct) msg = 'We need to fix the car. Box this lap.';
  if (!msg) return;
  c.pitReq = true; radio(msg + (q ? ' This lap will not count against your flying laps.' : '') + ' (P to stay out)', 'warn', 8);
}

/* ---------------- Laps & sessions ---------------- */
function checkLaps(c, Tr) {
  const done = Math.floor(c.prog / Tr.N), bucket = Math.floor(c.prog / 25);
  if (bucket > c.lastBucket) { c.splits[bucket] = game.raceTime; c.lastBucket = bucket; }
  trackLimits(c);
  if (done <= c.maxDone) return;
  if (done === 0 && !isRace()) { c.lapStart = game.raceTime; c.lapInvalid = false; if (c.isPlayer && game.session === 'tt') ghostLap(0, false); if (c.isPlayer && game.session !== 'tt') radio('Flying lap. Push now.', 'info', 2.5); }
  if (done >= 1) {
    const lt = game.raceTime - c.lapStart, valid = !(c.isPlayer && c.lapInvalid);
    c.lastLap = lt; c.lapTimes.push(lt);
    if (valid && lt < c.bestLap) c.bestLap = lt;
    if (c.isPlayer && game.session === 'tt') { ghostLap(lt, valid); if (valid) ttMedal(lt); }
    c.lapStart = game.raceTime;
    if (isRace() && valid && lt < game.fastest && done >= 1) { game.fastest = lt; if (c.isPlayer && done > 1) radio('Purple! Fastest lap of the race: ' + fmt(lt) + '.', 'good', 4); }
    const notTimed = c.isPlayer && !isRace() && (c.pit || c.outLap);
    if (notTimed) { c.outLap = !!c.pit; c.lapTimes.pop(); if (c.bestLap === lt) c.bestLap = Math.min(Infinity, ...c.lapTimes); flashMsg(c.pit ? 'IN LAP' : 'FLYING LAP', 1.5); c.lapInvalid = false; }
    else if (c.isPlayer) {
      if (valid && game.session === 'tt' && LB_ON && lt <= c.bestLap) {
        if (!lbName()) radio('Set your driver name in the Time Trial menu to go on the global leaderboard.', 'info', 6);
        else { registerVipName(); } if (lbName()) lbSubmit(serKey(Tr.def.id), lt).then(pos => { if (pos) radio('Lap ' + fmt(lt) + ' is P' + pos + ' on the global leaderboard!', pos <= 3 ? 'good' : 'info', 6); });
      }
      if (valid && (!game.record || lt < game.record) && (game.session === 'tt' || !isRace())) { game.record = lt; store.set(bestKey(Tr), String(lt)); flashMsg('NEW RECORD', 2.5, fmt(lt)); }
      else if (!valid) flashMsg('LAP INVALID', 2, fmt(lt) + ' · track limits');
      else if (isRace() && done === game.laps - 1) flashMsg('FINAL LAP', 2, fmt(lt));
      else flashMsg('LAP ' + (done + 1), 1.8, fmt(lt));
      if (!isRace() && game.session !== 'tt') {
        c.timedLaps++;
        if (valid && lt < c.sessBest) c.sessBest = lt;
        if (c.timedLaps >= 2) { radio('Session over for us. ' + (isFinite(c.sessBest) ? 'Best ' + fmt(c.sessBest) + '.' : 'No time set.'), 'info', 4); c.lapInvalid = false; game.sessionEndAt = game.raceTime + 1.2; }
        if (game.mp) mpSendQuali();
      }
      if (isRace()) lapRadio(c, done);
      c.lapInvalid = false;
    }
  }
  c.maxDone = done;
  if (c.isPlayer && isRace() && done === 1 && Tr.drs.length) radio('DRS is now enabled. Within one second at detection.', 'info', 4);
  if (isRace() && done >= game.laps && !c.finished) {
    c.finished = true; c.finishTime = game.raceTime; c.finishOrder = ++game.finishCount;
    if (c.isPlayer) onPlayerFinish();
  }
}
function onPlayerFinish() {
  const p = game.player;
  game.phase = 'finished'; p.autopilot = true; p.pace = 0.8;
  game.resultsAt = game.raceTime + 3.2;
  if (willBeChampion()) {
    flashMsg('WORLD CHAMPION!', 5, (p.finishOrder === 1 ? 'Race win · ' : 'P' + positionOf(p) + ' · ') + fmt(p.finishTime));
    radio(champCall(), 'good', 9);
    game.champ = { t: 0 }; game.resultsAt = game.raceTime + 27;
    return;
  }
  flashMsg(p.finishOrder === 1 ? 'YOU WIN!' : 'FINISHED P' + positionOf(p), 3, fmt(p.finishTime));
  radio(p.finishOrder === 1 ? 'Get in there! That is the win!' : 'Chequered flag. P' + positionOf(p) + '. Good job.', 'good', 6);
}

/* ---------------- World champion: radio call, donuts, then the driver climbs out and celebrates ---------------- */
const CHAMP_CALLS = [
  'MATE, YOU ARE WORLD CHAMPION!!! UNBELIEVABLE!',
  'GET IN THERE MATE, CHAMPION OF THE WORLD!',
  'YOU ARE THE WORLD CHAMPION! WORLD CHAMPION! WHAT A SEASON!',
  'THAT IS IT! YOU HAVE DONE IT! WORLD CHAMPION!',
  'GET IN THERE!!! YOU ARE A WORLD CHAMPION, MATE! A WORLD CHAMPION!',
  'WORLD CHAMPION! WORLD CHAMPION! I CANNOT BELIEVE IT, MATE!',
  'Mate... you are the champion of the world. Take it all in. WORLD CHAMPION!',
  'YESSS! THE TITLE IS YOURS! CHAMPION OF THE WORLD!',
  'WHAT A DRIVE, WHAT A YEAR! YOU ARE WORLD CHAMPION, MATE!',
  'SIMPLY LOVELY! WORLD CHAMPION! The whole team is going mad here!',
  'YOU ABSOLUTE LEGEND! WORLD CHAMPION! GET IN THERE!',
  'THE CHAMPIONSHIP IS YOURS! WORLD CHAMPION! UNREAL, MATE, UNREAL!',
  'From the whole team: thank you. YOU ARE WORLD CHAMPION!',
  'GET IN!!! THAT IS THE WORLD CHAMPIONSHIP, MATE! YOU DID IT!',
  'WORLD CHAMPION! Do some donuts, you have earned it!',
  'NUMBER ONE! NUMBER ONE! YOU ARE THE WORLD CHAMPION!',
  'THEY WILL REMEMBER THIS ONE FOREVER! WORLD CHAMPION, MATE!',
  'Get in there, get in there, GET IN THERE! WORLD CHAMPION!',
  'CHAMPION OF THE WORLD! WE ARE CHAMPIONS OF THE WORLD!',
  'I am lost for words, mate. WORLD CHAMPION. UNBELIEVABLE!',
];
function champCall() {
  // never the same call twice in a row
  let k = Math.floor(Math.random() * CHAMP_CALLS.length); const last = +(store.get('apexgp-champcall') ?? -1);
  if (k === last) k = (k + 1 + Math.floor(Math.random() * (CHAMP_CALLS.length - 1))) % CHAMP_CALLS.length;
  store.set('apexgp-champcall', String(k)); return CHAMP_CALLS[k];
}
/* would the points after this race make you champion, with nobody able to catch you in the rounds left? */
function willBeChampion() {
  const s = game.season; if (settings.mode !== 'champ' || !s || game.mp) return false;
  const pts = Object.assign({}, s.pts);
  standings().forEach((c, k) => { pts[c.code] = (pts[c.code] || 0) + (!c.dnf && POINTS[k] ? POINTS[k] : 0); });
  const left = calIdx().length - (s.round + 1), tab = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  return tab[0][0] === 'YOU' && tab[0][1] - (tab[1] ? tab[1][1] : 0) > left * POINTS[0];
}
function makeDriverFigure(suit, helmet) {
  const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const suitM = m(suit), dark = m('#16181d'), box = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; return o; };
  g.add(box(0.42, 0.55, 0.24, suitM, 0, 1.12, 0));                                  // torso
  g.add(box(0.4, 0.12, 0.25, dark, 0, 0.86, 0));                                    // belt
  const leg = x => { const p = new THREE.Group(); p.position.set(x, 0.85, 0); p.add(box(0.16, 0.8, 0.18, suitM, 0, -0.4, 0), box(0.18, 0.1, 0.28, dark, 0, -0.8, 0.04)); g.add(p); return p; };
  const arm = x => { const p = new THREE.Group(); p.position.set(x, 1.36, 0); p.add(box(0.13, 0.62, 0.14, suitM, 0, -0.3, 0), box(0.15, 0.14, 0.15, dark, 0, -0.64, 0)); g.add(p); return p; };
  const head = new THREE.Group(); head.position.set(0, 1.55, 0);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshPhysicalMaterial({ color: helmet, roughness: 0.2, clearcoat: 1 })));
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.162, 20, 8, -0.9, 1.8, 1.2, 0.55), new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.05, metalness: 0.8 })); visor.rotation.y = 0; head.add(visor);
  g.add(head);
  g.userData = { armL: arm(0.28), armR: arm(-0.28), legL: leg(0.1), legR: leg(-0.1), head };
  return g;
}
function updateChamp(dt) {
  const C = game.champ, p = game.player, Tr = game.T; if (!C || !p) return;
  C.t += dt; const t = C.t;
  if (t < 4) { p.pace = 0.55; return; }                                    // a few seconds of cool-down
  if (!C.pull) {
    // pull over to the side with more room, slowing down
    const roomL = Tr.limL[p.idx] - W, roomR = Tr.limR[p.idx] - W, sd = roomL > roomR ? 1 : -1, room = Math.max(roomL, roomR);
    C.pull = { lat0: p.lat, lat1: room > 7 ? sd * (W + Math.min(room - 5, 10)) : sd * (W - 3), v0: Math.max(Math.abs(p.v), 15), k: p.idx, f: 0, T: 2.5 };
    p.celebrate = true; p.autopilot = true; C.cam = true; C.ang = p.h + Math.PI * 0.8;
  }
  const P = C.pull;
  if (t < 4 + P.T) {
    const u = (t - 4) / P.T, v = P.v0 + (8 - P.v0) * u; P.f += v * dt / DS;
    while (P.f >= 1) { P.f -= 1; P.k = (P.k + 1) % Tr.N; }
    const i = P.k, lat = P.lat0 + (P.lat1 - P.lat0) * smooth(0, 1, u);
    p.x = Tr.px[i] + Tr.nx[i] * lat + Tr.tx[i] * P.f * DS; p.z = Tr.pz[i] + Tr.nz[i] * lat + Tr.tz[i] * P.f * DS;
    p.h = Math.atan2(Tr.tx[i], Tr.tz[i]) - Math.sign(P.lat1 - P.lat0) * 0.15 * Math.sin(Math.PI * u); p.v = v; p.slip = 0; p.steer = 0;
    p.inp = { throttle: 0.2, brake: 0.3, steer: 0 }; p.idx = i; p.lat = lat;
    return;
  }
  const fx = () => Math.sin(p.h), fz = () => Math.cos(p.h);
  if (!C.pivot) C.pivot = [p.x + fx() * 1.4, p.z + fz() * 1.4];
  const tD = t - 4 - P.T;
  if (tD < 8) {
    // donuts: the front stays put, the rear swings round in a cloud of smoke
    const w = 3.4 * Math.min(1, tD / 1.2) * (tD > 7 ? (8 - tD) : 1);
    p.h += w * dt; p.x = C.pivot[0] - fx() * 1.4; p.z = C.pivot[1] - fz() * 1.4;
    p.v = 28 * Math.min(1, tD / 0.6); p.steer = 1; p.slip = 0.6; p.inp = { throttle: 1, brake: 0, steer: 1 };
    const ey = p.group.position.y, lx = Math.cos(p.h), lz = -Math.sin(p.h);
    for (const [sd, k] of [[1, 0], [-1, 1]]) {
      const x = p.x + lx * sd * 0.83 + fx() * AXLE_R, z = p.z + lz * sd * 0.83 + fz() * AXLE_R;
      skids.mark('champ' + k, x, z, fx(), fz(), 0.7, ey);
      if (Math.random() < dt * 70) smoke.spawn(x, ey + 0.3, z, (Math.random() - 0.5) * 3 - lx * sd * 2, 0.8 + Math.random() * 1.5, (Math.random() - 0.5) * 3 - lz * sd * 2, 1.8 + Math.random() * 1.2, 1.2, 7, 0.45, SMOKE, 0.9);
    }
  } else {
    skids.lift('champ0'); skids.lift('champ1');
    p.v = 0; p.steer = 0; p.slip = 0; p.inp = { throttle: 0, brake: 0, steer: 0 };
  }
  p.idx = locate(Tr, p.x, p.z, p.idx); p.lat = (p.x - Tr.px[p.idx]) * Tr.nx[p.idx] + (p.z - Tr.pz[p.idx]) * Tr.nz[p.idx];
  // the driver climbs out and celebrates on the car
  const tO = tD - 9.5; if (tO < 0) return;
  if (!C.fig) {
    C.fig = makeDriverFigure(p.color || '#ffcc00', '#ffffff'); p.group.add(C.fig);
    if (p.helmet) p.helmet.visible = false; C.stand = p.closed ? 1.2 : 0.55;
    radio(['Go on, get out and celebrate! You have earned it!', 'Enjoy this, mate. Enjoy every second.', 'Look at the fans, mate! They are going mad!'][Math.floor(Math.random() * 3)], 'good', 6);
  }
  const F = C.fig, U = F.userData;
  if (tO < 1.4) {
    // climb up out of the cockpit (or the door on closed cars)
    const u = smooth(0, 1, tO / 1.4);
    if (p.closed) F.position.set(1.4 * (1 - u), C.stand * u + 0.4 * Math.sin(Math.PI * u), 0.1);
    else F.position.set(0, -0.6 + (C.stand + 0.6) * u + 0.35 * Math.sin(Math.PI * u), 0.35 + 0.3 * u);
    U.armL.rotation.z = U.armR.rotation.z = 0; F.rotation.y = 0;
  } else {
    // jump up and down, fists pumping, turning to the crowd
    const j = tO - 1.4, hop = Math.abs(Math.sin(j * Math.PI * 1.4));
    F.position.set(p.closed ? 0 : 0, C.stand + hop * 0.75, p.closed ? 0.1 : 0.65);
    F.rotation.y = Math.sin(j * 0.6) * 1.2;
    U.armL.rotation.z = Math.PI - 0.35 + Math.sin(j * 9) * 0.25 * (1 - hop); U.armR.rotation.z = -(Math.PI - 0.35) - Math.sin(j * 9 + 1) * 0.25 * (1 - hop);
    U.legL.rotation.x = U.legR.rotation.x = -hop * 0.5; U.head.rotation.x = -0.2 * hop;
  }
}
function champCamera(dt) {
  const C = game.champ, p = game.player;
  C.ang += dt * (C.fig ? 0.3 : 0.45);
  const r = C.fig ? 6.5 : 11, y = C.fig ? 2.2 : 3.4, gy = p.group.position.y;
  camera.position.set(p.x + Math.sin(C.ang) * r, gy + y, p.z + Math.cos(C.ang) * r);
  camera.lookAt(p.x, gy + (C.fig ? 1.3 : 0.6), p.z); camera.fov = 55; camera.updateProjectionMatrix();
}
function standings() {
  const cars = game.cars.filter(c => c.active);
  return cars.sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
    if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.prog - a.prog;
  });
}
const positionOf = c => standings().indexOf(c) + 1;

/* ---------------- Race engineer & team orders ---------------- */
let radioQ = [], radioNext = 0;
function radio(text, kind = 'info', dur = 6, who) {
  if (performance.now() < radioNext && kind !== 'bad' && !who) { if (radioQ.length < 3) radioQ.push([text, kind, dur]); return; }
  showRadio(text, kind, dur, who);
}
function showRadio(text, kind, dur, who) {
  if (!who) radioNext = performance.now() + 1800;
  const box = $('radio'), el = document.createElement('div');
  el.className = 'rmsg ' + kind + (who ? ' me' : ''); el.innerHTML = '<span class="who">' + (who || 'RACE ENGINEER') + '</span>' + text;
  box.prepend(el); while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, dur * 1000);
}
function pumpRadio() { if (radioQ.length && performance.now() >= radioNext) showRadio(...radioQ.shift()); }
function gapTo(a, b) {
  const bk = Math.min(a.lastBucket, b.lastBucket), ta = a.splits[bk], tb = b.splits[bk];
  return ta !== undefined && tb !== undefined ? Math.abs(ta - tb) : null;
}
function lapRadio(p, done) {
  if (done >= game.laps) return;
  const st = standings(), i = st.indexOf(p), ahead = st[i - 1], behind = st[i + 1];
  const parts = ['P' + (i + 1) + '.'];
  if (ahead) { const g = gapTo(p, ahead); if (g !== null) parts.push('Gap to ' + ahead.code + ' ' + g.toFixed(1) + '.'); }
  if (behind) { const g = gapTo(p, behind); if (g !== null) parts.push(behind.code + ' is ' + g.toFixed(1) + ' behind.'); }
  if (done === game.laps - 1) parts.push('Last lap, bring it home.');
  radio(parts.join(' '), 'info', 5);
}
function engineerTick() {
  const p = game.player; if (!(racing() || game.phase === 'run') || p.dnf) return;
  const quali = !isRace();
  const wx = game.wx, t = game.raceTime, g = weather.global(t);
  if (racing() && !game.redWx && weather.average() > 0.93) { game.redWx = true; deployFlag('red', 'too much standing water'); }
  // weather calls
  const nr = weather.nextRain(t);
  if (!wx.forecastSaid && nr - t < 70 && nr - t > 10 && g < 0.05) { wx.forecastSaid = true; radio('Rain expected in about a minute.', 'warn'); }
  if (!wx.raining && g > 0.05) {
    wx.raining = true; wx.level = Math.max(g, 0.3); wx.lastT = t;
    const sr = weather.sectorRain(), worst = sr.indexOf(Math.max(...sr)) + 1;
    radio((quali ? 'Rain is starting to fall, heaviest in sector ' + worst + '. Get a lap in now before it gets worse.' : "It's starting to rain. Heaviest in sector " + worst + '.'), 'warn');
  } else if (wx.raining) {
    if (t - (wx.lastT || 0) < 30) { /* don't nag */ }
    else if (g > wx.level + 0.3) { wx.lastT = t; wx.level = g; const sr = weather.sectorRain(), worst = sr.indexOf(Math.max(...sr)) + 1; radio('Rain is getting heavier, especially in sector ' + worst + '.', 'warn'); }
    else if (g < wx.level - 0.25 && g > 0.04) { wx.lastT = t; wx.level = g; radio('Rain is getting lighter.', 'info'); }
    else if (g < 0.03) { wx.raining = false; wx.level = 0; radio('Rain has stopped. The track will start drying.', 'info'); }
  }
  if (quali) return;
  // tyres
  if (p.tyre.wear > 0.7 && p.wearWarn < 1) { p.wearWarn = 1; radio('Tyres are starting to go off.', 'info'); }
  if (p.tyre.wear > 1.0 && p.wearWarn < 2) { p.wearWarn = 2; radio('Tyres are gone. Expect a lot less grip.', 'warn'); }
  if (SLICK(p.tyre.comp) && weather.wetAt(p.idx) > 0.45 && !p.pitReq && !wx.slickWarn) { wx.slickWarn = true; radio('Careful, very slippery on slicks here.', 'warn'); }
  // compound rule reminder
  const lapsLeft = game.laps - curLap(p);
  if (game.laps >= 5 && lapsLeft === 3 && !wx.ruleSaid && !(p.stints || []).some(s => !SLICK(s)) && new Set(p.stints.filter(SLICK)).size < 2) { wx.ruleSaid = true; radio('Reminder: we must use a second dry compound. We need to box.', 'warn'); }
  teamOrders();
}
function teamOrders() {
  const p = game.player, m = game.mate, to = game.to;
  if (settings.mode !== 'champ' || !m || m.dnf || p.dnf || m.pit || p.pit || m.finished || p.finished) return;
  const gap = m.prog - p.prog, close = Math.abs(gap) < 45, lapsLeft = game.laps - curLap(p), t = game.raceTime;
  if (to.issued === 'let') {
    if (m.prog > p.prog + 8) { to.issued = 'done'; radio('Thank you. Good team play.', 'good'); }
    else if (t > to.deadline) { to.issued = 'done'; radio('You ignored a team order. That will be discussed after the race.', 'bad'); }
    return;
  }
  if (to.issued) return;
  if (!close || t < 45) { to.closeT = 0; return; }
  to.closeT = (to.closeT || 0) + 1;
  if (to.closeT < 8 || Math.random() > 0.15) return;
  if (lapsLeft <= 1) { to.issued = 'hold'; radio('Team order: hold position. No racing your teammate.', 'warn'); return; }
  if (gap < 0 && m.lastLap && p.lastLap && m.lastLap < p.lastLap - 0.25) { to.issued = 'let'; to.deadline = t + 50; radio('Team order: ' + m.code + ' is faster. Let them through, please.', 'warn', 8); }
  else if (gap > 0 && m.lastLap && p.lastLap && p.lastLap < m.lastLap - 0.25) { to.issued = 'swap'; m.yieldT = 14; radio('We have told ' + m.code + ' to let you by. Get past on the next straight.', 'good', 7); }
}

/* ---------------- Global time-trial leaderboard (Supabase REST) ---------------- */
const LB_ON = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
// new-style publishable keys (sb_publishable_...) go only in the apikey header; old anon JWTs also as a Bearer token
const lbHeaders = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(SUPABASE_ANON_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + SUPABASE_ANON_KEY } : {}) };
const lbName = () => (store.get('apexgp-name') || '').trim();
async function lbFetch(trackId, limit = 10) {
  if (!LB_ON) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/best_laps?select=name,time_ms&track=eq.' + encodeURIComponent(trackId) + '&order=time_ms.asc&limit=' + limit, { headers: lbHeaders });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
async function lbSubmit(trackId, secs) {
  const name = lbName(); if (!LB_ON || !name) return null;
  const time_ms = Math.round(secs * 1000);
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/laptimes', { method: 'POST', headers: { ...lbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ track: trackId, name, time_ms }) });
    if (!r.ok) return null;
    const c = await fetch(SUPABASE_URL + '/rest/v1/best_laps?select=name&track=eq.' + encodeURIComponent(trackId) + '&time_ms=lt.' + time_ms, { headers: { ...lbHeaders, Prefer: 'count=exact' } });
    const range = c.headers.get('content-range') || '', total = parseInt(range.split('/')[1], 10);
    return isFinite(total) ? total + 1 : null;
  } catch (e) { return null; }
}
let lbReq = 0;
async function refreshLeaderboard() {
  const box = $('lbBox'); if (!box) return;
  const show = settings.mode === 'tt'; box.classList.toggle('hidden', !show); if (!show) return;
  if (!LB_ON) { $('lbList').innerHTML = '<small>The global leaderboard is not switched on yet.</small>'; return; }
  const id = serKey(TRACKS[settings.track].id), req = ++lbReq; $('lbTitle').textContent = (TRACKS[settings.track].vip ? '★ VIP leaderboard · ' : 'Global leaderboard · ') + SER.short + ' · ' + TRACKS[settings.track].name;
  $('lbList').innerHTML = '<small>Loading…</small>';
  const rows = await lbFetch(id); if (req !== lbReq) return;
  if (!rows) { $('lbList').innerHTML = '<small>Could not reach the leaderboard.</small>'; return; }
  const me = lbName(), vn = await loadVipNames(); if (req !== lbReq) return;
  $('lbList').innerHTML = rows.length ? '<table class="lb">' + rows.map((r, k) => '<tr' + (r.name === me ? ' class="me"' : '') + '><td>' + (k + 1) + '</td><td' + (vn.has(r.name) || (r.name === me && isVip()) ? ' class="vipn"' : '') + '>' + r.name.replace(/[<>&]/g, '') + '</td><td>' + fmt(r.time_ms / 1000) + '</td></tr>').join('') + '</table>' : '<small>No times yet. Set the first one!</small>';
}

/* ---------------- Online multiplayer ---------------- */
const net = new Net({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });
net.watchOnline(n => { $('onlineNow').classList.toggle('hidden', !n); $('onlineNow').querySelector('b').textContent = n; });
const carByNet = id => game.cars.find(c => c.netId === id);
const mpName = () => lbName() || 'Driver';
const mpCode3 = n => (n.replace(/[^A-Za-z]/g, '').toUpperCase() + 'XXX').slice(0, 3);
let mpSeq = 0, mpSendT = 0, mpLastInfo = '';
/* random 1v1 lobbies: find one opponent, join a private two-player room, and start automatically */
let mpRandom = false, mpSearching = false, mpAutoT = null;
async function mpRandomLobby() {
  if (mpSearching) { net.cancelMatch(); return; }
  await loadTurn(METERED_APP, METERED_KEY);
  if (!mpName() || mpName() === 'Driver') { mpStatus('Type your driver name in the box above first.'); $('mpName').focus(); $('mpName').classList.add('need'); return; }
  $('mpName').classList.remove('need');
  mpSearching = true; $('mpRandom').textContent = 'Cancel search';
  try {
    for (;;) {
      mpStatus('Searching for an opponent…');
      const m = await net.matchmake(mpName(), n => mpStatus(n > 1 ? 'Opponent found, setting up the race…' : 'Searching for an opponent… (you are first in the queue)'));
      if (!m) { mpStatus('Search cancelled.'); break; }
      mpRandom = true;
      await net.join(m.code, mpName(), { livery: myLivery(), vip: isVip() ? 1 : 0, vx: myExtras(), num: isVip() ? myNum() : 0, hel: myHelmet(), track: settings.track, laps: settings.laps, rand: 1 });
      const t0 = performance.now();
      while (net.room.length < 2 && performance.now() - t0 < 8000) await new Promise(r => setTimeout(r, 250));
      if (net.room.length >= 2 && net.room.findIndex(p => p.id === net.id) < 2) { mpLastInfo = ''; renderRoom(); break; }
      await net.leave(); mpRandom = false;   // opponent vanished or the lobby was full: search again
    }
  } catch (e) { await net.leave(); mpRandom = false; mpStatus('Could not connect to the online service (' + (e && e.message || 'error') + '). Check your internet and try again.'); }
  mpSearching = false; $('mpRandom').textContent = 'Join random lobby (1v1)'; renderRoom();
}
function mpRandomCheck() {
  if (mpSearching) return;
  if (!mpRandom || !net.code || game.mp) { clearTimeout(mpAutoT); mpAutoT = null; return; }
  const k = net.room.findIndex(p => p.id === net.id);
  if (k >= 2) { net.leave().then(() => { mpRandom = false; renderRoom(); mpStatus('That lobby was full. Searching again…'); mpRandomLobby(); }); return; }
  const opp = net.room.find(p => p.id !== net.id);
  if (!opp) { clearTimeout(mpAutoT); mpAutoT = null; mpStatus('Your opponent left. Press Leave and search again.'); return; }
  const nm = String(opp.name || 'Driver').replace(/[<>&]/g, '');
  if (net.isHost) {
    mpStatus('Opponent found: ' + nm + '. The race starts in 5 seconds on ' + TRACKS[settings.track].name + '.');
    if (!mpAutoT) mpAutoT = setTimeout(() => { mpAutoT = null; if (mpRandom && net.isHost && net.room.length >= 2 && !game.mp) mpHostStart(); }, 5000);
  } else mpStatus('Opponent found: ' + nm + '. The race starts in a few seconds.');
}
function mpStatus(t) { $('mpStatus').textContent = t || ''; }
function renderRoom() {
  const inRoom = !!net.code;
  $('mpOut').classList.toggle('hidden', inRoom); $('mpIn').classList.toggle('hidden', !inRoom);
  if (!inRoom) return;
  $('mpCodeShow').textContent = mpRandom ? 'RANDOM 1v1' : net.code;
  const links = net.linkInfo(), host = net.room[0];
  $('mpPlayers').innerHTML = net.room.map((p, k) => '<div class="mpp"><i style="background:' + LIVERIES[p.livery || 0] + '"></i>' + (p.vip ? '<span class="vipn">' : '') + String(p.name || 'Driver').replace(/[<>&]/g, '') + (p.vip ? '</span> <span class="tag vip">VIP</span>' : '') +
    (k === 0 ? ' <span class="tag">HOST</span>' : '') + (p.id === net.id ? ' <span class="tag you">YOU</span>' : ' <span class="tag ' + (links[p.id] ? 'ok' : '') + '">' + (links[p.id] ? 'DIRECT' : 'RELAY') + '</span>') + '</div>').join('');
  $('mpHostInfo').textContent = host && host.id !== net.id && host.track !== undefined ? 'Host has picked ' + (SERIES[host.series] || SER).name + ' · ' + TRACKS[host.track].name + ' · ' + host.laps + ' laps' + (host.quali ? ' · with qualifying' : '') : (net.isHost ? 'You are the host: pick the track, laps and qualifying, then press Start.' : '');
  refreshStartBtn(); mpRandomCheck();
}
function refreshStartBtn() {
  if (settings.mode !== 'mp') return;
  const b = $('startBtn');
  b.textContent = !net.available ? 'Online needs the Supabase setup' : !net.code ? 'Create or join a room' : net.isHost ? (net.room.length > 1 ? 'Start online race (' + net.room.length + ' players)' : 'Start (waiting for players…)') : 'Waiting for the host to start';
  b.disabled = !(net.code && net.isHost);
  // championship race: nobody can start it before the organiser's time; it starts by itself then
  const P = game.ocPending;
  if (P && net.code && !game.mp && Date.now() < P.at) { b.textContent = 'Race starts ' + ocIn(P.at - Date.now()) + ' (' + new Date(P.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')'; b.disabled = true; }
  else if (P && net.code && net.isHost && net.room.length < 2) b.textContent = 'Starts when a second driver joins';
}
function mpShareInfo() {
  if (!net.code) return;
  const info = JSON.stringify([SER.id, settings.track, settings.laps, myLivery(), mpName(), myExtras(), settings.quali, myNum(), myHelmet()]);
  if (info !== mpLastInfo) { mpLastInfo = info; net.setInfo({ series: SER.id, track: settings.track, laps: settings.laps, quali: settings.quali === 'on' ? 1 : 0, livery: myLivery(), vip: isVip() ? 1 : 0, vx: myExtras(), num: isVip() ? myNum() : 0, hel: myHelmet(), name: mpName() }); }
}
async function mpEnter(code, fixed = false) {
  await loadTurn(METERED_APP, METERED_KEY);
  if (!mpName() || mpName() === 'Driver') { mpStatus('Type your driver name in the box above first.'); $('mpName').focus(); $('mpName').classList.add('need'); return; }
  $('mpName').classList.remove('need');
  mpStatus(fixed ? 'Joining the championship race lobby…' : code ? 'Joining room ' + code + '…' : 'Creating room…');
  try {
    await net.join(code || newCode(), mpName(), { livery: myLivery(), vip: isVip() ? 1 : 0, vx: myExtras(), num: isVip() ? myNum() : 0, hel: myHelmet(), track: settings.track, laps: settings.laps, quali: settings.quali === 'on' ? 1 : 0, series: SER.id, ocPid: ocMe().id });
    if (code && !fixed) {
      // joining: make sure somebody is actually in that room (a mistyped code would otherwise make a new, empty room)
      const t0 = performance.now();
      while (net.room.length < 2 && performance.now() - t0 < 6000) await new Promise(r => setTimeout(r, 250));
      if (net.room.length < 2) { await net.leave(); renderRoom(); mpStatus('No room with code ' + code + ' was found. Check the code, and that the host still has the room open.'); return; }
    }
    mpLastInfo = ''; mpStatus(fixed ? 'Championship race: ' + game.ocPending.name + ', round ' + (game.ocPending.round + 1) + '. Starts ' + ocWhen(game.ocPending.at) + ' on its own. No early starts.' : code ? '' : 'Room ready. Send the code to your friends.'); renderRoom();
  } catch (e) { await net.leave(); renderRoom(); mpStatus('Could not connect to the online service (' + (e && e.message || 'error') + '). Check your internet and try again.'); }
}
net.on('room', () => renderRoom());
net.on('peerLink', () => renderRoom());
net.on('peerLeft', id => { const c = carByNet(id); if (c && game.mp && !c.netGone) { c.netGone = true; radio(c.name + ' has lost connection.', 'warn', 4); } renderRoom(); });
net.on('msg', m => {
  if (m.t === 'start' && m.cfg) startMp(m.cfg); else if (m.t === 'qlap') mpQualiLap(m);
  else if (m.t === 'chat' && game.mp) { const c = carByNet(m.from), q = QCHAT[m.k | 0]; if (c && q) radio('★ ' + c.name + ': ' + q, 'info', 4); }
  else if (m.t === 'dsq' && game.mp) { const c = carByNet(m.from); if (c && !c.dsq) { c.dsq = m.why || 'driving the wrong way'; c.dnf = true; c.retire = { why: 'dsq', side: c.lat >= 0 ? 1 : -1, dmg: { ...c.dmg } }; radio(c.name + ' has been disqualified for ' + c.dsq + '.', 'warn', 5); } }
  else if (m.t === 'fw' && game.mp) {
    const c = carByNet(m.from); if (!c || c.fwSeen === game.mp.race) return; c.fwSeen = game.mp.race;
    const msg = String(m.msg || '').replace(/[<>&]/g, '').slice(0, 40);
    try { sound.horn(); } catch (e) { /* no sound */ }
    if (m.fw !== false) { game.fwCar = c; fireworks.start(c.x, c.group.position.y, c.z, c.h, m.pos === 1 ? 12 : 8, g => { try { sound.boom(g); } catch (e) { /* no sound */ } }); }
    radio(c.name + (m.pos === 1 ? ' wins!' : ' is on the podium!') + (msg ? ' "' + msg + '"' : (m.fw !== false ? ' VIP fireworks!' : '')), 'good', 6);
  }
});

/* ---------------- Online qualifying: everyone does an out lap + two flying laps on their own track,
   lap times are shared, then the host starts the race with the grid in time order ---------------- */
function startMpQuali(cfg) {
  game.q = { stages: ['Q'], idx: 0, entrants: game.cars.slice(), out: [], results: {}, elim: { Q: 0 }, mp: true };
  for (const c of game.cars) c.qDone = false;
  startSession('Q');
  radio('Online qualifying. Out lap, then two flying laps. Fastest starts on pole!', 'info', 7);
  clearTimeout(game.mpQualiT);
  // the host closes qualifying once everyone is done, or after a time limit if someone is stuck or gone
  if (net.isHost) game.mpQualiT = setTimeout(() => mpQualiFinish(cfg), (game.lapEst * 4.5 + 60) * 1000);
}
function mpSendQuali() {
  const p = game.player; if (!game.mp || !game.q || !p) return;
  net.broadcast('qlap', { race: game.mp.race, best: isFinite(p.sessBest) ? p.sessBest : null, done: p.timedLaps >= 2 ? 1 : 0 });
  if (p.timedLaps >= 2) { p.qDone = true; mpQualiCheck(); }
}
function mpQualiLap(m) {
  if (!game.mp || !game.q || !game.q.mp || m.race !== game.mp.race) return;
  const c = carByNet(m.from); if (!c) return;
  if (m.best) game.q.cur.times[c.code] = m.best;
  if (m.done) c.qDone = true;
  if (!$('qres').classList.contains('hidden')) mpQualiTable();
  mpQualiCheck();
}
function mpQualiCheck() {
  if (!net.isHost || !game.q || !game.q.mp) return;
  if (game.cars.every(c => c.qDone || c.netGone)) mpQualiFinish(game.mp);
}
function mpQualiOrder() {
  const t = Object.assign({}, game.q.cur.times, { YOU: game.player.sessBest });
  return game.cars.slice().sort((a, b) => (isFinite(t[a.code]) ? t[a.code] : 1e9) - (isFinite(t[b.code]) ? t[b.code] : 1e9) || game.mp.grid.indexOf(a.netId) - game.mp.grid.indexOf(b.netId));
}
function mpQualiTable() {
  const ent = mpQualiOrder(), t = Object.assign({}, game.q.cur.times, { YOU: game.player.sessBest });
  game.q.results.Q = ent.map(c => ({ c, t: t[c.code] }));
  showQualiResults('Q', ent, 0);
  const waiting = game.cars.filter(c => !c.qDone && !c.netGone).length;
  $('qNext').textContent = waiting ? 'Waiting for ' + waiting + ' more driver' + (waiting > 1 ? 's' : '') + '…' : 'Starting the race…';
  $('qNext').disabled = true;
}
function mpQualiFinish(cfg) {
  if (!game.q || !game.q.mp || game.q.closed || !net.isHost || !game.mp || game.mp.race !== cfg.race) return;
  game.q.closed = true; clearTimeout(game.mpQualiT);
  const grid = mpQualiOrder().map(c => c.netId);
  const race = Object.assign({}, cfg, { quali: false, grid, goAt: 5.6 + Math.random() * 1.4, race: Date.now() });
  setTimeout(() => { net.broadcast('start', { cfg: race }); startMp(race); }, 3000);   // a moment to see the final order
  setTimeout(() => net.broadcast('start', { cfg: race }), 4200); setTimeout(() => net.broadcast('start', { cfg: race }), 6500);
}
net.on('data', (id, d) => {
  if (!d || d.k !== 's') return;
  const c = carByNet(id); if (!c || !game.mp) return;
  if (c.lastSeq !== undefined && d.n <= c.lastSeq && c.lastSeq - d.n < 1000) return; // late, out-of-order packet
  const now = performance.now(); c.lastSeq = d.n; d.tr = now;
  if (d.t !== undefined) {
    // sender clock -> our clock: the smallest (arrival - sent) seen is the best estimate (least-delayed packet);
    // it creeps up slowly so a clock drift or a route change is followed
    const off = now - d.t;
    if (c.netOff === undefined || off < c.netOff) c.netOff = off; else c.netOff += (off - c.netOff) * 0.004;
    c.netJit = (c.netJit || 20) * 0.95 + Math.abs(off - c.netOff) * 0.05;
    const last = c.snaps[c.snaps.length - 1];
    if (last && last.t !== undefined && d.t > last.t) c.netInt = (c.netInt || 60) * 0.9 + (d.t - last.t) * 0.1;
  }
  // insert in sender-time order (packets can arrive out of order)
  let k = c.snaps.length; while (k > 0 && c.snaps[k - 1].t > d.t) k--;
  c.snaps.splice(k, 0, d); if (c.snaps.length > 60) c.snaps.shift();
  if ((c.netGone || c.dnf) && !c.dsq) { c.netGone = false; c.dnf = false; c.retire = null; c.group.visible = true; }
});
function mpHostStart() {
  if (!net.isHost) return;
  if (game.ocPending && Date.now() < game.ocPending.at) return;   // championship races start on time, not early
  const players = (mpRandom ? net.room.slice(0, 2) : net.room).map(p => ({ id: p.id, name: String(p.name || 'Driver').slice(0, 16), livery: p.livery || 0, vx: p.vx || null, vip: !!p.vip, num: p.num || 0, hel: p.hel ?? -1, ocPid: p.ocPid || null }));
  const grid = players.map(p => p.id).sort(() => Math.random() - 0.5);
  const cfg = { series: SER.id, track: settings.track, laps: settings.laps, players, grid, goAt: 5.6 + Math.random() * 1.4, race: Date.now(), quali: settings.quali === 'on', oc: game.ocPending ? { id: game.ocPending.id, round: game.ocPending.round } : null };
  net.broadcast('start', { cfg }); startMp(cfg);
  setTimeout(() => net.broadcast('start', { cfg }), 1200); setTimeout(() => net.broadcast('start', { cfg }), 3500);
}
function startMp(cfg) {
  if (!cfg.players.some(p => p.id === net.id)) return;
  if (game.mp && game.mp.race === cfg.race) return; // already racing this one (repeat of the start message)
  if (cfg.series && cfg.series !== SER.id) { settings.series = cfg.series; applySeries(cfg.series); }
  settings.track = cfg.track;
  withLoading(() => {
    hideAllOverlays(); game.paused = false;
    const Tr = game.T = buildTrack(cfg.track);
    game.mp = cfg; game.laps = cfg.laps; game.skill = 50; game.season = null; game.q = null; $('qchat').classList.toggle('hidden', !isVip());
    TEAM_MAP = shuffleTeams();
    clearCars();
    cfg.players.forEach((pl, k) => {
      const lv = LIVERIES[pl.livery] ? pl.livery : 0, colr = LIVERIES[lv], acc = accentFor(lv), mine = pl.id === net.id;
      const mcls = SER.multiClass ? 'hyper' : SER.cls;
      const c = Object.assign(makeCar({ color: colr, accent: acc, helmet: '#ffffff', number: pl.num || k + 1, compound: 'medium', model: CLASSES[mcls].model, livery: { p: PATS[(pl.livery * 5) % PATS.length], c2: acc, c3: '#ffffff' } }), { cls: mcls, spec: CLASSES[mcls] },
        { name: pl.name, code: mpCode3(pl.name), team: mine ? 'Your Team' : 'Online', color: colr, isPlayer: mine, remote: !mine, netId: pl.id, pace: 1,
          teamIdx: mine ? TEAMS.length : k % TEAMS.length, per: personaOf(''), snaps: [], lastSeq: undefined, ocPid: pl.ocPid || null });
      vipFinish(c, lv); vipExtras(c, mine ? myExtras() : pl.vx); helmetDesign(c, mine ? myHelmet() : (pl.hel ?? -1)); c.vip = mine ? isVip() : !!pl.vip;
      if (c.vip && !mine) c.group.add(makeCrown());   // VIP crown over other VIP players' cars
      mergeCarStatic(c); if (!mine) addLodProxy(c); game.cars.push(c); if (mine) { game.player = c; addLiveMirrors(c, mirrorRT.texture); c.hasMirrors = true; }
    });
    game.mate = null;
    for (const c of game.cars) { resetState(c); c.stints = []; scene.add(c.group); }
    game.player.steering.visible = true;
    game.seed = 99; game.lapEst = estimateLap(Tr, aiPace(50), null, 1, CLASSES[SER.cls]); game.record = recordFor(Tr); game.fastest = Infinity; game.wxMode = 'dry';
    $('menu').classList.add('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden'); $('hud').classList.remove('hidden');
    buildMinimap(Tr); audio.init();
    game.grid = cfg.grid.map(carByNet).filter(Boolean);
    game.session = 'race-prep'; weather.setup(Tr, 'dry', game.lapEst * game.laps, 99);
    game.stratOpts = [{ name: 'Mediums', stints: [['medium', 0]] }]; game.stratPick = 0;
    if (cfg.quali) { startMpQuali(cfg); return; }
    startRace(); game.goAt = cfg.goAt;
    $('radio').innerHTML = '';
    radio('Online race at ' + Tr.def.name + ', ' + game.laps + ' laps, ' + game.cars.length + ' drivers. You start P' + (game.grid.indexOf(game.player) + 1) + '.', 'info', 7);
  });
}
/* remote cars: drawn a little in the past, between the two updates around that moment, timed by the SENDER's clock
   (so network jitter doesn't make them surge and stall). The delay adapts to how often updates arrive and how
   jittery they are; positions follow smooth curves using each update's velocity; and if a late update shows the
   car somewhere slightly different, it is eased across rather than snapped. */
function remoteStep(c, Tr, dt) {
  const S = c.snaps; if (!S.length) return;
  const now = performance.now(), off = c.netOff ?? 0;
  const delay = clamp((c.netInt || 60) * 1.7 + (c.netJit || 20) * 2.5 + 30, 90, 500);
  const rt = now - off - delay;                       // the moment to show, on the sender's clock
  while (S.length > 2 && S[1].t <= rt) S.shift();
  const a = S[0], b = S[1];
  let x, z, h, vh, v, prog, lat, src;
  if (b && rt >= a.t && rt <= b.t) {
    const T = Math.max(1, b.t - a.t), f = (rt - a.t) / T, Ts = T / 1000;
    // cubic Hermite between the two positions, using each one's velocity as the tangent
    const avx = Math.sin(a.vh) * a.v * Ts, avz = Math.cos(a.vh) * a.v * Ts, bvx = Math.sin(b.vh) * b.v * Ts, bvz = Math.cos(b.vh) * b.v * Ts;
    const f2 = f * f, f3 = f2 * f, h00 = 2 * f3 - 3 * f2 + 1, h10 = f3 - 2 * f2 + f, h01 = -2 * f3 + 3 * f2, h11 = f3 - f2;
    const curve = Math.hypot(b.x - a.x, b.z - a.z) < 60; // a teleport (pit, reset) is not a curve
    x = curve ? h00 * a.x + h10 * avx + h01 * b.x + h11 * bvx : a.x + (b.x - a.x) * f;
    z = curve ? h00 * a.z + h10 * avz + h01 * b.z + h11 * bvz : a.z + (b.z - a.z) * f;
    h = a.h + angDiff(b.h, a.h) * f; vh = a.vh + angDiff(b.vh, a.vh) * f;
    v = a.v + (b.v - a.v) * f; prog = a.prog + (b.prog - a.prog) * f; lat = a.lat + (b.lat - a.lat) * f; src = f < 0.5 ? a : b;
  } else {
    // ran out of updates: carry on along the last known path for a moment
    src = S[S.length - 1]; const ex = clamp((rt - src.t) / 1000, 0, 0.35);
    x = src.x + Math.sin(src.vh) * src.v * ex; z = src.z + Math.cos(src.vh) * src.v * ex; h = src.h + (src.yr || 0) * ex; vh = src.vh; v = src.v; prog = src.prog + src.v * ex / DS; lat = src.lat;
  }
  // soft correction: ease towards the computed spot unless it is far off (then jump)
  const err = Math.hypot(x - c.x, z - c.z), k = 1 - Math.exp(-(dt || 0.016) * 18);
  if (!c.netSeen || err > 12) { c.x = x; c.z = z; c.h = h; c.netSeen = true; }
  else { c.x += (x - c.x) * k; c.z += (z - c.z) * k; c.h += angDiff(h, c.h) * k; }
  Object.assign(c, { vh, v, lat, steer: src.st });
  c.prog = Math.max(c.prog, Math.round(prog)); c.idx = ((Math.round(prog) % Tr.N) + Tr.N) % Tr.N;
  c.netPit = !!src.pit; c.inp = { throttle: src.thr, brake: src.br, steer: src.st };
  if (src.cmp && c.tyre && c.tyre.comp !== src.cmp) setTyres(c, src.cmp);
  // silent for a while: hide the car (it comes back as soon as data arrives again); only after a long gap is it out
  const quiet = now - S[S.length - 1].tr;
  c.group.visible = quiet < 4000;
  if (quiet > 45000 && !c.dnf) { c.dnf = true; c.retire = 'connection lost'; }
}
setInterval(() => { if (game.mp && game.state === 'race') mpSend(); }, 1000 / 20);
function mpSend() {
  const p = game.player; if (!p) return;
  net.sendFast({ k: 's', n: ++mpSeq, t: Math.round(performance.now()), yr: +((p.r || 0)).toFixed(3), x: +p.x.toFixed(2), z: +p.z.toFixed(2), h: +p.h.toFixed(3), vh: +p.vh.toFixed(3), v: +p.v.toFixed(2), prog: +p.prog.toFixed(1), lat: +p.lat.toFixed(2),
    st: +p.steer.toFixed(2), thr: p.inp.throttle, br: p.inp.brake, pit: !!p.pit, cmp: p.tyre && p.tyre.comp });
}

/* ---------------- Talk to the race engineer (R, then 1-8) ---------------- */
const ENG = [
  { q: 'How are my tyres?', a: engTyres },
  { q: 'What are the gaps?', a: engGaps },
  { q: "What's the weather doing?", a: engWeather },
  { q: 'How is my pace?', a: engPace },
  { q: 'Tell me about the car behind', a: engBehind },
  { q: 'Change mode (Save / Standard / Push)', a: engMode },
  { q: 'Box this lap / stay out', a: engBox },
  { q: 'Ask my teammate to let me by', a: engMate },
  { q: 'Next tyres', a: engTyreChoice },
];
function engMenu(open) {
  const el = $('engMenu'), show = open === undefined ? el.classList.contains('hidden') : open;
  if (show && !(game.state === 'race' && game.player && game.phase !== 'idle')) return;
  if (show) el.innerHTML = '<div class="eh">TEAM RADIO <small>press a number</small></div>' + ENG.map((o, k) => '<button data-k="' + k + '"><kbd>' + (k + 1) + '</kbd>' + (o.a === engTyreChoice ? 'Next tyres: ' + (game.player.tyreChoice ? COMP[game.player.tyreChoice].name : 'team choice') + ' <small>(press again to change)</small>' : o.q.replace('(Save / Standard / Push)', '(now ' + MODES[game.mode ?? 1].name + ')')) + '</button>').join('');
  el.classList.toggle('hidden', !show);
}
function engAsk(k) {
  const o = ENG[k]; if (!o) return;
  if (o.a === engTyreChoice) { const r = o.a(); engMenu(true); radio(r[0], r[1], 4); return; }
  engMenu(false);
  radio(o.q.replace(' (Save / Standard / Push)', ''), 'info', 4, 'YOU');
  setTimeout(() => { const r = o.a(); if (r) radio(r[0], r[1] || 'info', 7); }, 900 + Math.random() * 700);
}
const inRace = () => racing() && game.player && !game.player.dnf;
function engTyres() {
  const p = game.player, w = p.tyre.wear, name = COMP[p.tyre.comp].name + 's';
  if (!isRace()) return ['Tyres are fine for this session. Just push.'];
  const laps = Math.max(0.5, curLap(p) - (p.tyreLap || 1) + 1), perLap = w / laps, left = perLap > 0.005 ? Math.max(0, Math.floor((1 - w) / perLap)) : 99;
  const pct = Math.round(w * 100);
  if (w > 1) return [name + ' are finished, ' + pct + '% worn. We need to box.', 'warn'];
  return [name + ' at ' + pct + '% wear. ' + (left > game.laps - curLap(p) ? 'They will make it to the end.' : 'Good for about ' + left + ' more lap' + (left === 1 ? '' : 's') + '.'), w > 0.7 ? 'warn' : 'info'];
}
function engGaps() {
  if (!inRace()) return ['No gaps to give you in this session. Focus on your lap.'];
  const p = game.player, st = standings(), i = st.indexOf(p), a = st[i - 1], b = st[i + 1], parts = ['You are P' + (i + 1) + ' of ' + st.length + '.'];
  if (a) { const g = gapTo(p, a); parts.push(a.code + ' ahead' + (g !== null ? ' by ' + g.toFixed(1) + 's' : '') + '.'); } else parts.push('You are leading!');
  if (b) { const g = gapTo(p, b); parts.push(b.code + ' behind' + (g !== null ? ' by ' + g.toFixed(1) + 's' : '') + '.'); }
  return [parts.join(' ')];
}
function engWeather() {
  const t = game.raceTime, g = weather.global(t), nr = weather.nextRain(t), avg = weather.average();
  if (g > 0.05) return [(g > 0.6 ? 'Heavy rain' : g > 0.3 ? 'Steady rain' : 'Light rain') + ' right now. Track is ' + Math.round(avg * 100) + '% wet.' + (SLICK(game.player.tyre.comp) && avg > 0.3 ? ' Consider boxing for inters.' : ''), 'warn'];
  if (nr - t < 120) return ['Rain expected in about ' + Math.max(10, Math.round((nr - t) / 10) * 10) + ' seconds.', 'warn'];
  if (avg > 0.1) return ['No rain, track is drying. ' + Math.round(avg * 100) + '% wet now.'];
  return ['Dry, and the radar looks clear for now.'];
}
function engPace() {
  const p = game.player; if (!p.lastLap) return ['Complete a lap and I will tell you.'];
  let best = null; for (const c of game.cars) if (c !== p && c.active && !c.dnf && c.lastLap && (!best || c.lastLap < best.lastLap)) best = c;
  if (!best) return ['Your last lap was ' + fmt(p.lastLap) + '.'];
  const d = p.lastLap - best.lastLap;
  return [d <= 0 ? 'You are the fastest car on track! Last lap ' + fmt(p.lastLap) + '.' : 'Last lap ' + fmt(p.lastLap) + '. Fastest is ' + best.code + ', ' + d.toFixed(2) + 's quicker.', d <= 0 ? 'good' : 'info'];
}
function engBehind() {
  if (!inRace()) return ['Nobody racing you in this session.'];
  const p = game.player, st = standings(), b = st[st.indexOf(p) + 1];
  if (!b) return ['Nobody behind you. You are last.'];
  const g = gapTo(p, b), faster = b.lastLap && p.lastLap && b.lastLap < p.lastLap - 0.1, per = b.per || personaOf(b.code);
  const style = per.agg > 0.85 ? ' Very aggressive, expect a late lunge.' : per.def > 0.85 ? ' Smart racer, will wait for your mistake.' : per.cons < 0.75 ? ' Can make mistakes under pressure.' : '';
  return [b.code + (g !== null ? ', ' + g.toFixed(1) + 's behind' : '') + ' on ' + Math.round(b.tyre.wear * 100) + '% worn ' + COMP[b.tyre.comp].name + 's. ' + (faster ? 'They are faster than you.' : 'You are quicker.') + style, faster ? 'warn' : 'info'];
}
function engMode() {
  game.mode = ((game.mode ?? 1) + 1) % 3; const m = MODES[game.mode];
  return [{ SAVE: 'Copy, tyre save mode. Less pace, much less wear.', STANDARD: 'Copy, standard mode.', PUSH: 'Copy, push mode! More pace, but the tyres will go off faster.' }[m.name], m.name === 'PUSH' ? 'good' : 'info'];
}
function engBox() {
  const p = game.player;
  if (!(racing() || game.phase === 'run') || p.pit) return ['Not now.'];
  p.pitReq = !p.pitReq; return [p.pitReq ? 'Copy, box this lap. ' + COMP[nextCompound(p)].name + 's ready.' : 'Copy, staying out.'];
}
const TYRE_CYCLE = [null, 'soft', 'medium', 'hard', 'inter', 'wet'];
function engTyreChoice() {
  const p = game.player, k = (TYRE_CYCLE.indexOf(p.tyreChoice || null) + 1) % TYRE_CYCLE.length;
  p.tyreChoice = TYRE_CYCLE[k];
  return [p.tyreChoice ? 'Copy, ' + COMP[p.tyreChoice].name + 's ready for the next stop.' + (p.pitReq ? '' : ' Press 7 or P to box.') : 'Copy, we will choose the tyres for you.', 'info'];
}
function engMate() {
  const p = game.player, m = game.mate;
  if (!inRace() || !m || m.dnf || settings.mode === 'tt') return ['You do not have a teammate on track.'];
  if (m.prog < p.prog) return ['You are already ahead of ' + m.code + '.'];
  if (m.prog - p.prog > 60) return ['You need to be closer to ' + m.code + ' first.'];
  if (!p.lastLap || !m.lastLap || p.lastLap < m.lastLap + 0.3) { m.yieldT = 14; return ['OK, we have told ' + m.code + ' to let you by.', 'good']; }
  return ['Negative. ' + m.code + ' is faster than you. Hold position.', 'warn'];
}

/* ---------------- Effects ---------------- */
const tmpC = new THREE.Color();
const SNOWC = new THREE.Color('#f4f8fb'), DERBY_SMOKE = new THREE.Color('#3a3a3a');
const FLAME = new THREE.Color(3, 1.3, 0.35), FLAME2 = new THREE.Color(0.7, 1.1, 3);
const SMOKE = new THREE.Color('#e9e9ea'), DUST = new THREE.Color('#c9b48a'), GRASS = new THREE.Color('#6b7a3a'), SPARK = new THREE.Color(3, 1.6, 0.5), SPRAY = new THREE.Color('#c5ccd4');
function carEffects(c, dt) {
  if (!c.active || !c.group.visible) return;
  const camD = Math.hypot(c.x - camera.position.x, c.z - camera.position.z);
  if (camD > 220) { for (let k = 0; k < 2; k++) skids.lift(c.code + k); return; }
  const fx = Math.sin(c.h), fz = Math.cos(c.h), lx = Math.cos(c.h), lz = -Math.sin(c.h), sp = Math.abs(c.v);
  const wheel = (side, z) => [c.x + lx * side * 0.83 + fx * z, c.z + lz * side * 0.83 + fz * z];
  const wet = weather.wetAt(c.idx), ey = c.group.position.y;
  const lock = (c.isPlayer && !c.autopilot && c.inp.brake > 0.8 && sp > 25 && Math.abs(c.steer) > 0.5) || (c.lockFx > 0 && sp > 15);
  const sliding = lock || c.scrub > 0.9 || Math.abs(c.slip) > 0.35;
  [[1, AXLE_F], [-1, AXLE_F]].forEach(([s, z], k) => {
    const [x, wz] = wheel(s, z);
    if (sliding && c.surf <= 2 && wet < 0.3) {
      skids.mark(c.code + k, x, wz, fx, fz, 0.55, ey);
      if (Math.random() < dt * 40) smoke.spawn(x, ey + 0.3, wz, -fx * sp * 0.15 + (Math.random() - 0.5), 0.6 + Math.random(), -fz * sp * 0.15 + (Math.random() - 0.5), 1.4 + Math.random(), 0.8, 4.5, c.smokeCol ? 0.5 : 0.32, c.smokeCol || SMOKE, 1.2);
    } else skids.lift(c.code + k);
  });
  // VIP coloured tyre smoke: easy to show off. Rear-wheel burnout pulling away hard, puffs in any slide and
  // under heavy braking, in bigger brighter clouds than normal smoke
  if (c.smokeCol && c.inp && wet < 0.3 && c.surf <= 2) {
    const thr = c.inp.throttle || 0, brk = c.inp.brake || 0, inPit = c.pit || c.inPitRoad;
    // burnout: only when pulling away hard from (nearly) a standstill, for at most about two seconds
    if (sp < 3) c.burnT = 2.2; else c.burnT = Math.max(0, (c.burnT || 0) - dt);
    const burn = !inPit && thr > 0.8 && sp > 0.5 && sp < 16 && c.burnT > 0, slideAmt = Math.abs(c.slip) > 0.12 || c.scrub > 0.6, brake = brk > 0.7 && sp > 18;
    const rate = inPit ? 0 : burn ? 16 : slideAmt ? 14 : brake ? 8 : 0;
    if (rate) for (const s2 of [1, -1]) {
      const [x, wz] = wheel(s2, brake && !burn ? AXLE_F : AXLE_R);
      if (Math.random() < dt * rate) smoke.spawn(x, ey + 0.35, wz, -fx * sp * 0.12 + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.2, -fz * sp * 0.12 + (Math.random() - 0.5) * 1.5, 1.1 + Math.random() * 0.6, 0.7, 3.2, 0.3, c.smokeCol, 1.4);
    }
  }
  // loose surfaces: a dust (or snow) trail kicked up behind every car
  if (T().gripMul < 1 && sp > 8 && c.surf <= 2) {
    const snow = T().surface === 'snow';
    for (const s2 of [1, -1]) if (Math.random() < dt * (6 + sp * 0.5)) { const [x, wz] = wheel(s2, AXLE_R - 0.3); smoke.spawn(x, ey + 0.3, wz, -fx * sp * 0.25 + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.4, -fz * sp * 0.25 + (Math.random() - 0.5) * 2, 1.6 + Math.random() * 1.4, 1.0, 6, snow ? 0.5 : 0.36, snow ? SNOWC : DUST, 1.1); }
  }
  // VIP exhaust flames: a burst of flame when lifting off at speed, and pops while coasting at high revs
  if (c.flames && c.inp) {
    const thr = c.inp.throttle || 0, lift = (c.prevThr || 0) > 0.7 && thr < 0.15 && sp > 25;
    if (lift || (thr < 0.1 && sp > 35 && Math.random() < dt * 5)) {
      const ex = c.x - fx * (c.closed ? 2.3 : 2.6), ez = c.z - fz * (c.closed ? 2.3 : 2.6), n = lift ? 16 : 5;
      for (let k = 0; k < n; k++) sparks.spawn(ex + (Math.random() - 0.5) * 0.2, ey + (c.closed ? 0.4 : 0.55), ez + (Math.random() - 0.5) * 0.2, -fx * (4 + Math.random() * 5) + (Math.random() - 0.5) * 1.5, (Math.random() - 0.3) * 1.2, -fz * (4 + Math.random() * 5) + (Math.random() - 0.5) * 1.5, 0.12 + Math.random() * 0.12, 0.5, 0.15, 1, Math.random() < 0.3 ? FLAME2 : FLAME, 3, 0);
    }
    c.prevThr = thr;
  }
  // spray off the rear tyres in the wet
  if (wet > 0.2 && sp > 15 && Math.random() < dt * 60 * wet) {
    const [x, wz] = wheel(Math.random() < 0.5 ? 1 : -1, -1.7);
    smoke.spawn(x, ey + 0.5, wz, -fx * sp * 0.35 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -fz * sp * 0.35 + (Math.random() - 0.5) * 2, 0.9 + Math.random() * 0.6, 1.2, 6, 0.16 + 0.12 * wet, SPRAY, 1.6);
  }
  if (c.surf >= 3 && sp > 6) {
    for (const s of [1, -1]) {
      const [x, wz] = wheel(s, AXLE_R);
      if (Math.random() < dt * 30) { tmpC.copy(c.surf === 3 ? DUST : GRASS); smoke.spawn(x, ey + 0.25, wz, -fx * sp * 0.2 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -fz * sp * 0.2 + (Math.random() - 0.5) * 2, 1.6, 1, 5, c.surf === 3 ? 0.55 : 0.35, tmpC, 1); }
    }
  }
  c.sparkT -= dt;
  const sparkRate = wet > 0.3 ? 0 : (sp > 62 && Math.abs(T().curv[c.idx]) < 0.003 ? 0.6 : 0) + (c.surf === 1 && sp > 35 ? 3 : 0);
  if (c.sparkT <= 0 && sparkRate > 0 && Math.random() < sparkRate * dt * 8) {
    c.sparkT = 0.15 + Math.random() * 0.4;
    for (let k = 0; k < 14; k++) sparks.spawn(c.x - fx * 1.9 + (Math.random() - 0.5) * 0.6, ey + 0.06, c.z - fz * 1.9 + (Math.random() - 0.5) * 0.6, -fx * sp * 0.35 + (Math.random() - 0.5) * 4, 0.5 + Math.random() * 2.5, -fz * sp * 0.35 + (Math.random() - 0.5) * 4, 0.25 + Math.random() * 0.35, 0.22, 0.08, 1, SPARK, 2, 9.8);
  }
  if (c.hitT > 0.05) {
    for (let k = 0; k < 30 * c.hitT; k++) sparks.spawn(c.x + lx * (c.hitSide || 1) * 0.9, ey + 0.4, c.z + lz * (c.hitSide || 1) * 0.9, fx * sp * 0.5 + (Math.random() - 0.5) * 8, Math.random() * 5, fz * sp * 0.5 + (Math.random() - 0.5) * 8, 0.3 + Math.random() * 0.4, 0.25, 0.1, 1, SPARK, 1.5, 9.8);
    smoke.spawn(c.x, ey + 0.6, c.z, 0, 1, 0, 1.5, 1, 6, 0.3 * c.hitT, SMOKE, 1);
    c.hitT = 0;
  }
  if (c.dmg.punct && sp > 8 && Math.random() < dt * 20) sparks.spawn(c.x, ey + 0.05, c.z, -fx * sp * 0.3, Math.random() * 2, -fz * sp * 0.3, 0.3, 0.2, 0.08, 1, SPARK, 2, 9.8);
}

/* ---------------- Update ---------------- */
let msgTimer = 0, tickT = 0;
function flashMsg(text, dur, sub) { $('msg').innerHTML = text + (sub ? '<small>' + sub + '</small>' : ''); $('msg').classList.add('show'); msgTimer = dur; }
function setStartLights(n) { world.setStartLights(n); [...$('startLights').children].forEach((p, k) => p.classList.toggle('on', k < n)); }

function update(dt) {
  const Tr = game.T, p = game.player;
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('msg').classList.remove('show'); }
  pumpRadio();
  if (game.phase === 'idle') return;
  if (game.phase === 'red') { game.redT -= dt; if (game.redT <= 0) restartFromRed(); return; }
  if (game.phase === 'garage') { p.rpm += (4000 - p.rpm) * Math.min(1, dt * 2); if (keys.w) leaveGarage(); return; }
  if (game.phase === 'lights') {
    game.lightsT += dt;
    setStartLights(Math.min(5, Math.floor(game.lightsT)));
    if (game.lightsT >= game.goAt) { game.phase = 'race'; setStartLights(0); flashMsg('GO!', 1.2); }
    const rev = keys.w ? 1 : 0;
    p.rpm += ((rev ? 11000 : 4000) - p.rpm) * Math.min(1, dt * (rev ? 4 : 2));
    audio.set(p.rpm, rev, true);
    return;
  }
  game.raceTime += dt;
  weather.update(dt, game.raceTime);
  if (game.raceTime > 1 && !$('startLights').classList.contains('hidden')) $('startLights').classList.add('hidden');
  computeTow();
  updateChamp(dt);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
  if (game.mp) { for (const c of game.cars) if (c.remote && c.active && !c.dnf) remoteStep(c, Tr, dt); }
  for (let s = 0; s < steps; s++) {
    for (const c of game.cars) {
      if (!c.active || c.remote || c.celebrate) continue;
      let inp = (c.isPlayer && !c.autopilot) ? playerInput(c, h) : aiInput(c, h, Tr);
      if (c.startDelay > 0) { c.startDelay -= h; inp = { throttle: 0, brake: 0, steer: 0 }; }
      c.inp = inp;
      const prev = c.idx; const wasPit = !!c.pit;
      stepCar(c, inp, h, Tr);
      if (!c.pit && !wasPit && c.inPitRoad && crossed(Tr.N, prev, c.idx, (Tr.pit.entry + Tr.pit.limIn) % Tr.N) && !c.dnf) {
        if (racing() && c.v > 25.5) addPenalty(c, 5, 'speeding in the pit lane');
        c.pit = { stage: 'in', k: Tr.pit.limIn, lat0: c.lat, wait: 0, stopAtBox: c.pitReq && !c.finished }; c.drsOpen = false;
        if (c.isPlayer) radio(c.pit.stopAtBox ? 'Pit limiter on. Crew are ready.' : 'Pit limiter on. Drive-through, we are not stopping.', 'info', 2.5);
      }
      drsLogic(c, prev, Tr);
      pitDecision(c, prev, Tr);
      wrongWay(c, h, Tr);
    }
    collide(); derbyTick(h);
    for (const c of game.cars) if (c.active && !c.celebrate) checkLaps(c, Tr);
  }
  // quali: reveal rival lap times as the session goes on
  if (game.q && game.q.cur && !isRace() && game.session !== 'tt') {
    for (const r of game.q.cur.reveal) if (!r.shown && game.raceTime >= r.at) { r.shown = true; game.q.cur.times[r.c.code] = r.t; }
    if (game.sessionEndAt && game.raceTime >= game.sessionEndAt) { game.sessionEndAt = 0; endQualiSession(); }
  }
  tickT -= dt; if (tickT <= 0) { tickT = 1; engineerTick(); }
  updateFlags(dt);
  if (isRace() && game.resultsAt && game.raceTime >= game.resultsAt && $('results').classList.contains('hidden')) showResults();
}

/* road height and grade under a car, interpolated between the 2 m track samples so slopes are smooth
   (using the nearest sample alone made the car step up and down on every hill) */
function surfAt(Tr, c) {
  const i = c.idx, N = Tr.N, f = ((c.x - Tr.px[i]) * Tr.tx[i] + (c.z - Tr.pz[i]) * Tr.tz[i]) / DS;
  const j = f >= 0 ? (i + 1) % N : (i - 1 + N) % N, a = Math.min(1, Math.abs(f));
  return { h: bankH(Tr, i, c.lat) * (1 - a) + bankH(Tr, j, c.lat) * a, g: (Tr.grade[i] || 0) * (1 - a) + (Tr.grade[j] || 0) * a };
}
function updateCarVisuals(dt) {
  for (const c of game.cars) {
    if (!c.group.visible) continue;
    c.group.position.set(c.x, 0, c.z); c.group.rotation.order = 'YXZ'; c.group.rotation.y = c.h;
    if (c.lodProxy) { const dC = Math.hypot(c.x - camera.position.x, c.z - camera.position.z); setCarLod(c, c.lodFar ? dC > 34 : dC > 42); }   // far cars: one merged mesh
    if (c.spec && c.spec.slide && !c.isPlayer && !c.dnf) {
      // AI rally cars slide too: the nose points into the corner, more the faster and tighter it is
      const Tr2 = game.T, j = (c.idx + 6) % Tr2.N, turn = angDiff(Math.atan2(Tr2.tx[j], Tr2.tz[j]), Math.atan2(Tr2.tx[c.idx], Tr2.tz[c.idx]));
      const want = Math.sign(turn) * Math.min(0.38, Math.abs(c.v) * Math.abs(Tr2.rk[c.idx]) * Math.abs(c.v) * 0.012);
      c.driftVis = (c.driftVis || 0) + (want - (c.driftVis || 0)) * Math.min(1, dt * 3);
      c.group.rotation.y += c.driftVis; c.scrub = Math.max(c.scrub || 0, Math.min(1, Math.abs(c.driftVis) * 2.5));
    }
    c.wheelRot += c.v * dt / 0.36;
    for (const w of c.wheels) { w.spin.rotation.x = c.wheelRot; if (w.front) w.pivot.rotation.y = c.steer * 0.32; }
    c.steering.rotation.z = -c.steer * 0.9;
    const surf = surfAt(game.T, c);
    const tgtPitch = (c.inp.brake ? 0.012 : 0) - (c.inp.throttle && c.v < 60 ? 0.006 : 0) - Math.atan(surf.g) * Math.cos(angDiff(c.h, Math.atan2(game.T.tx[c.idx], game.T.tz[c.idx]))), tgtRoll = -c.steer * Math.min(1, Math.abs(c.v) / 50) * 0.012 + c.dmg.pull * 0.15;
    c.group.rotation.x += (tgtPitch - c.group.rotation.x) * Math.min(1, dt * 6);
    c.roll = (c.roll || 0) + (tgtRoll - (c.roll || 0)) * Math.min(1, dt * 6); c.group.rotation.z = c.roll;
    const Tb = game.T, bh = surf.h, inBank = Math.abs(c.lat) < W + KERB + 2 ? Math.atan(Tb.bank[c.idx]) : 0;
    c.group.rotation.z += inBank;
    // riding up over the kerb bump (and a little rattle across its stripes)
    const onKerb = c.surf === 1 ? kerbHeight(Math.abs(c.lat) - W) * 0.85 : 0;
    c.group.position.y = bh + (c.lift || 0) + onKerb + ((c.surf === 1 && Math.abs(c.v) > 10) ? Math.sin(performance.now() * 0.08 + c.x) * 0.012 : (c.dmg.punct ? -0.05 : 0));
    const sp = Math.abs(c.v);
    if (c.v < -0.5) { c.gear = -1; c.rpm = 4500 + sp * 400; }
    else {
      const spV = sp / ((c.spec && c.spec.vmax) || 1);
      let g = 1; while (g < 8 && spV > GEARS[g]) g++;
      c.gear = spV < 0.3 ? 0 : g;
      const lo = GEARS[g - 1], hi = GEARS[g] === 200 ? 91 : GEARS[g];
      c.rpm = c.gear === 0 ? 4000 : 5200 + clamp((spV - lo) / (hi - lo), 0, 1) * 6800;
    }
    if (game.phase !== 'lights' && game.phase !== 'garage') carEffects(c, dt);
  }
  smoke.update(dt); sparks.update(dt);
  ghostTick(dt);
  // VIP: fireworks over the track on the podium, the big 12 s show for a win
  if (game.player && game.player.finished && isRace() && !game.fwDone) {
    game.fwDone = true;
    const pos = positionOf(game.player);
    if (isVip() && pos <= 3) {
      const fw = settings.vipFw !== false, msg = vipMsgText();
      try { sound.horn(); } catch (e) { /* no sound */ }
      if (msg) radio('You: "' + msg + '"', 'good', 5);
      if (pos === 1 && settings.vipDonuts !== false && !game.champ) { game.champ = { t: 0, vip: true }; if (!game.mp) game.resultsAt = Math.max(game.resultsAt, game.raceTime + 22); }
      if (game.mp) { net.broadcast('fw', { pos, fw, msg }); setTimeout(() => net.broadcast('fw', { pos, fw, msg }), 1500); }   // everyone in the race sees and hears it
    }
    if (isVip() && settings.vipFw !== false && pos <= 3) {
      const p = game.player;
      game.fwCar = p; fireworks.start(p.x, p.group.position.y, p.z, p.h, pos === 1 ? 12 : 8, g => { try { sound.boom(g); } catch (e) { /* no sound */ } });
      if (!game.mp) game.resultsAt = Math.max(game.resultsAt, game.raceTime + (pos === 1 ? 9 : 6)); // let the show play before the results card
    }
  }
  if (fireworks.t > 0) { const p = game.fwCar || game.player; if (p) Object.assign(fireworks.o, { x: p.x, y: p.group.position.y, z: p.z, h: p.h }); }
  fireworks.update(dt);
}

/* racing line colours worked out for the player's own car (its class and extra grip), braking as late as it can */
function colorLineForPlayer() {
  const p = game.player, Tr = game.T; if (!p || !Tr) return;
  const sp = p.spec || CLASSES.f1;
  world.colorRaceLine(speedProfiles(Tr, { grip: sp.grip * PLAYER_GRIP / AI_GRIP, brake: sp.brake, vmax: sp.vmax })[1], sp);
}
/* ---------------- Mirrors: a small rear-view picture for the cockpit mirrors ---------------- */
const mirrorRT = new THREE.WebGLRenderTarget(384, 128);
mirrorRT.texture.wrapS = THREE.RepeatWrapping; mirrorRT.texture.repeat.x = -1; mirrorRT.texture.offset.x = 1; // mirror image
const rearCam = new THREE.PerspectiveCamera(46, 3, 0.4, 900);
let mirrorTick = 0;
function renderMirrors() {
  const p = game.player; if (!p || !p.hasMirrors || game.camMode !== 0) return;
  if (++mirrorTick % (document.body.classList.contains('touchUI') ? 3 : 2)) return;
  const g = p.group, E = p.eye || [0, 1, 0];
  g.localToWorld(rearCam.position.set(0, E[1] + 0.05, -0.4)); g.localToWorld(tmpL.set(0, E[1] - 0.25, -30)); rearCam.lookAt(tmpL);
  const was = p.steering.visible; p.steering.visible = false;
  renderer.setRenderTarget(mirrorRT); renderer.render(scene, rearCam); renderer.setRenderTarget(null);
  p.steering.visible = was;
}
/* ---------------- Camera ---------------- */
const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function setCam(m, silent) {
  game.camMode = m; $('camName').textContent = CAMS[m];
  if (game.player) game.player.cockpitHide.forEach(o => o.visible = m !== 0);
  store.set('apexgp-cam', String(m)); camPos.set(0, 0, 0);
  if (!silent) flashMsg(CAMS[m], 0.9);
}
function updateCamera(dt, time) {
  if (game.champ && game.champ.cam) { champCamera(dt); return; }
  const c = game.player, g = c.group; g.updateMatrixWorld();
  if (c.pit && c.pit.stage === 'garage') {
    const ps = game.T.pit.side;
    g.localToWorld(tmpV.set(ps * 5.5, 2.4, 4.2)); g.localToWorld(tmpL.set(0, 0.5, 0.4));
    camera.position.copy(tmpV); camera.lookAt(tmpL); camera.fov = 50; camera.updateProjectionMatrix(); camPos.set(0, 0, 0); return;
  }
  const sp = Math.abs(c.v), shake = (c.surf === 1 ? 0.012 : 0.002) * Math.min(1, sp / 60);
  const jx = (Math.random() - 0.5) * shake, jy = (Math.random() - 0.5) * shake;
  if (game.camMode === 0) {
    const E = c.eye || [0, 0.92, 0.05];
    const latG = clamp((c.r || 0) * Math.abs(c.v) / 9.81, -4, 4), lonG = c.inp.brake ? 1 : c.inp.throttle && Math.abs(c.v) < 70 ? -0.4 : 0, kk = 1 - Math.exp(-dt * 6);
    c.headX = (c.headX || 0) + (clamp(-latG * 0.012, -0.045, 0.045) - (c.headX || 0)) * kk;
    c.headZ = (c.headZ || 0) + (lonG * 0.02 - (c.headZ || 0)) * kk;
    g.localToWorld(tmpV.set(E[0] + jx + c.headX, E[1] + jy - Math.abs(c.headZ) * 0.4, E[2] + c.headZ)); g.localToWorld(tmpL.set(E[0] + c.steer * 0.6, E[1] - (c.dash && !c.closed ? 0.35 : -0.02), 14));
    camera.position.copy(tmpV); camera.lookAt(tmpL); camera.fov = c.closed ? 72 : 78;
  } else if (game.camMode === 1) {
    const tc = c.tcam || [0, 1.36, -0.5, 0.8];
    g.localToWorld(tmpV.set(tc[0] + jx, tc[1] + jy, tc[2])); g.localToWorld(tmpL.set(tc[0], tc[3], tc[2] + 12.5));
    camera.position.copy(tmpV); camera.lookAt(tmpL); camera.fov = 68;
  } else {
    // chase cam follows the direction of travel so slides are visible
    const slipLook = clamp(c.slip, -0.6, 0.6);
    const big = c.closed === 'bus' ? 1.9 : 1;   // a double-decker needs the camera further back and higher
    g.localToWorld(tmpV.set(Math.sin(slipLook) * 9.8 * big, 2.9 * big * (big > 1 ? 1.3 : 1), -9.8 * big * Math.cos(slipLook))); g.localToWorld(tmpL.set(-c.steer * 1.2, 1.0 * big, 5));
    if (camPos.lengthSq() === 0) { camPos.copy(tmpV); camLook.copy(tmpL); }
    camPos.lerp(tmpV, 1 - Math.exp(-dt * 7)); camLook.lerp(tmpL, 1 - Math.exp(-dt * 12));
    camPos.y = Math.max(camPos.y, bankH(game.T, c.idx, c.lat) + 1.0);
    camera.position.copy(camPos).add(tmpV.set(jx * 4, jy * 4, 0)); camera.lookAt(camLook); camera.fov = 60 + sp * 0.1;
  }
  camera.updateProjectionMatrix();
}
function updateMenuCamera(dt) {
  const Tr = getTrack(settings.track);
  game.orbit += dt * 0.035;
  const i = Math.floor((game.orbit * 60) % Tr.N), j = (i + 40) % Tr.N, s = Math.sin(game.orbit * 0.7);
  camera.position.set(Tr.px[i] + Tr.nx[i] * (14 + 8 * s), elevAt(Tr, i) + 6 + 3 * Math.sin(game.orbit * 0.5), Tr.pz[i] + Tr.nz[i] * (14 + 8 * s));
  camera.lookAt(Tr.px[j], elevAt(Tr, j) + 1.5, Tr.pz[j]); camera.fov = 55; camera.updateProjectionMatrix();
}

/* ---------------- HUD ---------------- */
const mm = { ctx: $('minimap').getContext('2d'), bg: null, map: null };
function trackPath(pts, xs, zs, size, pad) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < pts; i++) { minX = Math.min(minX, xs(i)); maxX = Math.max(maxX, xs(i)); minZ = Math.min(minZ, zs(i)); maxZ = Math.max(maxZ, zs(i)); }
  const sx = maxX - minX, sz = maxZ - minZ, sc = (size - pad * 2) / Math.max(sx, sz), ox = (size - sx * sc) / 2, oz = (size - sz * sc) / 2;
  const map = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
  const path = new Path2D();
  for (let i = 0; i <= pts; i++) { const [x, y] = map(xs(i % pts), zs(i % pts)); i === 0 ? path.moveTo(x, y) : path.lineTo(x, y); }
  path.closePath();
  return { path, map };
}
function drawShape(ctx, path, map, start, lw) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = lw * 2.2; ctx.stroke(path);
  ctx.strokeStyle = '#e9edf3'; ctx.lineWidth = lw; ctx.stroke(path);
  const [sx, sy] = map(start[0], start[1]); ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(sx, sy, lw * 1.4, 0, Math.PI * 2); ctx.fill();
}
function buildMinimap(Tr) {
  const off = document.createElement('canvas'); off.width = off.height = 400;
  const { path, map } = trackPath(Math.floor(Tr.N / 3), i => Tr.px[i * 3], i => Tr.pz[i * 3], 400, 26);
  const g = off.getContext('2d');
  drawShape(g, path, map, [Tr.px[0], Tr.pz[0]], 7);
  for (const z of Tr.drs) {
    g.strokeStyle = '#22e05a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
    const len = (z.end - z.start + Tr.N) % Tr.N;
    for (let k = 0; k <= len; k += 3) { const i = (z.start + k) % Tr.N, [x, y] = map(Tr.px[i], Tr.pz[i]); k === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    const d = z.detect, [x, y] = map(Tr.px[d], Tr.pz[d]), nx = Tr.nx[d], nz = Tr.nz[d];
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - nx * 13, y - nz * 13); g.lineTo(x + nx * 13, y + nz * 13); g.stroke();
  }
  mm.bg = off; mm.map = map; mm.T = Tr;
}
function drawMinimap() {
  const ctx = mm.ctx; ctx.clearRect(0, 0, 400, 400); ctx.drawImage(mm.bg, 0, 0);
  // rain overlay along the lap
  const Tr = mm.T;
  if (weather.N && weather.global(game.raceTime) > 0.02) {
    ctx.lineWidth = 16; ctx.lineCap = 'butt';
    for (let i = 0; i < Tr.N; i += 6) { const r = weather.rainAt(i); if (r < 0.05) continue; const j = Math.min(Tr.N - 1, i + 6), [x1, y1] = mm.map(Tr.px[i], Tr.pz[i]), [x2, y2] = mm.map(Tr.px[j], Tr.pz[j]); ctx.strokeStyle = 'rgba(60,140,255,' + (0.15 + 0.5 * r) + ')'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  for (const c of game.cars) { if (c.isPlayer || !c.active || !c.group.visible) continue; const [x, y] = mm.map(c.x, c.z); ctx.fillStyle = c.dnf ? '#555' : c.color; ctx.strokeStyle = c.mate ? '#ffcc00' : '#000'; ctx.lineWidth = c.mate ? 4 : 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  const p = game.player, [x, y] = mm.map(p.x, p.z);
  ctx.fillStyle = '#ffcc00'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function updatePenTag() {
  const p = game.player, el = $('penTag'); if (!p) return;
  const parts = [];
  if (p.strikes) parts.push('TRACK LIMITS ' + Math.min(p.strikes, 3) + '/3');
  if (p.penalty) parts.push('+' + p.penalty + 's PENALTY');
  el.textContent = parts.join(' · '); el.classList.toggle('hidden', !parts.length);
}
function updateDrsHud() {
  const p = game.player, Tr = game.T, el = $('drs'), N = Tr.N;
  $('tow').className = (p.tow || 0) > 0.15 ? 'on' : 'hidden'; $('tow').textContent = 'SLIPSTREAM ' + Math.round((p.tow || 0) * 100) + '%';
  if (!Tr.drs.length || game.phase === 'lights' || game.phase === 'garage' || p.pit) { el.className = 'hidden'; return; }
  if (freeDrs() && !p.drsOpen) { let bd = Infinity; Tr.drs.forEach(z => { bd = Math.min(bd, ((z.start - p.idx + N) % N) * DS); }); if (bd <= 450) { el.className = 'armed'; el.textContent = 'DRS AVAILABLE · ' + Math.round(bd) + 'm'; } else el.className = 'hidden'; return; }
  if (p.drsOpen) { el.className = 'open'; el.textContent = 'DRS OPEN'; return; }
  let best = Infinity, bz = -1;
  Tr.drs.forEach((z, k) => { const d = ((z.start - p.idx + N) % N) * DS; if (d < best) { best = d; bz = k; } });
  if (best > 450) { el.className = 'hidden'; return; }
  if (p.drsArmed === bz) { el.className = 'armed'; el.textContent = 'DRS AVAILABLE · ' + Math.round(best) + 'm'; }
  else if (!drsEnabled(p)) { el.className = 'off'; el.textContent = 'DRS ZONE · ' + Math.round(best) + 'm · ' + (weather.average() >= 0.25 ? 'DISABLED (WET)' : 'DISABLED LAP 1'); }
  else { el.className = 'off'; el.textContent = 'DRS ZONE · ' + Math.round(best) + 'm' + (isFinite(p.drsGap) ? ' · GAP ' + p.drsGap.toFixed(1) + 's' : ''); }
}
function dmgColor(v) { return v < 0.05 ? '#2fd56a' : v < 0.4 ? '#f5c400' : v < 0.8 ? '#ff7a1a' : '#ff2a2a'; }
let boardT = 0;
let dashT = 0;
function updateHUD(dt) {
  const p = game.player, Tr = game.T, sess = game.session;
  $('hSpd').textContent = Math.round(Math.abs(p.v) * 3.6);
  $('hGear').textContent = p.pit ? 'P' : p.gear === -1 ? 'R' : p.gear === 0 ? 'N' : p.gear;
  $('hRpm').textContent = Math.round(p.rpm / 100) * 100;
  const lit = clamp(Math.floor((p.rpm - 7000) / 450), 0, 10);
  // live steering-wheel screen and shift lights in the cockpit view; the wheel replaces the dashboard panel
  $('speedo').classList.toggle('cockpitHide', game.camMode === 0 && !!p.dash);
  if (game.camMode === 0 && p.dash) { dashT -= dt; if (dashT <= 0) { dashT = 0.1; const st = isRace() ? standings() : null;
    updateDash(p, { gear: $('hGear').textContent, kmh: Math.round(Math.abs(p.v) * 3.6), frac: (p.rpm - 7000) / 4500, lap: isRace() ? 'L' + Math.min(game.laps, curLap(p)) + '/' + game.laps : '', pos: st ? 'P' + (st.indexOf(p) + 1) : '', delta: '' }); } }
  [...$('shift').children].forEach((el, k) => el.className = k < lit ? (k < 4 ? 'g' : k < 8 ? 'r' : 'b') : '');
  const timing = isRace() ? game.phase !== 'lights' : p.maxDone >= 0;
  const cur = timing ? game.raceTime - p.lapStart : 0;
  $('hCur').textContent = cur > 0 ? fmt(cur) : (isRace() ? '0:00.000' : 'OUT LAP');
  $('hCur').classList.toggle('invalid', p.lapInvalid && timing);
  $('hLast').textContent = fmt(p.lastLap); $('hBest').textContent = fmt(isRace() || sess === 'tt' ? p.bestLap : p.sessBest); $('hRec').textContent = fmt(game.record);
  const fwd = Math.sin(p.h) * Tr.tx[p.idx] + Math.cos(p.h) * Tr.tz[p.idx];
  $('wrongway').classList.toggle('hidden', !(fwd < -0.3 && p.v > 3 && game.phase === 'race' && !p.pit));
  // tyres, damage, pit, weather widgets
  const comp = COMP[p.tyre.comp], wearPct = Math.max(0, Math.round(100 - p.tyre.wear * 100));
  $('tyreBadge').textContent = comp.s; $('tyreBadge').style.setProperty('--tc', comp.color);
  $('tyreWear').textContent = wearPct + '%'; $('tyreWear').style.color = wearPct > 40 ? '#e9edf3' : wearPct > 10 ? '#f5c400' : '#ff3b3b';
  $('tyreName').textContent = comp.name.toUpperCase();
  const d = p.dmg;
  $('dFW').style.background = dmgColor(d.fw); $('dRW').style.background = dmgColor(d.rw); $('dSus').style.background = dmgColor(d.susp);
  ['dTL', 'dTR', 'dBL', 'dBR'].forEach(id => $(id).style.background = d.punct ? '#ff2a2a' : dmgColor(Math.min(1, p.tyre.wear) * 0.6));
  const pitEl = $('pitTag');
  if (p.pit && p.pit.stage !== 'garage') { pitEl.className = 'on'; pitEl.textContent = p.pit.stage === 'stop' ? 'PIT STOP · ' + Math.max(0, p.pit.wait).toFixed(1) + 's' : 'PIT LIMITER · 80'; }
  else if (p.pitReq) { pitEl.className = 'req'; pitEl.textContent = 'BOX THIS LAP · P TO CANCEL'; }
  else pitEl.className = 'hidden';
  const rain = weather.N ? weather.rainAt(p.idx) : 0, wetL = weather.N ? weather.wetAt(p.idx) : 0;
  $('wx').textContent = rain > 0.05 ? (rain > 0.6 ? 'HEAVY RAIN' : rain > 0.3 ? 'RAIN' : 'LIGHT RAIN') + ' · TRACK ' + Math.round(wetL * 100) + '% WET' : wetL > 0.08 ? 'DRYING · ' + Math.round(wetL * 100) + '% WET' : 'DRY';
  $('wx').className = rain > 0.05 || wetL > 0.08 ? 'wet' : '';
  if (sess !== 'tt') {
    if (isRace()) $('hLap').innerHTML = 'LAP <b>' + Math.min(game.laps, Math.max(1, p.maxDone + 1)) + '</b>/' + game.laps;
    else $('hLap').innerHTML = '<b>' + sess + '</b> · ' + (p.maxDone < 0 || p.outLap ? 'OUT LAP' : p.pit || p.pitReq ? 'IN LAP' : 'FLYING LAP ' + Math.min(2, p.timedLaps + 1) + '/2');
    boardT -= dt;
    if (boardT <= 0) { boardT = 0.25; isRace() ? raceBoard() : qualiBoard(); }
  }
  updateDrsHud();
  updateProximity(p);
  const P = Tr.pit, toEntry = ((P.entry - p.idx + Tr.N) % Tr.N) * DS;
  if (world.pitGuide) world.pitGuide.visible = !!(p.pitReq && !p.pit && !p.dnf);
  const hint = $('pitHint');
  if (p.pitReq && !p.pit && !p.inPitRoad && toEntry < 500) { hint.className = 'on'; hint.textContent = (P.side > 0 ? '◀ PIT ENTRY ' : 'PIT ENTRY ▶ ') + Math.round(toEntry) + 'm'; }
  else if (p.inPitRoad && !p.pit && ((p.idx - P.entry + Tr.N) % Tr.N) < P.limIn) { hint.className = 'on'; hint.textContent = 'SLOW TO 80 KM/H FOR THE LIMITER LINE'; }
  else hint.className = 'hidden';
  drawMinimap();
}
/* F1 25-style proximity arrows: chevrons beside your car pointing in at a car alongside, sliding up or down
   with how far ahead or behind it is, amber when close, red when you are overlapping wheel-to-wheel */
function updateProximity(p) {
  const side = { L: null, R: null }; let B = 0; const h = p.h, sh = Math.sin(h), ch = Math.cos(h);
  for (const o of game.cars) {
    if (o === p || !o.active || o.pit || !o.group.visible) continue;
    const dx = o.x - p.x, dz = o.z - p.z, fwd = dx * sh + dz * ch, left = dx * ch - dz * sh;
    if (fwd < -14 || fwd > 7 || Math.abs(left) > 7.5) continue;
    if (Math.abs(left) > 1.3) {
      const k = 1 - Math.min(1, Math.max(0, Math.abs(fwd) - 2) / 12) * 0.85, hot = Math.abs(fwd) < 5 && Math.abs(left) < 3.4, key = left > 0 ? 'L' : 'R';
      if (!side[key] || k > side[key].k) side[key] = { k, hot, fwd };
    } else if (fwd < -3) B = Math.max(B, 1 - Math.min(1, (-fwd - 3) / 11));
  }
  document.body.classList.toggle('cockpit', game.camMode === 0);
  for (const key of ['L', 'R']) {
    const el = $('prox' + key), s2 = side[key];
    if (!s2) { el.style.opacity = 0; continue; }
    el.style.opacity = s2.k; el.classList.toggle('hot', s2.hot);
    el.style.top = (game.camMode === 0 ? 50 - clamp(s2.fwd, -14, 7) * 0.9 : 55 - clamp(s2.fwd, -14, 7) * 1.4) + '%';
  }
  $('proxB').style.opacity = B;
}
function raceBoard() {
  const Tr = game.T, p = game.player, st = standings(), L = st[0];
  $('hPos').textContent = 'P' + (st.indexOf(p) + 1); $('hPosOf').textContent = '/' + st.length;
  let html = '';
  st.forEach((c, k) => {
    let gap;
    if (c.dnf) gap = 'OUT';
    else if (c.pit) gap = 'PIT';
    else if (k === 0) gap = c.finished ? 'FINISH' : 'LEADER';
    else if (c.finished && L.finished) gap = '+' + (c.finishTime - L.finishTime).toFixed(1);
    else if (L.prog - c.prog >= Tr.N) gap = '+' + Math.floor((L.prog - c.prog) / Tr.N) + ' LAP';
    else { const b = c.lastBucket, tl = L.splits[b], tc = c.splits[b]; gap = (tl !== undefined && tc !== undefined) ? '+' + Math.max(0, tc - tl).toFixed(1) : '—'; }
    html += '<div class="r' + (c.isPlayer ? ' me' : '') + (c.mate ? ' mate' : '') + (c.dnf ? ' out' : '') + '"><span class="p">' + (k + 1) + '</span><span class="c" style="background:' + c.color + '"></span><span class="n' + (c.vip ? ' vipn' : '') + '">' + c.code + (SER.multiClass && c.spec ? '<i class="cls ' + c.cls + '">' + (c.cls === 'gt3' ? 'GT3' : 'HY') + '</i>' : '') + '<i class="ty" style="--tc:' + COMP[c.tyre.comp].color + '">' + COMP[c.tyre.comp].s + '</i>' + (c.drsOpen ? '<i class="d">DRS</i>' : '') + (c.penalty ? '<i class="pen">+' + c.penalty + '</i>' : '') + '</span><span class="g">' + gap + '</span></div>';
  });
  $('board').innerHTML = html;
}
function qualiBoard() {
  const q = game.q, s = q.cur, p = game.player;
  const times = Object.assign({}, s.times, { YOU: p.sessBest });
  const ent = q.entrants.slice().sort((a, b) => (times[a.code] ?? 1e9) - (times[b.code] ?? 1e9));
  const cut = ent.length - (q.elim[s.name] || 0), best = times[ent[0].code];
  const myPos = ent.indexOf(p) + 1;
  $('hPos').textContent = 'P' + myPos; $('hPosOf').textContent = '/' + ent.length;
  let html = '';
  ent.forEach((c, k) => {
    const t = times[c.code], tStr = t && isFinite(t) ? (k === 0 ? fmt(t) : '+' + (t - best).toFixed(3)) : 'NO TIME';
    html += (k === cut ? '<div class="cut">KNOCK-OUT ZONE</div>' : '') + '<div class="r' + (c.isPlayer ? ' me' : '') + (k >= cut ? ' ko' : '') + '"><span class="p">' + (k + 1) + '</span><span class="c" style="background:' + c.color + '"></span><span class="n' + (c.vip ? ' vipn' : '') + '">' + c.code + '</span><span class="g">' + tStr + '</span></div>';
  });
  $('board').innerHTML = html;
}

/* ---------------- Results overlays ---------------- */
function showQualiResults(name, ent, elim) {
  const s = game.q.results[name], best = s[0].t, p = game.player, myPos = ent.indexOf(p) + 1, out = myPos > ent.length - elim;
  $('qTitle').textContent = (name === 'Q' ? 'Qualifying' : name) + ': P' + myPos + (out ? ', knocked out' : '');
  $('qTable').innerHTML = '<tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th></tr>' + s.map((r, k) => '<tr class="' + (r.c.isPlayer ? 'me' : '') + (k >= ent.length - elim ? ' ko' : '') + '"><td>' + (k + 1) + '</td><td><span class="sw" style="background:' + r.c.color + '"></span>' + r.c.name + '</td><td>' + r.c.team + '</td><td>' + (isFinite(r.t) ? (k === 0 ? fmt(r.t) : '+' + (r.t - best).toFixed(3)) : 'No time') + '</td></tr>').join('');
  const last = game.q.idx >= game.q.stages.length - 1 || out;
  $('qNext').textContent = last ? 'Continue to strategy' : 'Go to ' + game.q.stages[game.q.idx + 1];
  $('qNext').disabled = false;
  $('hud').classList.add('hidden'); $('qres').classList.remove('hidden');
}
function showResults() {
  const Tr = game.T, champ = settings.mode === 'champ';
  // two-compound rule for dry races
  if (game.laps >= 5 && !game.mp) for (const c of game.cars) { const st = c.stints || []; if (!c.dnf && !st.some(x => !SLICK(x)) && new Set(st).size < 2 && !c.rulePen) { c.rulePen = true; c.penalty += 30; } }
  const rows = game.cars.map(c => {
    let t = c.finishTime, est = false;
    if (!c.finished && !c.dnf) { t = game.raceTime + (game.laps * Tr.N - c.prog) * DS / Math.max(Math.abs(c.v), 30); est = true; }
    return { c, t: c.dnf ? Infinity : t + c.penalty, est };
  }).sort((a, b) => (a.t - b.t) || (b.c.prog - a.c.prog));
  let fl = Infinity; rows.forEach(r => fl = Math.min(fl, r.c.bestLap));
  const pIdx = rows.findIndex(r => r.c.isPlayer) + 1, pr = rows[pIdx - 1];
  $('resTitle').textContent = pr.c.dnf ? 'Retired' : pIdx === 1 ? 'Victory!' : 'Finished P' + pIdx;
  $('resSub').textContent = (champ ? 'Round ' + (calIdx().indexOf(settings.track) + 1) + ' of ' + calIdx().length + ' · ' : '') + Tr.def.name + ' · ' + game.laps + ' laps';
  let html = '<tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th><th>Best lap</th><th>Tyres</th>' + (champ ? '<th>Pts</th>' : '') + '</tr>';
  rows.forEach((r, k) => {
    const time = r.c.dsq ? 'DSQ' : r.c.wrecked ? 'WRECKED' : r.c.dnf ? 'DNF' : game.derby ? (k === 0 ? 'WINNER' : Math.round(r.c.hp ?? 100) + '% left') : k === 0 ? fmt(r.t) : '+' + (r.t - rows[0].t).toFixed(3) + (r.est ? '*' : '');
    const pts = !r.c.dnf && POINTS[k] ? POINTS[k] : 0;
    html += '<tr class="' + (r.c.isPlayer ? 'me' : '') + '"><td>' + (r.c.dnf ? '-' : k + 1) + '</td><td><span class="sw" style="background:' + r.c.color + '"></span>' + r.c.name + '</td><td>' + r.c.team + '</td><td>' + time + (r.c.penalty ? ' <span class="pen">(+' + r.c.penalty + 's)</span>' : '') + '</td><td class="' + (r.c.bestLap === fl ? 'fl' : '') + '">' + fmt(r.c.bestLap) + '</td><td>' + (r.c.stints || []).map(s => '<i class="tb sm" style="--tc:' + COMP[s].color + '">' + COMP[s].s + '</i>').join('') + '</td>' + (champ ? '<td><b>' + (pts ? '+' + pts : '') + '</b></td>' : '') + '</tr>';
    r.pts = pts;
  });
  $('resTable').innerHTML = html;
  if (game.mp && game.mp.oc) ocSubmitResults(rows);
  $('champBox').classList.add('hidden');
  $('rAgain').textContent = 'Race again';
  if (champ) {
    const s = game.season;
    rows.forEach(r => { s.pts[r.c.code] = (s.pts[r.c.code] || 0) + r.pts; });
    s.round++; s.finished = s.round >= calIdx().length; saveSeason(s);
    const names = { YOU: ['You', LIVERIES[myLivery()]] };
    s.lineup.forEach((l, k) => { names[DRIVERS[l.di][1]] = [DRIVERS[l.di][0], k === 0 ? LIVERIES[myLivery()] : TEAMS[teamIdxOf(l.di)].color]; });
    const tab = Object.entries(s.pts).sort((a, b) => b[1] - a[1]);
    const myPos = tab.findIndex(e => e[0] === 'YOU') + 1;
    $('champTitle').textContent = s.finished ? (myPos === 1 ? 'You are World Champion!' : 'Season complete: P' + myPos) : 'Championship after round ' + s.round;
    $('champTable').innerHTML = tab.slice(0, 10).map((e, k) => '<tr class="' + (e[0] === 'YOU' ? 'me' : '') + '"><td>' + (k + 1) + '</td><td><span class="sw" style="background:' + names[e[0]][1] + '"></span>' + names[e[0]][0] + '</td><td><b>' + e[1] + '</b></td></tr>').join('') + (myPos > 10 ? '<tr class="me"><td>' + myPos + '</td><td>You</td><td><b>' + s.pts.YOU + '</b></td></tr>' : '');
    $('champBox').classList.remove('hidden');
    $('rAgain').textContent = s.finished ? 'New season' : 'Next round: ' + TRACKS[calIdx()[s.round]].name;
  }
  $('results').classList.remove('hidden');
}


/* ---------------- Online championships: sign up with a code, vote on race times, race online, points table ---------------- */
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ocWhen = d => new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function ocIn(ms) {
  const m = Math.round(ms / 60000); if (m <= 0) return 'now';
  if (m < 60) return 'in ' + m + ' min'; const h = Math.floor(m / 60); if (h < 48) return 'in ' + h + 'h ' + (m % 60) + 'm'; return 'in ' + Math.floor(h / 24) + ' days';
}
const OC_OPEN_BEFORE = 15 * 60000, OC_OPEN_AFTER = 3 * 3600000;   // the race lobby opens 15 min before the time, closes 3 h after
const ocUi = { view: 'list', id: null, data: null, open: -1, draft: null, timer: 0, busy: false };
const ocTrack = id => TRACKS.find(t => t.id === id);
function ocOpen() { $('ocPanel').classList.remove('hidden'); ocShow(ocUi.id ? 'champ' : 'list'); }
function ocClose() { $('ocPanel').classList.add('hidden'); clearInterval(ocUi.timer); ocUi.timer = 0; }
function ocNeedName() {
  if (mpName() && mpName() !== 'Driver') return false;
  ocMsg('Type your driver name in the Online box first (it is used in the points table).'); return true;
}
function ocMsg(t) { const el = $('ocBody').querySelector('.ocMsg'); if (el) el.textContent = t || ''; }
async function ocTry(fn) { if (ocUi.busy) return; ocUi.busy = true; ocMsg(''); try { await fn(); } catch (e) { ocMsg(e.message || String(e)); } finally { ocUi.busy = false; } }
async function ocShow(view, id) {
  ocUi.view = view; if (id !== undefined) ocUi.id = id;
  clearInterval(ocUi.timer); ocUi.timer = 0;
  const B = $('ocBody');
  if (!OC_ON) { B.innerHTML = '<h2>Online championships</h2><p class="ocSub">Online play is not switched on for this copy of the game.</p>'; return; }
  if (view === 'list') {
    B.innerHTML = '<h2>Online championships</h2><div class="ocSub">Run a season with your mates: sign up with a code, you set the time for each race, and the points table fills in as you race.</div>' +
      '<div class="ocRow"><button class="btn primary" id="ocNew">Create a championship</button><input class="ocIn ocCode" id="ocJoinCode" maxlength="6" placeholder="CODE"><button class="btn" id="ocJoin">Sign up</button></div><div class="ocMsg"></div><h3>Your championships</h3><div id="ocMine" class="ocSub">Loading…</div>';
    $('ocNew').onclick = () => { if (!ocNeedName()) ocShow('create'); };
    $('ocJoin').onclick = () => ocTry(async () => {
      if (ocNeedName()) return; const c = $('ocJoinCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length !== 6) return ocMsg('Championship codes are 6 letters or numbers.');
      const id = await oc.join(mpName(), c, myLivery()); ocShow('champ', id);
    });
    try {
      const list = await oc.mine();
      if (ocUi.view !== 'list') return;
      $('ocMine').innerHTML = list.length ? '' : 'None yet. Create one, or sign up with a code from a mate.';
      for (const c of list) {
        const el = document.createElement('div'); el.className = 'ocItem';
        el.innerHTML = '<div><b>' + esc(c.name) + '</b><br><small>' + esc((SERIES[c.series] || SER).name) + ' · ' + c.rounds.length + ' rounds · ' + c.laps + ' laps' + (c.quali ? ' · quali' : '') + '</small></div><small>' + c.code + (c.owner === ocMe().id ? ' · organiser' : '') + '</small>';
        el.onclick = () => ocShow('champ', c.id); $('ocMine').appendChild(el);
      }
    } catch (e) { if ($('ocMine')) $('ocMine').textContent = e.message; }
    return;
  }
  if (view === 'create') {
    const d = ocUi.draft || (ocUi.draft = { title: '', laps: settings.laps || 5, quali: true, rounds: [] });
    const cal = realCal(), all = cal.concat(TRACKS.map((_, i) => i).filter(i => !cal.includes(i)));
    B.innerHTML = '<h2>New championship</h2><div class="ocSub">' + esc(SER.name) + ' cars (change the series in the menu first if you want a different one). Races are online rooms, no AI.</div>' +
      '<div class="ocRow"><input class="ocIn" id="ocTitle" maxlength="40" placeholder="Championship name" style="flex:1" value="' + esc(d.title) + '"></div>' +
      '<div class="ocRow">Laps <select class="ocIn" id="ocLaps">' + [3, 5, 8, 10, 15, 20, 30].map(n => '<option' + (n === d.laps ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      ' Qualifying <select class="ocIn" id="ocQuali"><option value="1"' + (d.quali ? ' selected' : '') + '>On</option><option value="0"' + (d.quali ? '' : ' selected') + '>Off</option></select></div>' +
      '<h3>Calendar · ' + d.rounds.length + ' rounds</h3><div id="ocChips" class="ocRow"></div>' +
      '<div class="ocRow"><select class="ocIn" id="ocPick" style="flex:1">' + all.map(i => '<option value="' + TRACKS[i].id + '">' + esc(TRACKS[i].name) + ' · ' + esc(TRACKS[i].loc) + '</option>').join('') + '</select><button class="btn" id="ocAdd">Add</button><button class="btn" id="ocReal">Use the real ' + esc(SER.short) + ' calendar</button></div>' +
      '<div class="ocMsg"></div><div class="ocRow"><button class="btn primary" id="ocMake">Create championship</button><button class="btn" id="ocBack">Back</button></div>';
    const keep = () => { d.title = $('ocTitle').value; d.laps = +$('ocLaps').value; d.quali = $('ocQuali').value === '1'; };
    $('ocChips').innerHTML = d.rounds.length ? d.rounds.map((id, k) => '<span class="cchip"><b>' + (k + 1) + '</b>' + esc((ocTrack(id) || {}).name || id) + '<button data-k="' + k + '" data-a="up">▲</button><button data-k="' + k + '" data-a="x">✕</button></span>').join('') : '<span class="ocSub">Add tracks below.</span>';
    $('ocChips').querySelectorAll('button').forEach(b => b.onclick = () => { keep(); const k = +b.dataset.k; if (b.dataset.a === 'x') d.rounds.splice(k, 1); else if (k > 0) [d.rounds[k - 1], d.rounds[k]] = [d.rounds[k], d.rounds[k - 1]]; ocShow('create'); });
    $('ocAdd').onclick = () => { keep(); if (d.rounds.length < 40) d.rounds.push($('ocPick').value); ocShow('create'); };
    $('ocReal').onclick = () => { keep(); d.rounds = realCal().map(i => TRACKS[i].id); ocShow('create'); };
    $('ocBack').onclick = () => { keep(); ocShow('list'); };
    $('ocMake').onclick = () => ocTry(async () => {
      keep(); if (!d.title.trim()) return ocMsg('Give it a name.'); if (!d.rounds.length) return ocMsg('Add at least one track.');
      const r = await oc.create(mpName(), d.title, SER.id, d.laps, d.quali, d.rounds, myLivery());
      ocUi.draft = null; ocShow('champ', r.id);
    });
    return;
  }
  // one championship
  B.innerHTML = '<h2>Loading…</h2><div class="ocMsg"></div>';
  try { ocUi.data = await oc.load(ocUi.id); } catch (e) { B.innerHTML = '<h2>Championship</h2><div class="ocMsg">' + esc(e.message) + '</div><div class="ocRow"><button class="btn" id="ocBack">Back</button></div>'; $('ocBack').onclick = () => { ocUi.id = null; ocShow('list'); }; return; }
  ocRender();
  ocUi.timer = setInterval(async () => { if (ocUi.view !== 'champ' || ocUi.busy || document.activeElement && document.activeElement.type === 'datetime-local') return; try { ocUi.data = await oc.load(ocUi.id); ocRender(); } catch (e) { /* keep the last view */ } }, 20000);
}
function ocNextRound(data) { const done = new Set(data.results.map(r => r.round)); return data.champ.rounds.findIndex((_, k) => !done.has(k)); }
function ocRender() {
  const D = ocUi.data, C = D.champ, me = ocMe().id, isOwner = C.owner === me, member = D.members.some(m => m.player_id === me), now = Date.now();
  const next = ocNextRound(D); if (ocUi.open < 0) ocUi.open = next;
  const stand = ocStandings(D, POINTS);
  let html = '<h2>' + esc(C.name) + '</h2><div class="ocSub">' + esc((SERIES[C.series] || SER).name) + ' · ' + C.rounds.length + ' rounds · ' + C.laps + ' laps · qualifying ' + (C.quali ? 'on' : 'off') + ' · ' + D.members.length + ' signed up</div>' +
    '<div class="ocShare">Sign-up code <b>' + C.code + '</b> <small>send it to your mates</small></div>' + (member ? '' : '<div class="ocRow"><button class="btn primary" id="ocSignup">Sign up to this championship</button></div>') + '<div class="ocMsg"></div>';
  html += '<div class="ocGrid"><div><h3>Calendar</h3>';
  C.rounds.forEach((tid, k) => {
    const t = ocTrack(tid), res = D.results.find(r => r.round === k), ag = agreedSlot(D.slots, k), open = ocUi.open === k;
    let status = res ? '🏁 ' + esc((res.results[0] || {}).name || '') + ' won' : ag ? '📅 ' + ocWhen(ag.at) + ' · ' + ocIn(new Date(ag.at) - now) : 'No time set yet';
    html += '<div class="ocRound' + (k === next ? ' next' : '') + '"><div class="t" data-r="' + k + '"><span><b>R' + (k + 1) + '</b>' + esc(t ? t.name : tid) + '</span><small class="ocSub">' + status + '</small></div>';
    if (open && !res) {
      html += '<div class="ocSlot"><span class="v">' + (ag ? '<span class="lk">Race time: </span>' + ocWhen(ag.at) : (isOwner ? 'Pick the date and time for this race:' : 'The organiser has not set a time yet.')) + '</span></div>';
      if (isOwner) html += '<div class="ocSlot"><input type="datetime-local" class="ocIn" id="ocWhen" style="font-size:14px"><button id="ocProp">' + (ag ? 'Change time' : 'Set race time') + '</button></div>';
      if (ag && member && now >= new Date(ag.at) - OC_OPEN_BEFORE && now <= +new Date(ag.at) + OC_OPEN_AFTER) html += '<div class="ocRow"><button class="btn ocGo" id="ocRace">Join the race lobby</button></div>';
      else if (ag) html += '<div class="ocSub" style="font-size:13px">The race lobby opens 15 minutes before the start time.</div>';
    }
    html += '</div>';
  });
  html += '</div><div><h3>Standings</h3><table class="ocTab">' + stand.map((s, k) => '<tr class="' + (s.pid === me ? 'me' : '') + '"><td>' + (k + 1) + '</td><td><span class="sw" style="background:' + (LIVERIES[s.livery] || '#888') + '"></span>' + esc(s.name) + (s.pid === C.owner ? ' <small class="ocSub">org</small>' : '') + '</td><td>' + (s.wins ? s.wins + '🏆' : '') + '</td><td><b>' + s.pts + '</b></td></tr>').join('') + '</table>' +
    '<div class="ocSub" style="font-size:13px;margin-top:6px">25-18-15-12-10-8-6-4-2-1 points per race.</div></div></div>' +
    '<div class="ocRow" style="margin-top:14px"><button class="btn" id="ocBack">All championships</button>' + (member ? '<button class="btn" id="ocLeave">' + (isOwner ? 'Delete championship' : 'Leave') + '</button>' : '') + '</div>';
  $('ocBody').innerHTML = html;
  $('ocBack').onclick = () => { ocUi.id = null; ocUi.open = -1; ocShow('list'); };
  $('ocBody').querySelectorAll('.ocRound .t').forEach(el => el.onclick = () => { ocUi.open = ocUi.open === +el.dataset.r ? -2 : +el.dataset.r; ocRender(); });
  const reload = async () => { ocUi.data = await oc.load(ocUi.id); ocRender(); };
  if ($('ocSignup')) $('ocSignup').onclick = () => ocTry(async () => { if (ocNeedName()) return; await oc.join(mpName(), C.code, myLivery()); await reload(); });
  if ($('ocLeave')) $('ocLeave').onclick = () => ocTry(async () => {
    const b = $('ocLeave'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = isOwner ? 'Sure? Deletes it for everyone' : 'Sure?'; return; }
    await oc.leave(C.id); ocUi.id = null; ocShow('list');
  });
  $('ocBody').querySelectorAll('[data-vote]').forEach(b => b.onclick = () => ocTry(async () => { await oc.vote(+b.dataset.vote, !b.classList.contains('on')); await reload(); }));
  $('ocBody').querySelectorAll('[data-lock]').forEach(b => b.onclick = () => ocTry(async () => { await oc.lock(+b.dataset.lock); await reload(); }));
  if ($('ocProp')) $('ocProp').onclick = () => ocTry(async () => { const v = $('ocWhen').value; if (!v) return ocMsg('Pick a date and time first.'); const at = new Date(v); if (at < Date.now()) return ocMsg('Pick a time in the future.'); await oc.propose(C.id, ocUi.open, at); await reload(); });
  if ($('ocRace')) $('ocRace').onclick = () => ocEnterRace(D, ocUi.open);
}
/* go to the round's online room with the championship's car, track, laps and qualifying */
function ocEnterRace(D, round) {
  if (ocNeedName()) return;
  const C = D.champ, ti = TRACKS.findIndex(t => t.id === C.rounds[round]), ag = agreedSlot(D.slots, round);
  if (ti < 0) return ocMsg('This version of the game does not have that track. Refresh the page to update.');
  if (C.series !== settings.series) { settings.series = C.series; applySeries(C.series); }
  Object.assign(settings, { mode: 'mp', track: ti, laps: C.laps, quali: C.quali ? 'on' : 'off' }); saveSettings();
  game.ocPending = { id: C.id, code: C.code, round, name: C.name, at: +new Date(ag.at) };
  ocClose(); refreshMenu(); withLoading(() => buildTrack(ti));
  mpRandom = false; mpEnter(ocRoomCode(C.code, round), true);
}
/* host: start the championship race on time once at least two drivers are in */
function ocAutoStart() {
  const P = game.ocPending; if (!P || !net.code || game.mp) return;
  refreshStartBtn();   // keeps the countdown on the button ticking
  if (!net.isHost || net.room.length < 2) return;
  if (Date.now() >= P.at) mpHostStart();
}
/* after the race: save the finishing order to the championship (the host straight away, others as a backup) */
function ocSubmitResults(rows) {
  const O = game.mp && game.mp.oc; if (!O || game.ocSent === game.mp.race) return; game.ocSent = game.mp.race;
  const list = rows.filter(r => r.c.ocPid).map(r => ({ pid: r.c.ocPid, name: r.c.name, dnf: !!r.c.dnf }));
  const send = () => oc.result(O.id, O.round, list).then(() => radio('Result saved to the championship.', 'good', 5)).catch(() => {});
  if (net.isHost) send(); else setTimeout(send, 15000);
  game.ocPending = null;
}

/* ---------------- Menu ---------------- */
function refreshMenu() {
  { // calendar: only this series' tracks, numbered in calendar order
    // championship: the series' real calendar; other modes: every track, the series' own calendar first
    const building = buildingCustom(), picks = idsToIdx(customCal());
    const cal = building ? [...new Set(picks)] : calIdx(), list = settings.mode === 'champ' && !building ? cal : cal.concat(TRACKS.map((_, i) => i).filter(i => !cal.includes(i)));
    if (!list.includes(settings.track) || (TRACKS[settings.track].vip && !isVip())) settings.track = list[0];
    // section headers: the series' calendar, then "Other tracks"
    const head = (id, html, order, show) => { let h = $(id); if (!h) { h = document.createElement('div'); h.id = id; h.className = 'calHead'; $('trackList').appendChild(h); } h.innerHTML = html; h.style.order = order; h.style.display = show ? '' : 'none'; };
    const ss = settings.mode === 'champ' && loadSeason();
    if (building) head('calHead', 'Your custom calendar · ' + picks.length + ' round' + (picks.length === 1 ? '' : 's') + '<small>Tap any track to add it to the season (twice for a double-header)</small>', -1, true);
    else if (ss && ss.cal && !ss.finished) head('calHead', 'Custom calendar · ' + cal.length + ' rounds', -1, true);
    else head('calHead', SER.name + ' 2026 calendar · ' + cal.length + ' rounds' + (SER.missing ? '<small>Not in the game yet: ' + SER.missing.join(', ') + '</small>' : ''), -1, true);
    head('otherHead', building ? 'Add more tracks' : 'Other tracks<small>Race any series here in Quick Race, Time Trial and Online</small>', cal.length * 2 - 1, list.length > cal.length);
    document.querySelectorAll('#trackList .tcard').forEach((el, i) => { const k = list.indexOf(i); el.style.display = k < 0 ? 'none' : ''; if (k >= 0) { el.style.order = k * 2; const rounds = building ? picks.map((p, r) => p === i ? r + 1 : 0).filter(Boolean) : []; el.querySelector('.rnd').innerHTML = building ? (rounds.length ? '<span class="cnum">' + rounds.join('·') + '</span>' : '+') : k < cal.length ? String(k + 1).padStart(2, '0') : '–'; el.querySelector('.st').innerHTML = cardStats(i); } });
    $('optLmClass').classList.toggle('hidden', SER.id !== 'lemans');
    $('menuSub').textContent = SER.name + ' · ' + (building ? 'custom ' + picks.length : calIdx().length) + '-round championship · ' + TRACKS.length + ' tracks';
  }
  document.querySelectorAll('.seg').forEach(seg => { const k = seg.dataset.opt; seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(settings[k]) === b.dataset.v)); });
  const mode = settings.mode, s = loadSeason();
  const running = mode === 'champ' && s && !s.finished;
  ['optLaps', 'optOpp', 'optDiff'].forEach(id => $(id).style.opacity = mode === 'tt' || running ? 0.35 : 1);
  ['optQuali', 'optWx', 'optDmg'].forEach(id => $(id).style.opacity = mode === 'tt' || (running && s.cal) ? 0.35 : 1);
  $('customBox').classList.toggle('hidden', mode !== 'champ' || running);
  if (mode === 'champ' && !running) renderCustomList();
  $('seasonBox').classList.toggle('hidden', mode !== 'champ');
  refreshLeaderboard();
  $('mpBox').classList.toggle('hidden', mode !== 'mp');
  if (mode === 'mp') { ['optOpp', 'optDiff', 'optWx', 'optDmg'].forEach(id => $(id).style.opacity = 0.35); $('optQuali').style.opacity = 1; $('optLaps').style.opacity = 1; mpShareInfo(); renderRoom(); }
  if (mode === 'champ') {
    if (s && !s.finished) { settings.track = calIdx()[s.round]; $('seasonInfo').innerHTML = (s.cal ? 'Custom season · ' : '') + 'Round <b>' + (s.round + 1) + '</b> of ' + calIdx().length + ' · You have <b>' + (s.pts.YOU || 0) + '</b> pts<br><small>' + s.laps + ' laps · AI ' + (s.ai ?? 50) + '/100 · ' + s.opp + ' rivals' + (s.cal ? ' · quali ' + (s.quali === 'on' ? 'on' : 'off') + ' · weather ' + s.weather + ' · damage ' + s.damage : '') + ' · your teammate: ' + DRIVERS[s.lineup[0].di][0] + '</small>'; $('newSeason').classList.remove('hidden'); }
    else if (settings.champType === 'custom') { const n = customCal().length; settings.track = idsToIdx(customCal())[0] ?? 0; $('seasonInfo').innerHTML = n ? n + ' rounds, in the order above. 25-18-15-12-10-8-6-4-2-1 points.<br><small>Uses the laps, rivals, AI skill, qualifying, weather and damage you pick here.</small>' : '<small>Pick your tracks from the list on the right.</small>'; $('newSeason').classList.add('hidden'); }
    else { settings.track = realCal()[0] ?? 0; $('seasonInfo').innerHTML = 'A ' + realCal().length + '-round season. 25-18-15-12-10-8-6-4-2-1 points.<br><small>Uses the laps, rivals and AI skill above. You get a teammate.</small>'; $('newSeason').classList.add('hidden'); }
  }
  $('startBtn').textContent = mode === 'tt' ? 'Start Time Trial' : mode === 'champ' ? (s && !s.finished ? 'Start Round ' + (s.round + 1) : 'Start Season') : 'Start Weekend';
  $('startBtn').disabled = mode === 'champ' && !running && settings.champType === 'custom' && !customCal().length; refreshStartBtn();
  document.querySelectorAll('#swatches button').forEach((b, k) => b.classList.toggle('on', k === myLivery()));
  $('aiSlider').value = settings.ai; $('aiVal').textContent = settings.ai; $('aiDesc').textContent = aiLabel(settings.ai);
  document.querySelectorAll('.tcard').forEach((c, k) => { c.classList.toggle('on', k === settings.track); c.classList.toggle('locked', mode === 'champ' && !buildingCustom()); });
  const d = TRACKS[settings.track];
  $('tiName').textContent = d.name; $('tiBlurb').textContent = d.loc + ' · ' + (d.type === 'street' ? 'Street circuit · ' : 'Permanent circuit · ') + d.blurb;
  const on = document.querySelector('.tcard.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function aiLabel(s) { return s < 20 ? 'Rookie' : s < 40 ? 'Amateur' : s < 60 ? 'Club racer' : s < 75 ? 'Pro' : s < 90 ? 'Elite: brakes late' : 'Legend: right on the limit'; }
function showLoading(on) { $('loading').classList.toggle('hidden', !on); }
function withLoading(fn) { showLoading(true); setTimeout(() => { try { fn(); } finally { showLoading(false); } }, 30); }
/* custom championship: the picked track ids per series */
function customCal() { const all = settings.customCals || {}; return all[SER.id] || []; }
function setCustomCal(list) { settings.customCals = Object.assign({}, settings.customCals, { [SER.id]: list.slice(0, 40) }); saveSettings(); refreshMenu(); }
function renderCustomList() {
  const ids = customCal(), el = $('customList');
  if (settings.champType !== 'custom') { el.innerHTML = ''; return; }
  el.innerHTML = ids.length ? ids.map((id, k) => { const t = TRACKS.find(x => x.id === id); return '<span class="cchip"><b>' + (k + 1) + '</b>' + (t ? t.name : id) + '<button data-k="' + k + '" data-a="up" title="Move earlier">▲</button><button data-k="' + k + '" data-a="x" title="Remove">✕</button></span>'; }).join('') + '<span class="cchip"><button data-a="clear">Clear all</button></span>'
    : '<span class="hint">No tracks yet. Tap tracks on the right to build your season.</span>';
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const l = customCal().slice(), k = +b.dataset.k;
    if (b.dataset.a === 'x') l.splice(k, 1); else if (b.dataset.a === 'up' && k > 0) [l[k - 1], l[k]] = [l[k], l[k - 1]]; else if (b.dataset.a === 'clear') l.length = 0;
    setCustomCal(l);
  });
}
function selectTrack(i) {
  if (TRACKS[i].vip && !isVip()) { $('vipMsg').textContent = 'The ' + TRACKS[i].name + ' is VIP only. Enter a VIP code here to unlock it.'; $('vipCode').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('vipCode').focus(); return; }
  if (buildingCustom()) { setCustomCal(customCal().concat(TRACKS[i].id)); withLoading(() => buildTrack(i)); return; }
  if (settings.mode === 'champ') return; settings.track = i; saveSettings(); refreshMenu(); withLoading(() => buildTrack(i)); }
function cardStats(i) {
  const d = TRACKS[i], pv = previewPoints(d, 60), rec = parseFloat(store.get('apexgp2-best-' + serKey(d.id)));
  return '<b>' + (pv.length / 1000).toFixed(2) + ' km</b> · ' + (d.oval ? 'Oval' : d.type === 'street' ? 'Street' : 'Circuit') + (isFinite(rec) ? ' · <b>' + fmt(rec) + '</b>' : '') + (d.vip ? ' · <span class="viptrk">' + (isVip() ? 'VIP' : '🔒 VIP only') + '</span>' : '') + (isVip() ? ['', ' · 🥉', ' · 🥈', ' · 🥇'][+(store.get('apexgp-medal-' + serKey(d.id)) || 0)] : '');
}
function initMenu() {
  { const inp = $('lbNameIn'); inp.value = lbName(); inp.addEventListener('change', () => { const v = inp.value.replace(/[^\w .\-]/g, '').trim().slice(0, 16); inp.value = v; store.set('apexgp-name', v); refreshLeaderboard(); }); }
  document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = seg.dataset.opt, v = b.dataset.v;
    if (k === 'mode' && v === 'derby' && !isVip()) { $('vipMsg').textContent = 'The London Bus Demolition Derby is VIP only. Enter a VIP code here to unlock it.'; $('vipCode').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('vipCode').focus(); return; }
    if (k === 'series' && SERIES[v] && SERIES[v].vip && !isVip()) { $('vipMsg').textContent = SERIES[v].name + ' is VIP only. Enter a VIP code here to unlock it.'; $('vipCode').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('vipCode').focus(); return; }
    settings[k] = (k === 'laps' || k === 'opp') ? parseInt(v, 10) : v; saveSettings();
    if (k === 'line') world.setRaceLine(v === 'on');
    const prev = settings.track; refreshMenu();
    if (k === 'series' || k === 'lmClass') { applySeries(settings.series); refreshMenu(); withLoading(() => buildTrack(settings.track)); return; }
    if (k === 'mode' && settings.track !== prev) withLoading(() => buildTrack(settings.track));
  }));
  $('aiSlider').addEventListener('input', e => { settings.ai = parseInt(e.target.value, 10); saveSettings(); $('aiVal').textContent = settings.ai; $('aiDesc').textContent = aiLabel(settings.ai); });
  $('acceptBtn').onclick = () => { $('splash').classList.add('hidden'); audio.init(); audio.set(0, 0, false); };
  LIVERIES.forEach((c, k) => {
    const b = document.createElement('button'), v = VIP_LIV[k]; b.style.background = v && v.metal > 0.9 ? 'linear-gradient(135deg,' + c + ',#ffffff 45%,' + c + ')' : c; b.title = v ? v.name + ' (VIP)' : 'Livery ' + (k + 1);
    if (v) b.className = 'vipsw';
    b.onclick = () => { if (v && !isVip()) { $('vipMsg').textContent = 'This is a VIP livery. Enter a VIP code below to unlock it.'; $('vipCode').focus(); return; } settings.livery = k; saveSettings(); refreshMenu(); };
    $('swatches').appendChild(b);
  });
  const vipUi = () => {
    document.body.classList.toggle('isvip', isVip());
    if (isVip()) $('vipMsg').textContent = 'VIP unlocked: special liveries, gold rims, underglow, tyre smoke, exhaust flames, fireworks, Time Trial medals and ghost, VIP tracks, a crown and quick chat online.';
    $('vipRims').textContent = 'Gold rims: ' + (settings.vipRims !== false ? 'On' : 'Off');
    $('vipGlow').textContent = 'Underglow: ' + GLOW_NAMES[settings.vipGlow || 0];
    $('vipFw').textContent = 'Fireworks: ' + (settings.vipFw === false ? 'Off' : 'On');
    $('vipHelmet').textContent = 'Helmet: ' + HELMETS[settings.vipHelmet || 0][0];
    $('vipNight').textContent = 'Night racing: ' + (settings.vipNight ? 'On' : 'Off');
    $('vipDonuts').textContent = 'Win donuts: ' + (settings.vipDonuts === false ? 'Off' : 'On');
    $('vipGhost').textContent = 'Time Trial ghost: ' + (settings.vipGhost === false ? 'Off' : 'On');
    $('vipSmoke').textContent = 'Tyre smoke: ' + SMOKE_NAMES[settings.vipSmoke || 0];
    $('vipFlames').textContent = 'Exhaust flames: ' + (settings.vipFlames === false ? 'Off' : 'On');
    $('vipV10').textContent = 'V10 monster car: ' + (settings.vipV10 ? 'On' : 'Off');
    if (document.activeElement !== $('vipNum')) $('vipNum').value = settings.vipNum || '';
    if (document.activeElement !== $('vipMsgIn')) $('vipMsgIn').value = settings.vipMsg || '';
  };
  $('vipHelmet').onclick = () => { settings.vipHelmet = ((settings.vipHelmet || 0) + 1) % HELMETS.length; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipNight').onclick = () => { settings.vipNight = !settings.vipNight; saveSettings(); vipUi(); withLoading(() => buildTrack(settings.track)); };
  $('vipDonuts').onclick = () => { settings.vipDonuts = settings.vipDonuts === false; saveSettings(); vipUi(); };
  $('vipGhost').onclick = () => { settings.vipGhost = settings.vipGhost === false; saveSettings(); vipUi(); };
  $('vipSmoke').onclick = () => { settings.vipSmoke = ((settings.vipSmoke || 0) + 1) % SMOKES.length; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipFlames').onclick = () => { settings.vipFlames = settings.vipFlames === false; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipV10').onclick = () => { settings.vipV10 = !settings.vipV10; saveSettings(); vipUi(); refreshMenu(); if (settings.vipV10) $('vipMsg').textContent = 'V10 monster on: ~900 hp, 19,000 rpm V10 scream. Quick Race, Time Trial and Championship (not online).'; };
  document.querySelectorAll('#qchat button').forEach(b => b.onclick = () => quickChat(+b.dataset.k));
  $('vipNum').onchange = () => { const v = Math.round(+$('vipNum').value); settings.vipNum = v >= 1 && v <= 99 ? v : null; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipMsgIn').onchange = () => { settings.vipMsg = $('vipMsgIn').value.replace(/[<>&]/g, '').trim().slice(0, 40); saveSettings(); vipUi(); };
  $('vipRims').onclick = () => { settings.vipRims = settings.vipRims === false; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipGlow').onclick = () => { settings.vipGlow = ((settings.vipGlow || 0) + 1) % GLOWS.length; saveSettings(); vipUi(); mpShareInfo(); };
  $('vipFw').onclick = () => { settings.vipFw = settings.vipFw === false; saveSettings(); vipUi(); };
  vipUi();
  $('vipBtn').onclick = async () => { $('vipBtn').disabled = true; $('vipMsg').textContent = 'Checking…'; const r = await redeemVip($('vipCode').value); $('vipBtn').disabled = false; if (r === true) { $('vipCode').value = ''; vipUi(); refreshMenu(); mpLastInfo = ''; mpShareInfo(); } else $('vipMsg').textContent = r; };
  TRACKS.forEach((d, i) => {
    const el = document.createElement('div'); el.className = 'tcard panel';
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 120;
    const pv = previewPoints(d, 200), g = cv.getContext('2d'); g.translate(20, 0);
    const { path, map } = trackPath(pv.pts.length, k => pv.pts[k][0], k => pv.pts[k][1], 120, 10);
    const s = d.scale || 1, a = d.pts[0], b = d.pts[1];
    drawShape(g, path, map, [(a[0] + (b[0] - a[0]) * 0.6) * s, (a[1] + (b[1] - a[1]) * 0.6) * s], 3);
    el.innerHTML = '<div class="rnd">' + String(i + 1).padStart(2, '0') + '</div><div class="pv"></div><div><div class="nm">' + d.name + '</div><div class="lc">' + d.loc + '</div><div class="st">' + cardStats(i) + '</div></div>';
    el.querySelector('.pv').appendChild(cv);
    el.onclick = () => selectTrack(i);
    $('trackList').appendChild(el);
  });
  $('startBtn').onclick = () => { if (settings.mode === 'mp') return mpHostStart(); withLoading(startWeekend); };
  { const inp = $('mpName'); inp.value = lbName(); inp.addEventListener('change', () => { const v = inp.value.replace(/[^\w .\-]/g, '').trim().slice(0, 16); inp.value = v; store.set('apexgp-name', v); $('lbNameIn').value = v; mpShareInfo(); renderRoom(); }); }
  const takeName = () => { const v = $('mpName').value.replace(/[^\w .\-]/g, '').trim().slice(0, 16); if (v) { store.set('apexgp-name', v); $('lbNameIn').value = v; } };
  $('mpCreate').onclick = () => { takeName(); mpRandom = false; mpEnter(null); };
  $('mpRandom').onclick = () => { takeName(); mpRandomLobby(); };
  $('mpJoin').onclick = () => { takeName(); const c = $('mpCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length === 4) { mpRandom = false; mpEnter(c); } else mpStatus('Room codes are 4 letters or numbers.'); };
  $('ocOpen').onclick = ocOpen; $('ocClose').onclick = ocClose; setInterval(ocAutoStart, 1000);
  $('mpLeave').onclick = async () => { game.ocPending = null; mpRandom = false; clearTimeout(mpAutoT); mpAutoT = null; await net.leave(); renderRoom(); refreshStartBtn(); mpStatus(''); };
  $('newSeason').onclick = () => { store.del(seasonKey()); refreshMenu(); withLoading(() => buildTrack(settings.track)); };
  for (let k = 0; k < 5; k++) { const pod = document.createElement('div'); pod.className = 'pod'; pod.innerHTML = '<i></i><i></i>'; $('startLights').appendChild(pod); }
  for (let k = 0; k < 10; k++) $('shift').appendChild(document.createElement('i'));
  $('pResume').onclick = () => togglePause(false);
  $('pRestart').onclick = () => { if (settings.mode === 'champ') return; withLoading(startWeekend); };
  $('pEnd').onclick = () => { togglePause(false); if (!isRace() && game.session !== 'tt') { game.player.lapInvalid = false; endQualiSession(); } };
  $('pQuit').onclick = toMenu; $('rMenu').onclick = toMenu;
  $('rAgain').onclick = () => { if (game.mp) return toMenu(); if (settings.mode === 'champ') { const s = loadSeason(); if (s && s.finished) store.del(seasonKey()); } withLoading(startWeekend); };
  $('qNext').onclick = () => { if (game.mp) return; $('qres').classList.add('hidden'); $('hud').classList.remove('hidden'); withLoading(nextQualiStep); };
  $('stratGo').onclick = () => withLoading(startRace);
  $('leaveGarage').onclick = leaveGarage;
  applySeries(settings.series);
  refreshMenu();
  withLoading(() => buildTrack(settings.track));
}
function toMenu() {
  game.derby = null; $('derbyHud').classList.add('hidden');
  $('qchat').classList.add('hidden');
  engMenu(false);
  clearSC(); game.flag = null; $('flag').className = 'hidden';
  game.mp = null; game.state = 'menu'; game.paused = false; game.phase = 'idle'; game.session = null; audio.set(0, 0, false); clearCars(); smoke.clear(); sparks.clear(); skids.clear(); fireworks.stop(); game.fwCar = null; game.champ = null;
  weather.N = 0; weather.lines.visible = false; world.setWeather(0, 0);
  ['hud', 'pause', 'results', 'qres', 'strategy', 'garageBar'].forEach(id => $(id).classList.add('hidden')); $('menu').classList.remove('hidden');
  document.querySelectorAll('.tcard .st').forEach((el, i) => el.innerHTML = cardStats(i));
  refreshMenu(); withLoading(() => buildTrack(settings.track));
}
function togglePause(force) {
  if (game.state !== 'race' || !$('results').classList.contains('hidden') || !$('qres').classList.contains('hidden') || !$('strategy').classList.contains('hidden')) return;
  game.paused = typeof force === 'boolean' ? force : !game.paused;
  $('pause').classList.toggle('hidden', !game.paused);
  $('pRestart').classList.toggle('hidden', settings.mode === 'champ' || !!game.mp);
  $('pEnd').classList.toggle('hidden', isRace() || game.session === 'tt');
  if (game.paused) audio.set(0, 0, false);
}

/* ---------------- Input ---------------- */
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const ak = { arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' }[k];
  if (ak) { keys[ak] = true; e.preventDefault(); }
  if (k === 'w' || k === 'a' || k === 'd' || k === 's') { keys[k] = true; e.preventDefault(); }
  if (e.code === 'Space' && game.state === 'race') { keys.hb = true; e.preventDefault(); }
  if (e.repeat) return;
  if (k === 'c' && game.state === 'race' && !game.paused) setCam((game.camMode + 1) % 3);
  if (k === 'escape') togglePause();
  if (k === 'l' && game.state === 'race') { settings.line = settings.line === 'on' ? 'off' : 'on'; saveSettings(); world.setRaceLine(settings.line === 'on'); colorLineForPlayer(); flashMsg('RACING LINE ' + settings.line.toUpperCase(), 0.9); }
  if (k === 'p' && (racing() || game.phase === 'run') && game.player && !game.player.pit) { const p = game.player; p.pitReq = !p.pitReq; radio(p.pitReq ? 'Copy, box this lap.' : 'Copy, staying out.', 'info', 3); }
  if (k === 'r' && game.state === 'race' && !game.paused) engMenu();
  if (e.shiftKey && game.mp && /^Digit[1-6]$/.test(e.code)) { quickChat(+e.code.slice(5) - 1); return; }
  if (k >= '1' && k <= '9' && !$('engMenu').classList.contains('hidden')) engAsk(+k - 1);
  if (k === 'm') { audio.muted = !audio.muted; store.set('apexgp-muted', audio.muted ? '1' : '0'); if (game.state === 'race') flashMsg(audio.muted ? 'SOUND OFF' : 'SOUND ON', 0.9); }
});
$('engMenu').addEventListener('click', e => { const b = e.target.closest('button'); if (b) engAsk(+b.dataset.k); });
addEventListener('keyup', e => { if (e.code === 'Space') keys.hb = false; const k = e.key.toLowerCase(), ak = { arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' }[k]; if (ak) keys[ak] = false; if (k in keys) keys[k] = false; });
/* touch controls (phones and tablets): steering buttons on the left, pedals on the right */
{
  const tc = document.getElementById('touch');
  if (tc && (matchMedia('(pointer: coarse)').matches || /[?&]touch\b/.test(location.search))) {
    document.body.classList.add('touchUI');
    tc.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k, on = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); }, off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    });
    tc.querySelector('[data-act="cam"]').addEventListener('pointerdown', e => { e.preventDefault(); if (game.state === 'race') setCam((game.camMode + 1) % 3); });
    tc.querySelector('[data-act="radio"]').addEventListener('pointerdown', e => { e.preventDefault(); if (game.state === 'race') engMenu(); });
    tc.querySelector('[data-act="pause"]').addEventListener('pointerdown', e => { e.preventDefault(); togglePause(); });
  }
}
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (game.state === 'race' && !game.mp && (game.phase === 'race' || game.phase === 'run')) togglePause(true); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ---------------- Main loop ---------------- */
let last = performance.now(), clock = 0;
const focus = new THREE.Vector3();
function renderWeather(dt) {
  const p = game.player;
  if (game.state === 'race' && p && weather.N) {
    const rain = weather.rainAt(p.idx), wet = weather.wetAt(p.idx);
    world.setWeather(Math.max(rain, weather.global(game.raceTime) * 0.6), wet);
    weather.render(dt, camera, rain);
  } else { weather.render(dt, camera, 0); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  if (game.state === 'race' && game.player) {
    if (!game.paused || game.mp) {
      update(dt); updateCarVisuals(dt);
      audio.set(game.player.rpm, game.phase === 'lights' ? (keys.w ? 1 : 0) : game.player.inp.throttle, game.phase !== 'idle');
    }
    if (!window.__camLock) updateCamera(dt, clock);
    updateHUD(dt);
    focus.set(game.player.x, game.player.group.position.y, game.player.z);
  } else {
    if (!window.__camLock) updateMenuCamera(dt);
    focus.copy(camera.position).setY(0);
  }
  renderWeather(dt);
  world.update(dt, focus, camera);
  renderer.render(scene, camera);
  if (game.state === 'race') renderMirrors();
  updateSound(dt);
}
function updateSound(dt) {
  const p = game.player;
  if (!(game.state === 'race' && p && !game.paused && game.phase !== 'idle' && game.phase !== 'red')) { sound.update(dt, { on: false }); return; }
  let rival = null, bd = 60;
  for (const o of game.cars) { if (o === p || !o.active || !o.group.visible) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; rival = { eng: o.spec && o.spec.eng, rpm: o.rpm, thr: o.inp.throttle, gain: (1 - d / 60) ** 2 * 0.8 }; } }
  const lock = p.inp.brake > 0.8 && Math.abs(p.v) > 25 && Math.abs(p.steer) > 0.5;
  sound.update(dt, { on: true, eng: p.spec && p.spec.eng, rpm: p.rpm, throttle: game.phase === 'lights' ? (keys.w ? 1 : 0) : p.inp.throttle, gear: p.gear, speed: Math.abs(p.v), kerb: p.surf === 1, slide: Math.max(Math.abs(p.slip) * 2.5, lock ? 0.6 : 0, p.scrub > 0.9 ? 0.4 : 0) * (weather.N && weather.wetAt(p.idx) > 0.3 ? 0.2 : 1), rain: weather.N ? weather.rainAt(p.idx) : 0, impact: p.impact || 0, rival });
  p.impact = 0;
}
await loadCarModel('js/car.bin?v=conc27c');
initMenu();
requestAnimationFrame(frame);

// debugging hooks for automated checks
window.__apex = {
  deployFlag, game, settings, update, updateCarVisuals, updateCamera, updateHUD, setCam, startWeekend, startRace, startSession, leaveGarage, nextQualiStep, endQualiSession, showStrategy,
  buildTrack, getTrack, world, weather, renderer, scene, camera, standings, positionOf, keys, estimateLap, aiPace,
  frameOnce: () => { renderWeather(0.016); world.update(0.016, focus.set(game.player ? game.player.x : 0, game.player ? game.player.group.position.y : 0, game.player ? game.player.z : 0), camera); mirrorTick = 1; renderMirrors(); renderer.render(scene, camera); },
};
