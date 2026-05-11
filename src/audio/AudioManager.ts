import type { TowerKind } from "../sim/types";

type Sample = {
  buffer: AudioBuffer | null;
  loaded: boolean;
  failed: boolean;
};

export type MusicTrack =
  | "music"
  | "music-forest"
  | "music-desert"
  | "music-snow"
  | "music-wasteland"
  | "music-lava"
  | "music-alien";

export type SfxBus = "ui" | "towers" | "enemies" | "notifications";

const VOICE_CAP_PER_KEY = 3;
const TOTAL_VOICE_CAP = 18;

const DEFAULT_SFX_VOLUME = 0.6;
const DEFAULT_MUSIC_VOLUME = 0.25;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private busGains: Record<SfxBus, GainNode | null> = {
    ui: null,
    towers: null,
    enemies: null,
    notifications: null,
  };
  private musicGain: GainNode | null = null;
  private samples = new Map<string, Sample>();
  private trimmedKeys = new Set<string>();
  private music: { src: AudioBufferSourceNode; gain: GainNode; key: MusicTrack } | null = null;
  private currentMusicKey: MusicTrack | null = null;
  private musicUrls: Record<MusicTrack, string> | null = null;
  private lastPlayedAt = new Map<string, number>();
  private activeVoices = new Map<string, Set<AudioBufferSourceNode>>();
  private busVolumes: Record<SfxBus, number> = {
    ui: DEFAULT_SFX_VOLUME,
    towers: DEFAULT_SFX_VOLUME,
    enemies: DEFAULT_SFX_VOLUME,
    notifications: DEFAULT_SFX_VOLUME,
  };
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  // Default-mute in Claude Code's preview browser (UA contains "Claude/")
  // so dev previews don't play music at whoever is nearby. Real users
  // get the persisted/default unmuted state via loadAudioPrefs().
  private muted = typeof navigator !== "undefined" && /Claude\//.test(navigator.userAgent);

  async init() {
    if (this.ctx) return;
    try {
      this.ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    for (const bus of ["ui", "towers", "enemies", "notifications"] as const) {
      const g = this.ctx.createGain();
      g.gain.value = this.busVolumes[bus];
      g.connect(this.master);
      this.busGains[bus] = g;
    }

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);
  }

  async ensureResumed() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private async load(key: string, url: string) {
    if (!this.ctx) return;
    if (this.samples.has(key)) return;
    const entry: Sample = { buffer: null, loaded: false, failed: false };
    this.samples.set(key, entry);
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      entry.buffer = await this.ctx.decodeAudioData(ab);
      entry.loaded = true;
    } catch {
      entry.failed = true;
    }
  }

  async preload() {
    await this.init();
    const base = import.meta.env.BASE_URL ?? "/";
    // Biome tracks are large (~5–13MB each); load them on demand when
    // the player enters a level rather than paying ~40MB up-front.
    this.musicUrls = {
      music: `${base}audio/music-ambient.mp3`,
      "music-forest": `${base}audio/music/forest.mp3`,
      "music-desert": `${base}audio/music/desert.mp3`,
      "music-snow": `${base}audio/music/snow.mp3`,
      "music-wasteland": `${base}audio/music/wasteland.mp3`,
      "music-lava": `${base}audio/music/lava.mp3`,
      "music-alien": `${base}audio/music/alien.mp3`,
    };
    const entries: [string, string][] = [
      ["shoot-pulse", `${base}audio/shoot-pulse.mp3`],
      ["shoot-chain", `${base}audio/shoot-chain.mp3`],
      ["shoot-cryo", `${base}audio/shoot-cryo.mp3`],
      ["shoot-mortar", `${base}audio/shoot-mortar.mp3`],
      ["impact", `${base}audio/impact.mp3`],
      ["wave-start", `${base}audio/wave-start.mp3`],
      ["wave-clear", `${base}audio/wave-clear.mp3`],
      ["life-lost", `${base}audio/life-lost.mp3`],
      ["game-over", `${base}audio/game-over.mp3`],
      ["upgrade", `${base}audio/upgrade.mp3`],
      ["star", `${base}audio/star.mp3`],
      ["level-select", `${base}audio/level-select.mp3`],
      ["music", `${base}audio/music-ambient.mp3`],
      ["ui-click", `${base}audio/ui-click.mp3`],
      ["ui-tab", `${base}audio/ui-tab.mp3`],
      ["ui-open", `${base}audio/ui-open.mp3`],
      ["ui-close", `${base}audio/ui-close.mp3`],
      ["ui-error", `${base}audio/ui-error.mp3`],
      ["tower-place", `${base}audio/tower-place.mp3`],
      ["tower-sell", `${base}audio/tower-sell.mp3`],
      ["tower-select", `${base}audio/tower-select.mp3`],
      ["new-enemy", `${base}audio/new-enemy.mp3`],
      ["victory", `${base}audio/victory.mp3`],
      ["defeat", `${base}audio/defeat.mp3`],
      ["wave-call", `${base}audio/wave-call.mp3`],
    ];
    await Promise.all(entries.map(([k, u]) => this.load(k, u)));
  }

  // Strip leading/trailing silence (MP3 encoder padding) so loop = true is gapless.
  private trimBuffer(buf: AudioBuffer): AudioBuffer {
    if (!this.ctx) return buf;
    const ch0 = buf.getChannelData(0);
    const len = ch0.length;
    const threshold = 0.002;
    const maxTrim = Math.ceil(buf.sampleRate * 0.1);

    let start = 0;
    while (start < maxTrim && start < len && Math.abs(ch0[start]) < threshold) start++;

    let end = len;
    while (end > len - maxTrim && end > start && Math.abs(ch0[end - 1]) < threshold) end--;

    if (start === 0 && end === len) return buf;
    const trimLen = end - start;
    const trimmed = this.ctx.createBuffer(buf.numberOfChannels, trimLen, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      trimmed.copyToChannel(buf.getChannelData(c).subarray(start, end), c);
    }
    return trimmed;
  }

  private totalVoices(): number {
    let n = 0;
    for (const set of this.activeVoices.values()) n += set.size;
    return n;
  }

  play(key: string, bus: SfxBus, volumeScale = 1, cooldownMs = 50, maxDurationSec?: number) {
    const busGain = this.busGains[bus];
    if (!this.ctx || !busGain || this.muted) return;
    const sample = this.samples.get(key);
    if (!sample?.loaded || !sample.buffer) return;
    const now = performance.now();
    const last = this.lastPlayedAt.get(key) ?? 0;
    if (now - last < cooldownMs) return;

    let keyVoices = this.activeVoices.get(key);
    if (!keyVoices) {
      keyVoices = new Set();
      this.activeVoices.set(key, keyVoices);
    }
    if (keyVoices.size >= VOICE_CAP_PER_KEY) return;
    if (this.totalVoices() >= TOTAL_VOICE_CAP) return;

    this.lastPlayedAt.set(key, now);

    const src = this.ctx.createBufferSource();
    src.buffer = sample.buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(1.2, volumeScale);
    src.connect(gain).connect(busGain);
    keyVoices.add(src);
    src.onended = () => {
      keyVoices!.delete(src);
    };
    src.start(0);
    if (maxDurationSec !== undefined) {
      const ctxNow = this.ctx.currentTime;
      const fadeLen = Math.min(0.35, maxDurationSec * 0.6);
      const fadeStart = ctxNow + Math.max(0, maxDurationSec - fadeLen);
      const stopAt = ctxNow + maxDurationSec;
      gain.gain.setValueAtTime(gain.gain.value, fadeStart);
      gain.gain.linearRampToValueAtTime(0, stopAt);
      try {
        src.stop(stopAt);
      } catch {
        /* ok */
      }
    }
  }

  playShoot(kind: TowerKind) {
    // Flame uses a synthesised whoosh instead of a sample so it reads as a
    // continuous noise burst rather than a discrete shot.
    if (kind === "flame") {
      this.playWhoosh(0.35, 0.45);
      return;
    }
    // Pulse + hive use a synthesised crack — short enough to stay discrete
    // at 2+ shots/sec instead of the old sample that blurred into a tone.
    if (kind === "pulse" || kind === "hive") {
      this.playCrack(kind === "hive" ? 0.25 : 0.4);
      return;
    }
    const map: Record<TowerKind, [string, number, number, number]> = {
      pulse: ["shoot-pulse", 0.35, 60, 0.7], // unused — see early return
      chain: ["shoot-chain", 0.35, 90, 0.9],
      cryo: ["shoot-cryo", 0.45, 150, 1.1],
      mortar: ["shoot-mortar", 0.55, 200, 1.4],
      flame: ["shoot-mortar", 0.3, 80, 0.6], // unused — see early return
      hive: ["shoot-pulse", 0.28, 80, 0.7], // unused — see early return
    };
    const [key, vol, cd, maxDur] = map[kind];
    this.play(key, "towers", vol, cd, maxDur);
  }

  // Synthesised pulse-rifle crack: a tight mid-high noise burst + sub click.
  // ~100ms total so each shot stays discrete at 2+ shots/sec.
  private lastCrackAt = 0;
  private activeCracks = new Set<AudioScheduledSourceNode>();
  playCrack(volumeScale = 0.4) {
    const towersGain = this.busGains.towers;
    if (!this.ctx || !towersGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const wallNow = performance.now();
    if (wallNow - this.lastCrackAt < 40) return;
    if (this.activeCracks.size >= 6) return;
    this.lastCrackAt = wallNow;

    const duration = 0.1;
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(duration * sampleRate);

    // Noise burst — the snappy "tack" transient
    const noiseBuf = ctx.createBuffer(1, length, sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.8;
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + duration);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;

    const noiseGain = ctx.createGain();
    const peak = Math.min(0.6, volumeScale);
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peak, now + 0.0015);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(bp).connect(hp).connect(noiseGain).connect(towersGain);

    // Sub click — brief percussive punch without sustain
    const clickDur = 0.025;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + clickDur);

    const oscGain = ctx.createGain();
    const oscPeak = peak * 0.35;
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(oscPeak, now + 0.001);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + clickDur);

    osc.connect(oscGain).connect(towersGain);

    this.activeCracks.add(noise);
    this.activeCracks.add(osc);
    noise.onended = () => this.activeCracks.delete(noise);
    osc.onended = () => this.activeCracks.delete(osc);

    noise.start(now);
    noise.stop(now + duration);
    osc.start(now);
    osc.stop(now + clickDur);
  }

  // Synthesised flame: broadband noise with amplitude jitter for crackle,
  // high-shifted spectrum for sizzle (not the watery low-mid bandpass it
  // used to be). Overlapping bursts stack into a continuous roar.
  private lastWhooshAt = 0;
  private activeWhooshes = new Set<AudioBufferSourceNode>();
  playWhoosh(volumeScale = 0.35, durationSec = 0.45) {
    const towersGain = this.busGains.towers;
    if (!this.ctx || !towersGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const wallNow = performance.now();
    if (wallNow - this.lastWhooshAt < 70) return;
    if (this.activeWhooshes.size >= 4) return;
    this.lastWhooshAt = wallNow;

    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(durationSec * sampleRate);
    const buf = ctx.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    // Random-walk amplitude on white noise gives the irregular crackle of
    // flame instead of the smooth hiss of a water jet. Rare sharp spikes
    // mimic pops.
    let amp = 0.6;
    for (let i = 0; i < length; i++) {
      amp += (Math.random() - 0.5) * 0.18;
      if (amp < 0.2) amp = 0.2;
      else if (amp > 1.0) amp = 1.0;
      let s = (Math.random() * 2 - 1) * amp;
      if (Math.random() < 0.0015) s *= 2.2;
      data[i] = s;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 450;

    const peakF = ctx.createBiquadFilter();
    peakF.type = "peaking";
    peakF.frequency.value = 1800;
    peakF.Q.value = 0.7;
    peakF.gain.value = 5;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4200, now);
    lp.frequency.exponentialRampToValueAtTime(2400, now + durationSec);

    const gain = ctx.createGain();
    const peakG = Math.min(0.5, volumeScale);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakG, now + 0.025);
    const wobbleSteps = 5;
    for (let s = 1; s <= wobbleSteps; s++) {
      const t = now + (durationSec - 0.06) * (s / wobbleSteps);
      const v = peakG * (0.55 + Math.random() * 0.4);
      gain.gain.linearRampToValueAtTime(v, t);
    }
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    src.connect(hp).connect(peakF).connect(lp).connect(gain).connect(towersGain);
    this.activeWhooshes.add(src);
    src.onended = () => {
      this.activeWhooshes.delete(src);
    };
    src.start(now);
    src.stop(now + durationSec);
  }

  // Wet "mush" splat for enemy deaths: a short noise burst bandpassed from
  // bright-and-wet down to dull-and-low, paired with a sub-bass thump that
  // pitches down. Reads as a creature's body bursting rather than a clean
  // hit. Synthesised because real splat samples loop poorly when many
  // enemies die at once on wave clears.
  private lastSplatAt = 0;
  private activeSplats = new Set<AudioScheduledSourceNode>();
  playSplat(volumeScale = 0.55) {
    const enemiesGain = this.busGains.enemies;
    if (!this.ctx || !enemiesGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const wallNow = performance.now();
    if (wallNow - this.lastSplatAt < 25) return;
    if (this.activeSplats.size >= 10) return;
    this.lastSplatAt = wallNow;

    const duration = 0.22;
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(duration * sampleRate);

    const noiseBuf = ctx.createBuffer(1, length, sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(180, now + duration);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;

    const noiseGain = ctx.createGain();
    const peak = Math.min(0.7, volumeScale);
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peak, now + 0.006);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp).connect(lp).connect(noiseGain).connect(enemiesGain);

    const startHz = 90 + Math.random() * 18;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + duration * 0.55);

    const oscGain = ctx.createGain();
    const oscPeak = peak * 0.6;
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(oscPeak, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.75);

    osc.connect(oscGain).connect(enemiesGain);

    this.activeSplats.add(noise);
    this.activeSplats.add(osc);
    noise.onended = () => this.activeSplats.delete(noise);
    osc.onended = () => this.activeSplats.delete(osc);

    noise.start(now);
    noise.stop(now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }

  ui(kind: "click" | "tab" | "open" | "close" | "error" | "select") {
    const map: Record<typeof kind, [string, number, number, number]> = {
      click: ["ui-click", 0.4, 30, 0.4],
      tab: ["ui-tab", 0.45, 40, 0.5],
      open: ["ui-open", 0.4, 80, 0.6],
      close: ["ui-close", 0.4, 80, 0.6],
      error: ["ui-error", 0.5, 120, 0.6],
      select: ["tower-select", 0.45, 60, 0.9],
    };
    const [key, vol, cd, maxDur] = map[kind];
    this.play(key, "ui", vol, cd, maxDur);
  }

  private async ensureMusicLoaded(key: MusicTrack) {
    if (this.samples.has(key)) {
      const s = this.samples.get(key);
      if (s?.loaded) return true;
      if (s?.failed) return false;
      // Still loading — wait for it.
      while (this.samples.get(key)?.loaded === false && !this.samples.get(key)?.failed) {
        await new Promise((r) => setTimeout(r, 30));
      }
      return this.samples.get(key)?.loaded === true;
    }
    const url = this.musicUrls?.[key];
    if (!url) return false;
    await this.load(key, url);
    return this.samples.get(key)?.loaded === true;
  }

  startMusic(key: MusicTrack = "music") {
    this.crossfadeTo(key);
  }

  async crossfadeTo(key: MusicTrack, fadeSec = 1.5) {
    if (!this.ctx || !this.musicGain) return;
    if (this.currentMusicKey === key && this.music) return;
    this.currentMusicKey = key;
    const ok = await this.ensureMusicLoaded(key);
    if (!ok) return;
    // Aborted: another track was requested while we were loading.
    if (this.currentMusicKey !== key) return;
    const sample = this.samples.get(key);
    if (!sample?.buffer) return;
    if (!this.trimmedKeys.has(key)) {
      sample.buffer = this.trimBuffer(sample.buffer);
      this.trimmedKeys.add(key);
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const newGain = ctx.createGain();
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + fadeSec);
    newGain.connect(this.musicGain);

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.loop = true;
    src.connect(newGain);
    src.start(0);

    if (this.music) {
      const old = this.music;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
      const stopAt = now + fadeSec + 0.05;
      try {
        old.src.stop(stopAt);
      } catch {
        /* ok */
      }
    }

    this.music = { src, gain: newGain, key };
  }

  stopMusic() {
    this.currentMusicKey = null;
    if (!this.ctx) {
      this.music = null;
      return;
    }
    if (this.music) {
      const now = this.ctx.currentTime;
      const old = this.music;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.6);
      try {
        old.src.stop(now + 0.65);
      } catch {
        /* ok */
      }
      this.music = null;
    }
  }

  stopAllSfx(except?: string) {
    for (const [key, set] of this.activeVoices.entries()) {
      if (key === except) continue;
      for (const src of set) {
        try {
          src.stop();
        } catch {
          /* ok */
        }
      }
      set.clear();
    }
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master) this.master.gain.value = v ? 0 : 1;
  }

  isMuted() {
    return this.muted;
  }

  setBusVolume(bus: SfxBus, v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    this.busVolumes[bus] = clamped;
    const g = this.busGains[bus];
    if (g) g.gain.value = clamped;
  }

  getBusVolume(bus: SfxBus) {
    return this.busVolumes[bus];
  }

  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  getMusicVolume() {
    return this.musicVolume;
  }
}

export const audio = new AudioManager();
