/* Online championships (Supabase): people sign up with a code, vote on a start time for each round,
   race in a normal online room at that time, and the finishing order is saved for the points table.
   The tables and functions are set up once from supabase/online-championships.sql. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=rims27p';
import { store } from './util.js?v=rims27p';

export const OC_ON = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const H = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + SUPABASE_ANON_KEY } : {}) };

/* this browser's player id (public) and secret (never leaves except to the check function) */
export function ocMe() {
  let id = store.get('apexgp-oc-id'), secret = store.get('apexgp-oc-secret');
  if (!id || !secret) {
    const r = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
    id = 'p' + r(8); secret = r(20); store.set('apexgp-oc-id', id); store.set('apexgp-oc-secret', secret);
  }
  return { id, secret };
}

export class OcError extends Error {}
async function rpc(fn, args) {
  const me = ocMe();
  let r;
  try { r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify({ p_id: me.id, p_secret: me.secret, ...args }) }); }
  catch (e) { throw new OcError('Could not reach the online service. Check your internet.'); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* not json */ }
  if (!r.ok) {
    if (r.status === 404 || (j && j.code === 'PGRST202')) throw new OcError('Online championships are not set up on the server yet.');
    throw new OcError((j && j.message) || 'Something went wrong (' + r.status + ').');
  }
  return j;
}
async function get(path) {
  let r;
  try { r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: H }); } catch (e) { throw new OcError('Could not reach the online service. Check your internet.'); }
  if (r.status === 404) throw new OcError('Online championships are not set up on the server yet.');
  if (!r.ok) throw new OcError('Could not load championships (' + r.status + ').');
  return r.json();
}

export const oc = {
  create: (name, title, series, laps, quali, rounds, livery) => rpc('oc_create', { p_name: name, p_title: title, p_series: series, p_laps: laps, p_quali: quali, p_rounds: rounds, p_livery: livery }),
  join: (name, code, livery) => rpc('oc_join', { p_name: name, p_code: code, p_livery: livery }),
  leave: champ => rpc('oc_leave', { p_champ: champ }),
  propose: (champ, round, at) => rpc('oc_propose', { p_champ: champ, p_round: round, p_at: at.toISOString() }),
  vote: (slot, on) => rpc('oc_vote', { p_slot: slot, p_on: on }),
  lock: slot => rpc('oc_lock', { p_slot: slot }),
  result: (champ, round, results) => rpc('oc_result', { p_champ: champ, p_round: round, p_results: results }),
  // championships I have signed up to
  mine: async () => (await get('oc_members?select=oc_champs(id,code,name,series,laps,quali,rounds,owner)&player_id=eq.' + encodeURIComponent(ocMe().id))).map(r => r.oc_champs).filter(Boolean),
  // everything about one championship
  load: async id => {
    const q = encodeURIComponent(id);
    const [champs, members, slots, results] = await Promise.all([
      get('oc_champs?id=eq.' + q), get('oc_members?champ_id=eq.' + q + '&order=joined_at.asc'),
      get('oc_slots?champ_id=eq.' + q + '&select=id,round,at,proposed_by,locked,oc_votes(player_id)&order=at.asc'), get('oc_results?champ_id=eq.' + q),
    ]);
    if (!champs.length) throw new OcError('That championship no longer exists.');
    return { champ: champs[0], members, slots: slots.map(s => ({ ...s, votes: (s.oc_votes || []).map(v => v.player_id) })), results };
  },
};

/* the start time the organiser has set for a round */
export function agreedSlot(slots, round) {
  const s = slots.filter(x => x.round === round && x.locked).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  return s ? { ...s, final: true } : null;
}
/* points table from the saved results: 25-18-15-12-10-8-6-4-2-1, nothing for a DNF */
export function ocStandings(data, points) {
  const tab = {};
  for (const m of data.members) tab[m.player_id] = { pid: m.player_id, name: m.name, livery: m.livery, pts: 0, wins: 0 };
  for (const r of data.results) (r.results || []).forEach((e, k) => {
    const t = tab[e.pid] || (tab[e.pid] = { pid: e.pid, name: e.name || 'Driver', livery: 0, pts: 0, wins: 0, left: true });
    if (!e.dnf) { t.pts += points[k] || 0; if (k === 0) t.wins++; }
  });
  return Object.values(tab).sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.name.localeCompare(b.name));
}
/* a fixed 4-character online room code for a championship round, so everyone lands in the same room */
export function ocRoomCode(champCode, round) {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let h = 2166136261;
  const key = 'oc:' + champCode + ':' + round; for (let j = 0; j < key.length; j++) h = Math.imul(h ^ key.charCodeAt(j), 16777619) >>> 0;
  let c = ''; for (let j = 0; j < 4; j++) { c += CH[h % CH.length]; h = Math.floor(h / CH.length) ^ (Math.imul(h, 2654435761) >>> 0); }
  return c;
}
