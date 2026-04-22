import type { TowerKind } from "../sim/types";

type Sample = {
  buffer: AudioBuffer | null;
  loaded: boolean;
  failed: boolean;
};

const VOICE_CAP_PER_KEY = 3;
const TOTAL_VOICE_CAP = 18;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private samples = new Map<string, Sample>();
  private music: AudioBufferSourceNode | null = null;
  private lastPlayedAt = new Map<string, number>();
  private activeVoices = new Map<string, Set<AudioBufferSourceNode>>();
  private sfxVolume = 0.6;
  private musicVolume = 0.25;
  private muted = false;

  async init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

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
    const entries: [string, string][] = [
      ["shoot-pulse",  `${base}audio/shoot-pulse.mp3`],
      ["shoot-chain",  `${base}audio/shoot-chain.mp3`],
      ["shoot-cryo",   `${base}audio/shoot-cryo.mp3`],
      ["shoot-mortar", `${base}audio/shoot-mortar.mp3`],
      ["impact",       `${base}audio/impact.mp3`],
      ["death",        `${base}audio/death.mp3`],
      ["wave-start",   `${base}audio/wave-start.mp3`],
      ["wave-clear",   `${base}audio/wave-clear.mp3`],
      ["life-lost",    `${base}audio/life-lost.mp3`],
      ["game-over",    `${base}audio/game-over.mp3`],
      ["upgrade",      `${base}audio/upgrade.mp3`],
      ["music",        `${base}audio/music-ambient.mp3`],
    ];
    await Promise.all(entries.map(([k, u]) => this.load(k, u)));
  }

  private totalVoices(): number {
    let n = 0;
    for (const set of this.activeVoices.values()) n += set.size;
    return n;
  }

  play(key: string, volumeScale = 1, cooldownMs = 50, maxDurationSec?: number) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const sample = this.samples.get(key);
    if (!sample || !sample.loaded || !sample.buffer) return;
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
    src.connect(gain).connect(this.sfxGain);
    keyVoices.add(src);
    src.onended = () => {
      keyVoices!.delete(src);
    };
    src.start(0);
    if (maxDurationSec !== undefined) {
      const ctxNow = this.ctx.currentTime;
      const fadeStart = ctxNow + Math.max(0, maxDurationSec - 0.05);
      const stopAt = ctxNow + maxDurationSec;
      gain.gain.setValueAtTime(gain.gain.value, fadeStart);
      gain.gain.linearRampToValueAtTime(0, stopAt);
      try { src.stop(stopAt); } catch { /* ok */ }
    }
  }

  playShoot(kind: TowerKind) {
    const map: Record<TowerKind, [string, number, number, number]> = {
      pulse:  ["shoot-pulse",  0.35, 60,  0.22],
      chain:  ["shoot-chain",  0.35, 90,  0.35],
      cryo:   ["shoot-cryo",   0.45, 150, 0.45],
      mortar: ["shoot-mortar", 0.55, 200, 0.55],
    };
    const [key, vol, cd, maxDur] = map[kind];
    this.play(key, vol, cd, maxDur);
  }

  startMusic() {
    if (!this.ctx || !this.musicGain) return;
    const sample = this.samples.get("music");
    if (!sample || !sample.loaded || !sample.buffer) return;
    if (this.music) return;
    const src = this.ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start(0);
    this.music = src;
  }

  stopMusic() {
    if (this.music) {
      try { this.music.stop(); } catch { /* ok */ }
      this.music = null;
    }
  }

  stopAllSfx(except?: string) {
    for (const [key, set] of this.activeVoices.entries()) {
      if (key === except) continue;
      for (const src of set) {
        try { src.stop(); } catch { /* ok */ }
      }
      set.clear();
    }
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master) this.master.gain.value = v ? 0 : 1;
  }

  isMuted() { return this.muted; }
}

export const audio = new AudioManager();
