/* Online multiplayer networking.
   - Rooms and signalling go through a Supabase Realtime channel ("apexgp-room-CODE"): presence says who is in
     the room, broadcasts carry WebRTC offers/answers/ICE candidates and the race start.
   - Car states then go straight between browsers over WebRTC data channels (unordered, no retransmits), so
     they are fast and do not use up Supabase's message quota.
   - If two players cannot connect directly (strict networks), their states are relayed over the Supabase
     channel instead, at a lower rate.
   For local testing, ?mplocal in the URL swaps Supabase for a BroadcastChannel between tabs of one browser. */

import { TURN_USER, TURN_PASS } from './config.js?v=voice28b';
let ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
// Metered TURN relay: UDP and TCP on port 80, TCP on 443, and TLS on 443 (gets through most school firewalls)
if (TURN_USER && TURN_PASS) ICE = ICE.concat([{ urls: 'stun:stun.relay.metered.ca:80' }, ...['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'].map(urls => ({ urls, username: TURN_USER, credential: TURN_PASS }))]);
/* TURN relay (Metered / Open Relay): lets players connect even when a direct link is impossible (mobile data,
   strict routers). Credentials are fetched once from the app's Metered API key if one is configured. */
let turnLoaded = null;
export function loadTurn(app, key) {
  if (!app || !key || turnLoaded) return turnLoaded;
  turnLoaded = fetch('https://' + app + '.metered.live/api/v1/turn/credentials?apiKey=' + encodeURIComponent(key))
    .then(r => r.ok ? r.json() : []).then(list => { if (Array.isArray(list) && list.length) ICE = ICE.concat(list); }).catch(() => {});
  return turnLoaded;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---- signalling transports: Supabase Realtime, or BroadcastChannel for local tests ---- */
let supaClient = null;
async function supabaseTransport(url, key, code, me, onMsg, onPeers) {
  if (!supaClient) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
    supaClient = createClient(url, key, { realtime: { params: { eventsPerSecond: 40 } } });
  }
  const ch = supaClient.channel('apexgp-room-' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(), list = [];
    for (const k in st) { const p = st[k][0]; if (p) list.push(p); }
    onPeers(list);
  });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('timeout')), 12000);
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') { clearTimeout(to); await ch.track(me); res(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); rej(new Error(status)); }
    });
  });
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    update: info => ch.track(info),
    close: () => { try { ch.untrack(); supaClient.removeChannel(ch); } catch (e) { /* already gone */ } },
  };
}
function localTransport(code, me, onMsg, onPeers) {
  const bc = new BroadcastChannel('apexgp-room-' + code), peers = new Map();
  let info = me;
  const sync = () => onPeers([info, ...[...peers.values()].map(p => p.info)]);
  bc.onmessage = e => {
    const m = e.data;
    if (m.kind === 'hello' || m.kind === 'here') { const known = peers.has(m.info.id); peers.set(m.info.id, { info: m.info, t: Date.now() }); if (m.kind === 'hello' || !known) bc.postMessage({ kind: 'here', info }); sync(); }
    else if (m.kind === 'bye') { peers.delete(m.id); sync(); }
    else if (m.kind === 'm') onMsg(m.payload);
  };
  bc.postMessage({ kind: 'hello', info }); setTimeout(sync, 50);
  const beat = setInterval(() => { bc.postMessage({ kind: 'here', info }); const now = Date.now(); for (const [id, p] of peers) if (now - p.t > 6000) { peers.delete(id); sync(); } }, 2000);
  return Promise.resolve({
    send: payload => bc.postMessage({ kind: 'm', payload }),
    update: i => { info = i; bc.postMessage({ kind: 'here', info }); sync(); },
    close: () => { clearInterval(beat); bc.postMessage({ kind: 'bye', id: me.id }); bc.close(); },
  });
}

export class Net {
  constructor({ url, key }) {
    this.url = url; this.key = key; this.local = /[?&]mplocal\b/.test(location.search);
    this.available = this.local || !!(url && key);
    this.id = rid(); this.code = null; this.room = []; this.peers = new Map(); this.tr = null;
    this.handlers = {}; this.lastRelay = new Map(); this.lastRx = new Map();
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, ...a) { const f = this.handlers[ev]; if (f) f(...a); }

