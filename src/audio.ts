/* Emberfall audio engine — all music and sound is synthesized live with Web Audio.
   No samples, no external files. Each realm has its own scale, tempo and motif. */

import { Engine, parseSong, type Song } from 'toneweft';
import { USE_TONEWEFT, THEME_SONGS } from './music';

type ThemeId = 'menu' | 'map' | 'ashen' | 'whisper' | 'frost' | 'sanctum' | 'throne';

interface Theme {
  bpm: number;
  root: number;            // MIDI root
  scale: number[];         // semitone intervals
  chords: number[][];      // semitone offsets from root per bar
  motif: number[];         // lead notes as semitone offsets from root
  motifSteps: number[];    // 16th step positions for motif
  arp: 'up' | 'down' | 'wave' | 'sparse';
  padWave: OscillatorType;
  leadWave: OscillatorType;
  kick: boolean;
}

const THEMES: Record<ThemeId, Theme> = {
  menu: {
    bpm: 72, root: 50, scale: [0, 2, 3, 5, 7, 8, 10],
    chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [5, 8, 12]],
    motif: [12, 15, 19, 17, 15, 12, 10, 12],
    motifSteps: [0, 4, 6, 10, 16, 22, 26, 30],
    arp: 'sparse', padWave: 'triangle', leadWave: 'sine', kick: false,
  },
  map: {
    bpm: 78, root: 52, scale: [0, 2, 4, 7, 9], // major pentatonic
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]],
    motif: [12, 16, 19, 21, 19, 16, 14, 12],
    motifSteps: [0, 4, 8, 12, 16, 20, 24, 28],
    arp: 'up', padWave: 'triangle', leadWave: 'sine', kick: false,
  },
  ashen: {
    bpm: 96, root: 38, scale: [0, 2, 3, 5, 7, 8, 10],
    chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]],
    motif: [12, 15, 19, 15, 12, 10, 7, 10],
    motifSteps: [0, 3, 6, 8, 16, 19, 22, 24],
    arp: 'down', padWave: 'sawtooth', leadWave: 'triangle', kick: true,
  },
  whisper: {
    bpm: 84, root: 45, scale: [0, 2, 3, 5, 7, 9, 10], // dorian
    chords: [[0, 3, 7], [5, 8, 12], [10, 14, 17], [7, 10, 14]],
    motif: [12, 14, 17, 19, 17, 14, 12, 10],
    motifSteps: [0, 6, 8, 12, 16, 20, 22, 28],
    arp: 'wave', padWave: 'triangle', leadWave: 'sine', kick: false,
  },
  frost: {
    bpm: 90, root: 40, scale: [0, 2, 3, 5, 7, 8, 10],
    chords: [[0, 3, 7], [3, 7, 10], [8, 12, 15], [5, 8, 12]],
    motif: [24, 22, 19, 17, 15, 14, 12, 15],
    motifSteps: [0, 4, 8, 10, 16, 18, 24, 28],
    arp: 'up', padWave: 'sine', leadWave: 'triangle', kick: false,
  },
  sanctum: {
    bpm: 76, root: 37, scale: [0, 2, 3, 5, 7, 8, 11], // harmonic minor
    chords: [[0, 3, 7], [8, 12, 15], [3, 7, 11], [10, 14, 17]],
    motif: [12, 15, 19, 24, 23, 19, 15, 12],
    motifSteps: [0, 4, 6, 12, 16, 20, 24, 30],
    arp: 'wave', padWave: 'triangle', leadWave: 'sine', kick: true,
  },
  throne: {
    bpm: 118, root: 36, scale: [0, 1, 3, 5, 7, 8, 10], // phrygian
    chords: [[0, 3, 7], [1, 5, 8], [8, 12, 15], [10, 13, 17]],
    motif: [12, 15, 19, 20, 19, 15, 12, 8],
    motifSteps: [0, 2, 6, 8, 16, 18, 22, 24],
    arp: 'down', padWave: 'sawtooth', leadWave: 'square', kick: true,
  },
};

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Matches the old sequencer's loudness on the music bus.
const TONEWEFT_TRIM = 0.92;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbGain!: GainNode;
  // Each bus reaches the shared reverb through its own gated send, so muting music or sound
  // effects also mutes their reverb tail (it used to bypass the buses and keep droning).
  private musicVerb!: GainNode;
  private sfxVerb!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicLevel = 1; // 0..1, from the music slider (0 when muted)
  private sfxLevel = 1;
  private currentTheme: ThemeId = 'menu';
  private playing = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private intensity = false;
  private started = false;
  private tw: Engine | null = null;
  private twTrim!: GainNode;
  private twSongs = new Map<ThemeId, Song>();
  private twTheme: ThemeId | null = null;

  get ready(): boolean { return this.ctx !== null; }

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.22 * this.musicLevel;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55 * this.sfxLevel;
    this.sfxBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.5;
    this.reverbGain.connect(this.reverb).connect(this.master);
    this.musicVerb = ctx.createGain();
    this.musicVerb.gain.value = this.musicLevel;
    this.musicVerb.connect(this.reverbGain);
    this.sfxVerb = ctx.createGain();
    this.sfxVerb.gain.value = this.sfxLevel;
    this.sfxVerb.connect(this.reverbGain);
    this.noiseBuf = this.makeNoise(1.5);
    if (USE_TONEWEFT) {
      this.twTrim = ctx.createGain();
      this.twTrim.gain.value = TONEWEFT_TRIM;
      this.twTrim.connect(this.musicBus);
      // Toneweft has its own reverb, so it goes straight to the music bus and skips ours.
      this.tw = new Engine(ctx, { destination: this.twTrim, masterChain: false });
    }
    if (ctx.state === 'suspended') await ctx.resume();
    this.started = true;
    if (this.playing) {
      if (USE_TONEWEFT && this.tw) this.startToneweft(this.currentTheme, this.intensity);
      else this.startScheduler();
    }
  }

  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private makeNoise(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Music level 0..1 (slider position, squared so the slider feels even to the ear). */
  setMusicLevel(v: number) {
    this.musicLevel = v * v;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(0.22 * this.musicLevel, this.ctx.currentTime, 0.08);
    this.musicVerb.gain.setTargetAtTime(this.musicLevel, this.ctx.currentTime, 0.08);
  }
  /** Sound-effect level 0..1, same curve. */
  setSfxLevel(v: number) {
    this.sfxLevel = v * v;
    if (!this.ctx) return;
    this.sfxBus.gain.setTargetAtTime(0.55 * this.sfxLevel, this.ctx.currentTime, 0.05);
    this.sfxVerb.gain.setTargetAtTime(this.sfxLevel, this.ctx.currentTime, 0.05);
  }

  playMusic(theme: ThemeId, intensity = false): void {
    if (this.currentTheme === theme && this.playing && this.intensity === intensity) return;
    this.currentTheme = theme;
    this.intensity = intensity;
    this.playing = true;
    this.step = 0;
    if (!this.ctx) return;
    if (USE_TONEWEFT) {
      if (this.tw) this.startToneweft(theme, intensity);
      return;
    }
    if (this.timer === null) this.startScheduler();
    this.nextTime = this.ctx.currentTime + 0.15;
  }

  stopMusic(): void {
    this.playing = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.tw?.pause();
    this.twTheme = null;
  }

  private startToneweft(theme: ThemeId, intensity: boolean): void {
    const tw = this.tw;
    if (!tw) return;
    if (theme !== this.twTheme) {
      let song = this.twSongs.get(theme);
      if (!song) {
        const parsed = parseSong(THEME_SONGS[theme]);
        if (!parsed.ok) {
          console.error(`toneweft: could not parse the ${theme} song`, parsed.errors);
          this.startScheduler();
          return;
        }
        song = parsed.song;
        this.twSongs.set(theme, song);
      }
      tw.load(song);
      const numbered = song.bars.filter((bar) => bar.number >= 1);
      tw.setLoop({ fromBar: numbered[0].number, toBar: numbered[numbered.length - 1].number });
      tw.setLayerVolume('boss', intensity ? 1 : 0);
      tw.play();
      this.twTheme = theme;
    } else {
      tw.setLayerVolume('boss', intensity ? 1 : 0, 1.5);
      if (!tw.playing) tw.play();
    }
  }

  private startScheduler(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 55);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const theme = THEMES[this.currentTheme];
    const stepDur = 60 / theme.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.22) {
      this.playStep(theme, this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(t: Theme, step: number, time: number): void {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = t.chords[bar];
    const rootMidi = t.root + chord[0];
    const rootFreq = midiToFreq(rootMidi);
    const intensity = this.intensity;

    // PAD — every bar
    if (s === 0) {
      const dur = (60 / t.bpm) * 4 * 0.98;
      chord.forEach((iv, i) => this.pad(midiToFreq(t.root + iv), time, dur, 0.05, t.padWave, i));
    }
    // BASS
    if (s === 0 || s === 6 || (s === 10 && (bar % 2 === 1 || intensity))) {
      this.bass(rootFreq / 2, time, 0.5, s === 0 ? 0.22 : 0.14);
    }
    // ARPEGGIO
    const arpFreqs = chord.map(iv => midiToFreq(t.root + 12 + iv));
    if (t.arp === 'up') {
      if (s % 2 === 0) this.pluck(arpFreqs[(s / 2) % arpFreqs.length], time, 0.16, 0.05, t.leadWave);
    } else if (t.arp === 'down') {
      if (s % 2 === 1 || intensity) {
        const di = ((3 - Math.floor(s / 2)) % arpFreqs.length + arpFreqs.length) % arpFreqs.length;
        this.pluck(arpFreqs[di], time, 0.14, 0.045, t.leadWave);
      }
    } else if (t.arp === 'wave') {
      if (s % 2 === 0) {
        const seq = [0, 1, 2, 1];
        this.pluck(arpFreqs[seq[(s / 2) % 4] % arpFreqs.length], time, 0.4, 0.04, 'sine');
      }
    } else if (t.arp === 'sparse') {
      if (s === 4 || s === 12) this.pluck(arpFreqs[bar % arpFreqs.length], time, 0.6, 0.045, 'sine');
    }
    // LEAD MOTIF — bar-relative, plays on motif steps
    const idx = t.motifSteps.indexOf(step % 32);
    if (idx >= 0) {
      const note = t.motif[idx % t.motif.length];
      const freq = midiToFreq(t.root + 12 + note);
      this.lead(freq, time, 0.5, 0.055, t.leadWave);
      if (idx % t.motif.length === 4) this.lead(freq * 2, time + 0.02, 0.35, 0.025, 'sine');
    }
    // DRUMS
    if (t.kick || intensity) {
      if (s === 0 || s === 8) this.kick(time, 0.24);
      if (s === 4 || s === 12) this.snare(time, 0.09);
      if (s % 2 === 0) this.hat(time, s % 4 === 0 ? 0.035 : 0.02);
      if (intensity && (s === 14 || s === 7)) this.kick(time, 0.14);
      if (intensity && s === 15) this.snare(time, 0.06);
    }
  }

  /* -------------------------------- instruments ------------------------------- */

  private env(node: AudioNode, time: number, attack: number, decay: number, peak: number, sustain = 0.0001): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), time + attack + decay);
    node.connect(g);
    return g;
  }

  private pad(freq: number, time: number, dur: number, vol: number, wave: OscillatorType, detuneIdx: number): void {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500 + detuneIdx * 160, time);
    filter.frequency.linearRampToValueAtTime(900 + detuneIdx * 180, time + dur * 0.5);
    filter.Q.value = 0.6;
    const g = this.env(filter, time, dur * 0.35, dur * 0.65, vol * 0.6);
    g.connect(this.musicBus);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    g.connect(send).connect(this.musicVerb);
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(filter);
      o.start(time);
      o.stop(time + dur + 0.1);
    }
  }

  private bass(freq: number, time: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.frequency.exponentialRampToValueAtTime(110, time + dur);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(filter);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    filter.connect(g).connect(this.musicBus);
    o.start(time); o.stop(time + dur + 0.05);
  }

  private pluck(freq: number, time: number, dur: number, vol: number, wave: OscillatorType): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(6000, freq * 5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(filter).connect(g).connect(this.musicBus);
    const send = ctx.createGain(); send.gain.value = 0.35;
    g.connect(send).connect(this.musicVerb);
    o.start(time); o.stop(time + dur + 0.05);
  }

  private lead(freq: number, time: number, dur: number, vol: number, wave: OscillatorType): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(this.musicBus);
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(send).connect(this.musicVerb);
    o.start(time); o.stop(time + dur + 0.05);
    lfo.start(time); lfo.stop(time + dur + 0.05);
  }

  private kick(time: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, time);
    o.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    o.connect(g).connect(this.musicBus);
    o.start(time); o.stop(time + 0.3);
  }

  private noiseHit(time: number, vol: number, type: BiquadFilterType, freq: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(time); src.stop(time + dur + 0.05);
  }

  private snare(time: number, vol: number): void {
    this.noiseHit(time, vol, 'bandpass', 1800, 0.18, this.musicBus);
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.8, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    o.connect(g).connect(this.musicBus);
    o.start(time); o.stop(time + 0.15);
  }

  private hat(time: number, vol: number): void {
    this.noiseHit(time, vol, 'highpass', 7000, 0.05, this.musicBus);
  }

  /* ----------------------------------- SFX ----------------------------------- */

  private sfxTone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0, delay = 0): void {
    if (!this.ctx || this.sfxLevel <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.25;
    g.connect(send).connect(this.sfxVerb);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private sfxNoise(vol: number, dur: number, freq: number, type: BiquadFilterType = 'bandpass', slide = 0): void {
    if (!this.ctx || this.sfxLevel <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  sfx(name: string): void {
    if (!this.ctx || this.sfxLevel <= 0) return;
    switch (name) {
      case 'hit':
        this.sfxNoise(0.16, 0.1, 900, 'bandpass', 0.5);
        this.sfxTone(160, 0.1, 0.16, 'triangle', 0.5);
        break;
      case 'crit':
        this.sfxNoise(0.24, 0.16, 1200, 'bandpass', 0.4);
        this.sfxTone(220, 0.18, 0.2, 'square', 0.35);
        this.sfxTone(110, 0.22, 0.18, 'triangle', 0.5);
        break;
      case 'slash':
        this.sfxNoise(0.14, 0.14, 2600, 'highpass', 0.3);
        break;
      case 'fire':
        this.sfxNoise(0.18, 0.5, 700, 'lowpass', 2.2);
        this.sfxTone(140, 0.4, 0.08, 'sawtooth', 1.6);
        break;
      case 'ice':
        this.sfxTone(1200, 0.25, 0.08, 'sine', 0.5);
        this.sfxTone(1800, 0.2, 0.05, 'sine', 0.6, 0.04);
        break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => this.sfxTone(f, 0.35, 0.08, 'sine', 1.15, i * 0.06));
        break;
      case 'shield':
        this.sfxTone(320, 0.35, 0.12, 'triangle', 1.4);
        this.sfxNoise(0.1, 0.2, 3200, 'highpass');
        break;
      case 'dodge':
        this.sfxNoise(0.12, 0.16, 2400, 'highpass', 0.4);
        break;
      case 'death':
        this.sfxTone(180, 0.6, 0.14, 'sawtooth', 0.3);
        this.sfxNoise(0.12, 0.5, 800, 'lowpass', 0.4);
        break;
      case 'cast':
        this.sfxTone(440, 0.22, 0.06, 'triangle', 1.5);
        break;
      case 'ult':
        this.sfxTone(110, 0.8, 0.18, 'sawtooth', 3.0);
        this.sfxTone(330, 0.9, 0.08, 'triangle', 2.0, 0.05);
        this.sfxNoise(0.2, 0.9, 500, 'lowpass', 3.0);
        break;
      case 'summon':
        this.sfxTone(300, 0.4, 0.1, 'sine', 2.2);
        this.sfxTone(450, 0.3, 0.06, 'triangle', 1.8, 0.1);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.sfxTone(f, 0.6, 0.11, 'triangle', 1, i * 0.12));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.sfxTone(f, 0.5, 0.1, 'sine', 0.95, i * 0.16));
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.sfxTone(f, 0.4, 0.09, 'sine', 1.02, i * 0.08));
        break;
      case 'click':
        this.sfxTone(700, 0.06, 0.06, 'triangle', 0.9);
        break;
      case 'back':
        this.sfxTone(400, 0.08, 0.05, 'triangle', 0.7);
        break;
      case 'boss':
        this.sfxTone(70, 1.2, 0.2, 'sawtooth', 0.8);
        this.sfxTone(140, 1.0, 0.1, 'triangle', 0.9, 0.1);
        this.sfxNoise(0.15, 1.0, 300, 'lowpass', 0.5);
        break;
      case 'select':
        this.sfxTone(523, 0.15, 0.08, 'triangle', 1.2);
        this.sfxTone(784, 0.25, 0.07, 'sine', 1.1, 0.07);
        break;
    }
  }
}

export const audio = new AudioEngine();
if (new URLSearchParams(location.search).has('audiodebug')) {
  (window as any).__emberfallAudio = audio;
}
export type { ThemeId };
