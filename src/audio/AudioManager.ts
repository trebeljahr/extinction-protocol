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

const VOICE_CAP_PER_KEY = 3;
const TOTAL_VOICE_CAP = 18;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private samples = new Map<string, Sample>();
  private music: { src: AudioBufferSourceNode; gain: GainNode; key: MusicTrack } | null = null;
  private currentMusicKey: MusicTrack | null = null;
  private musicUrls: Record<MusicTrack, string> | null = null;
  private lastPlayedAt = new Map<string, number>();
  private activeVoices = new Map<string, Set<AudioBufferSourceNode>>();
  private sfxVolume = 0.6;
  private musicVolume = 0.25;
  private muted = false;

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
      ["death", `${base}audio/death.mp3`],
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

  private totalVoices(): number {
    let n = 0;
    for (const set of this.activeVoices.values()) n += set.size;
    return n;
  }

  play(key: string, volumeScale = 1, cooldownMs = 50, maxDurationSec?: number) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
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
    src.connect(gain).connect(this.sfxGain);
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
    const map: Record<TowerKind, [string, number, number, number]> = {
      pulse: ["shoot-pulse", 0.35, 60, 0.7],
      chain: ["shoot-chain", 0.35, 90, 0.9],
      cryo: ["shoot-cryo", 0.45, 150, 1.1],
      mortar: ["shoot-mortar", 0.55, 200, 1.4],
      flame: ["shoot-mortar", 0.3, 80, 0.6], // unused — see early return
      // Hive volley — pulse sfx at lower volume; one tick can fire up to
      // 3 drones, so we don't want a big stack.
      hive: ["shoot-pulse", 0.28, 80, 0.7],
    };
    const [key, vol, cd, maxDur] = map[kind];
    this.play(key, vol, cd, maxDur);
  }

  // Synthesised flamethrower whoosh: filtered white noise with an envelope
  // and a frequency sweep. Played once per damage tick — overlapping bursts
  // stack into a continuous roar while the tower is firing.
  private lastWhooshAt = 0;
  private activeWhooshes = new Set<AudioBufferSourceNode>();
  playWhoosh(volumeScale = 0.35, durationSec = 0.45) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
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
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + durationSec * 0.45);
    bp.frequency.exponentialRampToValueAtTime(700, now + durationSec);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;

    const gain = ctx.createGain();
    const peak = Math.min(0.5, volumeScale);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.04);
    gain.gain.linearRampToValueAtTime(peak * 0.7, now + durationSec * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    src.connect(bp).connect(lp).connect(gain).connect(this.sfxGain);
    this.activeWhooshes.add(src);
    src.onended = () => {
      this.activeWhooshes.delete(src);
    };
    src.start(now);
    src.stop(now + durationSec);
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
    this.play(key, vol, cd, maxDur);
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

  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  getSfxVolume() {
    return this.sfxVolume;
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