  async join(code, name, extra = {}) {
    await this.leave();
    this.code = code.toUpperCase(); this.name = name;
    this.me = { id: this.id, name, joined: Date.now(), ...extra };
    const onMsg = m => this.onSignal(m), onPeers = list => this.onPeers(list);
    this.tr = this.local ? await localTransport(this.code, this.me, onMsg, onPeers) : await supabaseTransport(this.url, this.key, this.code, this.me, onMsg, onPeers);
    return this.code;
  }
  async leave() {
    for (const p of this.peers.values()) { try { p.pc.close(); } catch (e) { /* closed */ } }
    this.peers.clear();
    if (this.tr) { this.tr.close(); this.tr = null; }
    this.code = null; this.room = [];
  }
  /* random 1v1 matchmaking: everyone searching waits in one shared channel; the queue (oldest first) is paired
     off two at a time, and each pair works out the same private room code from their ids. */
  async matchmake(name, onCount) {
    await this.leave(); this.cancelMatch();
    const me = { id: this.id, name, joined: Date.now() };
    let done = false, finish;
    const found = new Promise(res => { finish = res; });
    const onPeers = list => {
      if (done) return;
      const q = list.slice().sort((a, b) => a.joined - b.joined || (a.id < b.id ? -1 : 1)), k = q.findIndex(p => p.id === this.id);
      if (k < 0) return;
      if (onCount) onCount(q.length);
      const mate = q[k ^ 1]; if (!mate) return;
      done = true;
      const key = [this.id, mate.id].sort().join(':'); let h = 2166136261;
      for (let j = 0; j < key.length; j++) h = Math.imul(h ^ key.charCodeAt(j), 16777619) >>> 0;
      let code = ''; for (let j = 0; j < 4; j++) { code += CODE_CHARS[h % CODE_CHARS.length]; h = Math.floor(h / CODE_CHARS.length) ^ Math.imul(h, 2654435761) >>> 0; }
      finish({ code, mate });
    };
    const tr = this.local ? await localTransport('MATCH', me, () => {}, onPeers) : await supabaseTransport(this.url, this.key, 'MATCH', me, () => {}, onPeers);
    this.matchTr = tr; this.matchCancel = () => finish(null);
    const res = await found;
    // stay listed a moment so the partner also sees the pair before we disappear from the queue
    setTimeout(() => { try { tr.close(); } catch (e) { /* gone */ } if (this.matchTr === tr) this.matchTr = null; }, res ? 700 : 0);
    return res;
  }
  /* live count of everyone with the game open: a presence-only channel that every player joins on load */
  async watchOnline(onCount) {
    if (!this.available || this.onlineTr) return;
    const me = this.onlineMe = { id: this.id + '-o', joined: Date.now(), a: this.onlineAct || 'menu' }, onPeers = list => onCount(list.length, list);
    try { this.onlineTr = this.local ? await localTransport('ONLINE', me, () => {}, onPeers) : await supabaseTransport(this.url, this.key, 'ONLINE', me, () => {}, onPeers); }
    catch (e) { this.onlineTr = null; setTimeout(() => this.watchOnline(onCount), 30000); }
  }
  /* what this player is doing (menu / ai / tt / room / search / online / derby), shown in everyone's online count */
  setActivity(a) {
    this.onlineAct = a;
    if (!this.onlineTr || !this.onlineMe || this.onlineMe.a === a) return;
    this.onlineMe = { ...this.onlineMe, a }; try { this.onlineTr.update(this.onlineMe); } catch (e) { /* gone */ }
  }
  cancelMatch() { if (this.matchCancel) { const f = this.matchCancel; this.matchCancel = null; f(); } }
  setInfo(extra) { if (!this.tr) return; this.me = { ...this.me, ...extra }; this.tr.update(this.me); }
  get isHost() { return this.room.length > 0 && this.room[0].id === this.id; }

  onPeers(list) {
    // host = whoever has been in the room longest
    this.room = list.slice().sort((a, b) => a.joined - b.joined || (a.id < b.id ? -1 : 1));
    const ids = new Set(this.room.map(p => p.id));
    for (const [id, p] of this.peers) if (!ids.has(id)) { try { p.pc.close(); } catch (e) { /* closed */ } this.peers.delete(id); this.emit('peerLeft', id); }
    for (const p of this.room) if (p.id !== this.id && !this.peers.has(p.id) && this.id < p.id) this.connect(p.id, true);
    this.emit('room', this.room);
  }

