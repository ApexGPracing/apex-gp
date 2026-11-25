/* Combustion-pulse engine voice (AudioWorklet).
   Every firing is a separate exhaust "bang": an impulse that rings a few exhaust-pipe resonances plus a short burst
   of noise. Each cylinder is a little louder or quieter than the others and every bang varies a little in strength
   and timing. That cycle-to-cycle roughness fills the gaps between the harmonics with the raspy, mechanical
   texture of a real engine; a perfectly repeating tone (an oscillator) sounds electric instead. */
class EnginePulse extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freq', defaultValue: 600, minValue: 5, maxValue: 6000, automationRate: 'k-rate' },    // firing frequency (Hz)
      { name: 'rough', defaultValue: 0.35, minValue: 0, maxValue: 2, automationRate: 'k-rate' },    // bang-to-bang variation
      { name: 'noise', defaultValue: 0.6, minValue: 0, maxValue: 4, automationRate: 'k-rate' },     // combustion noise in each bang
      { name: 'tone', defaultValue: 1, minValue: 0.3, maxValue: 3, automationRate: 'k-rate' },      // scales the pipe resonances
    ];
  }
  constructor(opts) {
    super();
    const o = (opts && opts.processorOptions) || {};
    this.cyl = o.cyl || 10;
    // pipe/collector resonances [Hz at 1500 Hz firing, ring time (s), level]
    this.res = (o.res || [[620, 0.0016, 0.55], [1350, 0.0010, 1.0], [2500, 0.0007, 0.75], [4100, 0.00045, 0.5]]).map(([f, tau, g]) => ({ f, tau, g, y1: 0, y2: 0, a1: 0, a2: 0 }));
    this.seed = 12345;
    this.cg = []; for (let k = 0; k < 16; k++) this.cg.push(0.72 + 0.56 * this.rnd());   // fixed cylinder-to-cylinder differences
    this.ph = 0; this.k = 0; this.next = 1; this.env = 0; this.pop = 0;
    this.port.onmessage = e => { if (e.data && e.data.cyl) this.cyl = e.data.cyl; };
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  process(inputs, outputs, P) {
    const out = outputs[0][0]; if (!out) return true;
    const sr = sampleRate, freq = P.freq[0], rough = P.rough[0], noise = P.noise[0], tone = P.tone[0];
    const track = 0.8 + 0.2 * Math.min(1.6, freq / 1500);   // the resonances move a little with revs
    for (const r of this.res) { const rr = Math.exp(-1 / (r.tau * sr)), w = 2 * Math.PI * Math.min(0.45 * sr, r.f * tone * track) / sr; r.a1 = 2 * rr * Math.cos(w); r.a2 = rr * rr; }
    const dEnv = Math.exp(-1 / (0.00028 * sr)), dPop = Math.exp(-1 / (0.00012 * sr)), step = freq / sr;
    for (let n = 0; n < out.length; n++) {
      let x = 0;
      this.ph += step;
      if (this.ph >= this.next) {
        this.ph -= this.next;
        this.next = 1 + 0.06 * rough * (this.rnd() - 0.5);                         // timing wander
        this.k = (this.k + 1) % this.cyl;
        x = this.cg[this.k] * (1 + rough * (this.rnd() - 0.5));                      // strength of this bang
      }
      let y = 0;
      for (const r of this.res) { const v = r.a1 * r.y1 - r.a2 * r.y2 + x * r.g; r.y2 = r.y1; r.y1 = v; y += v; }
      this.env = this.env * dEnv + x * noise; this.pop = this.pop * dPop + x;
      y = y * 0.16 + this.env * (this.rnd() * 2 - 1) * 0.5 + this.pop * 0.35;
      out[n] = y;
    }
    return true;
  }
}
registerProcessor('engine-pulse', EnginePulse);
