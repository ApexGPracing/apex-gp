/* Synthesised sound: a screaming 2011-era V8 (18,000 rpm, exhaust-blown diffuser) for the player's car
   (plus the nearest rival), off-throttle "hot blowing" stutter and crackle, seamless-shift cuts,
   downshift blips, kerb rumble, tyre squeal, wind, rain and impacts. */
const ENG_F1 = { lo: 7000, hi: 18000, cyl: 8, roar: 1, scream: 1 };
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.prevGear = 0; this.popT = 0; this.stutT = 0; this.blowAmt = 0; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.15;
      this.master.connect(comp); comp.connect(ctx.destination);
      // shared white-noise buffer
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.engine = this.makeEngine(0.9);
      this.rival = this.makeEngine(0.35);
      this.rumble = this.makeNoise('lowpass', 160, 1.5); this.rumbleLfo = ctx.createOscillator(); this.rumbleLfo.type = 'square';
      // kerb rumble: the LFO chops a separate stage (0..1) AFTER the level gain, so at level 0 it is truly silent
      // (it used to add straight onto the level, which left a buzz playing on the menu and everywhere else)
      const chop = ctx.createGain(); chop.gain.value = 0.5; this.rumble.g.disconnect(); this.rumble.g.connect(chop); chop.connect(this.master);
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5; this.rumbleLfo.connect(lfoGain); lfoGain.connect(chop.gain); this.rumbleLfo.frequency.value = 10; this.rumbleLfo.start();
      this.squeal = this.makeNoise('bandpass', 1900, 9);
      this.wind = this.makeNoise('lowpass', 700, 0.7);
      this.rain = this.makeNoise('highpass', 2600, 0.5);
    } catch (e) { this.ctx = null; }
  }
  makeNoise(type, freq, q) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    return { f, g };
  }
  makeEngine(level) {
    // High-revving V8 (up to 18,000 rpm, 4 firing pulses per revolution). Each voice runs at half the
    // firing frequency with a custom harmonic spectrum: the firing order (2nd harmonic) dominates, with
    // its overtones for the scream and a little half-order content for growl. Two voices are detuned
    // slightly against each other (banks of cylinders), then shaped by a high-pass, a presence peak and
    // a gentle saturation — no square waves, so no buzzy "two-stroke" sound.
    const ctx = this.ctx;
    const amps = [0, 0.1, 1.0, 0.18, 0.75, 0.08, 0.55, 0.05, 0.4, 0.04, 0.24, 0.03, 0.15, 0.02, 0.09, 0.01, 0.05];
    const real = new Float32Array(amps.length), imag = new Float32Array(amps);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    const mk = () => { const o = ctx.createOscillator(); o.setPeriodicWave(wave); return o; };
    const o1 = mk(), o2 = mk();
    const g1 = ctx.createGain(), g2 = ctx.createGain(); g1.gain.value = 0.55; g2.gain.value = 0.45;
    // subtle vibrato from uneven combustion
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 23; lfoG.gain.value = 3; lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency); lfo.start();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70; hp.Q.value = 0.7;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2200; pres.Q.value = 1.1; pres.gain.value = 8;
    const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4); }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5;
    const out = ctx.createGain(); out.gain.value = 0;
    const gate = ctx.createGain(); gate.gain.value = 1;
    o1.connect(g1); o2.connect(g2); g1.connect(hp); g2.connect(hp);
    hp.connect(pres); pres.connect(shaper); shaper.connect(lp); lp.connect(out); out.connect(gate); gate.connect(this.master);
    o1.start(); o2.start();
    // "scream" layer: the firing frequency and its 2nd/3rd orders through a bright resonant band.
    // This is what makes a high-revving V8 sound like a V8 rather than a hum.
    const sc = ctx.createOscillator(); sc.type = 'sawtooth';
    const sc2 = ctx.createOscillator(); sc2.type = 'sawtooth';
    const scBand = ctx.createBiquadFilter(); scBand.type = 'bandpass'; scBand.frequency.value = 3000; scBand.Q.value = 1.1;
    const scG = ctx.createGain(); scG.gain.value = 0;
    const sc2G = ctx.createGain(); sc2G.gain.value = 0.5;
    sc.connect(scBand); sc2.connect(sc2G); sc2G.connect(scBand); scBand.connect(scG); scG.connect(out);
    sc.start(); sc2.start();
    // exhaust rasp: noise chopped at the firing frequency (each combustion pulse is a burst of noise)
    const nz = ctx.createBufferSource(); nz.buffer = this.noiseBuf; nz.loop = true;
    const nzBand = ctx.createBiquadFilter(); nzBand.type = 'bandpass'; nzBand.frequency.value = 1800; nzBand.Q.value = 0.8;
    const chop = ctx.createGain(); chop.gain.value = 0;
    const pulse = ctx.createOscillator(); pulse.type = 'square';
    const pulseDepth = ctx.createGain(); pulseDepth.gain.value = 0.5;
    const pulseBias = ctx.createConstantSource(); pulseBias.offset.value = 0.5;
    pulse.connect(pulseDepth); pulseDepth.connect(chop.gain); pulseBias.connect(chop.gain);
    const rasp = ctx.createGain(); rasp.gain.value = 0;
    nz.connect(nzBand); nzBand.connect(chop); chop.connect(rasp); rasp.connect(out);
    nz.start(); pulse.start(); pulseBias.start();
    // ROAR layer: dense saw stack at the firing frequency, half order and its octave above, driven hard into
    // a distortion stage (drive rises with throttle) and voiced with a chesty low-mid body. This is the
    // full-throated bark under the scream.
    const r1 = ctx.createOscillator(), r2 = ctx.createOscillator(), r3 = ctx.createOscillator();
    r1.type = 'sawtooth'; r2.type = 'sawtooth'; r3.type = 'triangle';
    const r2G = ctx.createGain(); r2G.gain.value = 0.7; const r3G = ctx.createGain(); r3G.gain.value = 0.5;
    const rDrive = ctx.createGain(); rDrive.gain.value = 2;
    const rShape = ctx.createWaveShaper(), rc = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; rc[i] = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 4)) / (1 - Math.exp(-4)); }
    rShape.curve = rc; rShape.oversample = '2x';
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 420; body.Q.value = 0.8; body.gain.value = 7;
    const bite = ctx.createBiquadFilter(); bite.type = 'peaking'; bite.frequency.value = 1300; bite.Q.value = 1.2; bite.gain.value = 5;
    const rLp = ctx.createBiquadFilter(); rLp.type = 'lowpass'; rLp.frequency.value = 3000; rLp.Q.value = 0.9;
    const roarG = ctx.createGain(); roarG.gain.value = 0;
    r1.connect(rDrive); r2.connect(r2G); r2G.connect(rDrive); r3.connect(r3G); r3G.connect(rDrive);
    rDrive.connect(rShape); rShape.connect(body); body.connect(bite); bite.connect(rLp); rLp.connect(roarG); roarG.connect(out);
    // a little noise in the roar too: combustion is never a clean tone
    const rNz = ctx.createGain(); rNz.gain.value = 0.35; nzBand.connect(rNz); rNz.connect(rDrive);
    r1.start(); r2.start(); r3.start();
    return { o1, o2, f1: pres, f2: lp, out, gate, level, srpm: 7000, sc, sc2, scBand, scG, pulse, rasp, nzBand, r1, r2, r3, rDrive, rLp, roarG };
  }
  setEngine(e, rpm, thr, gain, blow = 0, eng = ENG_F1) {
    // the game's rev range (4k-12.5k) is mapped onto the real engine's range (F1 V8: 7k-18k, GT3 V8: 3.5k-8.8k...)
    const t = this.ctx.currentTime, span = eng.hi - eng.lo, target = eng.lo + Math.min(1, Math.max(0, (rpm - 4000) / 8500)) * span;
    if (e.eng !== eng) { e.eng = eng; e.srpm = target; }
    e.srpm += (target - e.srpm) * 0.22;
    // combustion irregularity; a lazy big V8 (GT3) burbles much more than a screaming F1 engine
    const lumpy = eng.cyl === 8 && eng.hi < 10000 ? 4 : 1;
    e.jit = (e.jit || 0) * 0.85 + (Math.random() - 0.5) * 0.0035 * lumpy;
    const fire = e.srpm / 60 * eng.cyl / 2 * (1 + e.jit), base = fire / 2;
    e.o1.frequency.setTargetAtTime(base, t, 0.015); e.o2.frequency.setTargetAtTime(base * 1.0035, t, 0.015);
    e.f1.frequency.setTargetAtTime(1600 + e.srpm * 0.08, t, 0.05);
    e.f2.frequency.setTargetAtTime(2500 + thr * 4500 + e.srpm * 0.15, t, 0.05);
    // scream gets stronger with revs and throttle; rasp is strongest on throttle
    const hi = Math.min(1, Math.max(0, (e.srpm - (eng.lo + 0.18 * span)) / (0.82 * span))) * eng.scream;
    e.sc.frequency.setTargetAtTime(fire, t, 0.015); e.sc2.frequency.setTargetAtTime(fire * 1.5, t, 0.015);
    e.scBand.frequency.setTargetAtTime(1600 + fire * 3.3, t, 0.05);
    e.scG.gain.setTargetAtTime(0.3 + 1.3 * hi * (0.45 + 0.55 * thr), t, 0.04);
    e.pulse.frequency.setTargetAtTime(fire, t, 0.015);
    e.nzBand.frequency.setTargetAtTime(1200 + e.srpm * 0.08, t, 0.05);
    // off-throttle hot blowing keeps the exhaust loud and raspy instead of letting the engine fall quiet
    e.rasp.gain.setTargetAtTime(0.15 + 0.45 * thr + 0.6 * blow, t, 0.04);
    // roar: drive and brightness open up with throttle; stays meaty on hot-blown overrun
    e.r1.frequency.setTargetAtTime(fire, t, 0.015); e.r2.frequency.setTargetAtTime(base * 1.004, t, 0.015); e.r3.frequency.setTargetAtTime(fire * 2, t, 0.015);
    e.rDrive.gain.setTargetAtTime((1 + 2.8 * thr + 2 * blow) * eng.roar, t, 0.04);
    e.rLp.frequency.setTargetAtTime(1400 + thr * 3200 + e.srpm * 0.12, t, 0.05);
    e.roarG.gain.setTargetAtTime((0.25 + 0.4 * thr + 0.3 * blow) * eng.roar, t, 0.04);
    e.out.gain.setTargetAtTime(this.muted ? 0 : gain * e.level * (0.09 + 0.17 * Math.max(thr, 0.75 * blow)), t, 0.04);
  }
  burst(gain, dur, freq = 1500, q = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  /* firework: a deep boom, a sharp crack and (for big shells) a crackle that follows a moment later */
  boom(g = 1) {
    if (!this.ctx || this.muted) return;
    this.burst(0.9 * g, 1.4, 90, 0.8); this.burst(0.35 * g, 0.25, 900, 0.7);
    if (g > 0.6) for (let k = 0; k < 6; k++) setTimeout(() => this.burst(0.12, 0.05 + Math.random() * 0.05, 3500 + Math.random() * 2500, 2), 500 + Math.random() * 900);
  }

  /* called every frame */
  update(dt, s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = s.on && !this.muted;
    if (!on) { [this.engine.out, this.rival.out, this.rumble.g, this.squeal.g, this.wind.g, this.rain.g].forEach(g => g.gain.setTargetAtTime(0, t, 0.05)); return; }
    let rpm = s.rpm;
    // downshift blip: rpm flares when a lower gear is selected
    if (s.gear > 0 && this.prevGear > 0 && s.gear < this.prevGear) { this.blip = 0.12; this.burst(0.09, 0.08, 2600, 2); this.burst(0.08, 0.06, 700, 1); }
    // seamless upshift: a near-instant torque cut with a sharp crack
    if (s.gear > 1 && this.prevGear > 0 && s.gear > this.prevGear) {
      const g = this.engine.gate.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.25, t); g.setTargetAtTime(1, t + 0.025, 0.012);
      this.burst(0.07, 0.04, 1800, 1.2);
    }
    this.prevGear = s.gear;
    if (this.blip > 0) { this.blip -= dt; rpm = Math.min(12500, rpm + 1600); }
    // exhaust-blown diffuser "hot blowing": off throttle the engine keeps firing (ignition retarded), so it
    // stutters and crackles loudly into every braking zone instead of going quiet
    const blowOn = s.throttle < 0.15 && s.rpm > 6500 && s.speed > 15 && s.gear > 0;
    this.blowAmt += ((blowOn ? 1 : 0) - this.blowAmt) * Math.min(1, dt * (blowOn ? 14 : 6));
    // the exhaust-blown-diffuser stutter is an F1 thing; other engines just crackle a little on the overrun
    const eng = s.eng || ENG_F1, bm = eng.hi >= 15000 ? 1 : 0.3;
    this.setEngine(this.engine, rpm, Math.max(s.throttle, this.blip > 0 ? 0.6 : 0), 1, this.blowAmt * bm, eng);
    const gate = this.engine.gate.gain;
    if (this.blowAmt * bm > 0.05) {
      // irregular misfire chop, scheduled slightly ahead of the audio clock
      if (this.stutT < t) this.stutT = t;
      while (this.stutT < t + 0.08) {
        const r = Math.random(), lvl = r < 0.3 ? 0.15 : r < 0.55 ? 0.5 : 1;
        gate.setValueAtTime(1 - this.blowAmt * bm * (1 - lvl), this.stutT);
        this.stutT += 0.008 + Math.random() * 0.022;
      }
      // loud pops and bangs from fuel burning in the exhaust
      this.popT -= dt;
      if (this.popT <= 0) {
        this.popT = 0.025 + Math.random() * 0.07;
        const big = Math.random() < 0.18;
        this.burst((big ? 0.22 : 0.08 + Math.random() * 0.1) * this.blowAmt * Math.max(bm, 0.6), big ? 0.09 : 0.04 + Math.random() * 0.04, big ? 350 + Math.random() * 300 : 700 + Math.random() * 1600, big ? 0.6 : 0.9);
      }
    } else if (this.stutT) { gate.cancelScheduledValues(t); gate.setTargetAtTime(1, t, 0.01); this.stutT = 0; }
    // nearest rival
    if (s.rival) this.setEngine(this.rival, s.rival.rpm, s.rival.thr, s.rival.gain, s.rival.thr < 0.15 && s.rival.rpm > 6500 ? 0.8 * ((s.rival.eng || ENG_F1).hi >= 15000 ? 1 : 0.3) : 0, s.rival.eng || ENG_F1); else this.rival.out.gain.setTargetAtTime(0, t, 0.1);
    // kerbs: rumble pulses at the stripe frequency
    this.rumbleLfo.frequency.setTargetAtTime(Math.max(2, s.speed / 2), t, 0.05);
    this.rumble.g.gain.setTargetAtTime(s.kerb && s.speed > 5 ? 0.35 : 0, t, 0.03);
    this.squeal.g.gain.setTargetAtTime(Math.min(0.12, s.slide * 0.18), t, 0.05);
    this.wind.g.gain.setTargetAtTime(Math.min(0.16, (s.speed / 90) ** 2 * 0.16), t, 0.1);
    this.rain.g.gain.setTargetAtTime(s.rain * 0.12, t, 0.3);
    if (s.impact > 0.05) this.burst(0.5 * s.impact, 0.35, 220, 0.7), this.burst(0.25 * s.impact, 0.2, 2500, 1);
  }
}