  /* ---- WebRTC ---- */
  makePeer(id) {
    const pc = new RTCPeerConnection({ iceServers: ICE }), peer = { pc, dc: null, open: false };
    this.peers.set(id, peer);
    pc.onicecandidate = e => { if (e.candidate) this.signal(id, { ice: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { peer.open = false; this.emit('peerLink', id, false); this.retry(id); } };
    peer.timer = setTimeout(() => { if (!peer.open) this.retry(id); }, 9000);
    pc.ondatachannel = e => this.wireDC(id, peer, e.channel);
    return peer;
  }
  wireDC(id, peer, dc) {
    peer.dc = dc;
    dc.onopen = () => { peer.open = true; clearTimeout(peer.timer); this.emit('peerLink', id, true); };
    dc.onclose = () => { peer.open = false; };
    dc.onmessage = e => { try { this.lastRx.set(id, performance.now()); this.emit('data', id, JSON.parse(e.data)); } catch (err) { /* bad packet */ } };
  }
  retry(id) {
    const old = this.peers.get(id); if (!old || old.open) return;
    const n = (old.tries || 0) + 1; if (n > 4 || !this.room.some(p => p.id === id)) return;
    clearTimeout(old.timer); try { old.pc.close(); } catch (e) { /* closed */ }
    this.peers.delete(id);
    // the side with the lower id makes the offer; the other side asks it to
    if (this.id < id) this.connect(id).then(() => { const p = this.peers.get(id); if (p) p.tries = n; });
    else this.signal(id, { again: n });
  }
  async connect(id) {
    const peer = this.makePeer(id);
    this.wireDC(id, peer, peer.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 }));
    const offer = await peer.pc.createOffer(); await peer.pc.setLocalDescription(offer);
    this.signal(id, { sdp: peer.pc.localDescription.toJSON() });
  }
  signal(to, data) { if (this.tr) this.tr.send({ t: 'sig', from: this.id, to, data }); }
  async onSignal(m) {
    if (m.to && m.to !== this.id) return;
    if (m.t === 'sig') {
      let peer = this.peers.get(m.from);
      const { sdp, ice, again } = m.data;
      if (again && this.id < m.from) { const p0 = this.peers.get(m.from); if (p0) { clearTimeout(p0.timer); try { p0.pc.close(); } catch (e) { /* closed */ } this.peers.delete(m.from); } await this.connect(m.from); const p1 = this.peers.get(m.from); if (p1) p1.tries = again; return; }
      try {
        if (sdp) {
          if (sdp.type === 'offer') {
            if (peer) { try { peer.pc.close(); } catch (e) { /* closed */ } }
            peer = this.makePeer(m.from);
            await peer.pc.setRemoteDescription(sdp);
            const ans = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(ans);
            this.signal(m.from, { sdp: peer.pc.localDescription.toJSON() });
            for (const c of peer.pendingIce || []) await peer.pc.addIceCandidate(c);
          } else if (peer) { await peer.pc.setRemoteDescription(sdp); for (const c of peer.pendingIce || []) await peer.pc.addIceCandidate(c); }
        } else if (ice && peer) {
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(ice); else (peer.pendingIce = peer.pendingIce || []).push(ice);
        }
      } catch (e) { /* negotiation hiccup: the relay still carries the data */ }
    } else if (m.t === 'relay') { this.lastRx.set(m.from, performance.now()); this.emit('data', m.from, m.data); }
    else this.emit('msg', m);
  }

  /* ---- sending ---- */
  // fast data (car states): direct where connected, otherwise relayed at up to 9 Hz
  sendFast(data) {
    const s = JSON.stringify(data), now = performance.now();
    let needRelay = false;
    for (const p of this.room) {
      if (p.id === this.id) continue;
      const peer = this.peers.get(p.id);
      const fresh = now - (this.lastRx.get(p.id) || 0) < 1500;
      if (peer && peer.open && peer.dc.readyState === 'open') { try { peer.dc.send(s); } catch (e) { needRelay = true; } if (!fresh) needRelay = true; }
      else needRelay = true;
    }
    if (needRelay && this.tr && now - (this.lastRelay.get('all') || 0) > 110) { this.lastRelay.set('all', now); this.tr.send({ t: 'relay', from: this.id, data }); }
  }
  // reliable, rare messages (race start, results) always go over the signalling channel
  broadcast(type, payload) { if (this.tr) this.tr.send({ t: type, from: this.id, ...payload }); }
  linkInfo() { const out = {}, now = performance.now(); for (const [id, p] of this.peers) out[id] = p.open && (!this.lastRx.has(id) || now - this.lastRx.get(id) < 3000); return out; }
}
