import type { TowerKind } from "../sim/types";

type Sample = {
  buffer: AudioBuffer | null;
  loaded: boolean;
  failed: boolean;
};

type FlameVoice = {
  sample: AudioBufferSourceNode;
  noise: AudioBufferSourceNode;
  master: GainNode;
};

type MusicPlayback = {
  gain: GainNode;
  nextStartAt: number;
  firstSegment: boolean;
  refreshTimer: number | null;
  sources: Set<AudioBufferSourceNode>;
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

const DEFAULT_MASTER_VOLUME = 1;
const DEFAULT_SFX_VOLUME = 0.6;
const DEFAULT_MUSIC_VOLUME = 0.25;
const MUSIC_LOOP_OVERLAP_SEC = 0.12;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private output: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private busGains: Record<SfxBus, GainNode | null> = {
    ui: null,
    towers: null,
    enemies: null,
    notifications: null,
  };
  private musicGain: GainNode | null = null;
  private samples = new Map<string, Sample>();
  private trimmedKeys = new Set<string>();
  private music: MusicPlayback | null = null;
  private currentMusicKey: MusicTrack | null = null;
  private musicUrls: Record<MusicTrack, string> | null = null;
  private lastPlayedAt = new Map<string, number>();
  private activeVoices = new Map<string, Set<AudioBufferSourceNode>>();
  private masterVolume = DEFAULT_MASTER_VOLUME;
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
    this.master.gain.value = this.masterVolume;

    // Brick-wall-ish limiter targeting a -1 dBTP true-peak ceiling,
    // matching Spotify / YouTube Music loudness guidelines. Catches the
    // peaks that arise when many SFX voices sum on wave clears, so the
    // mix can sit near -14 LUFS program loudness without speaker clipping.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;
    this.output = this.ctx.createGain();
    this.output.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.limiter).connect(this.output).connect(this.ctx.destination);

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
      ["shoot-flame", `${base}audio/shoot-flame.mp3`],
      ["shoot-chain", `${base}audio/shoot-chain.mp3`],
      ["shoot-cryo", `${base}audio/shoot-cryo.mp3`],
      ["shoot-mortar", `${base}audio/shoot-mortar.mp3`],
      ["impact", `${base}audio/impact.mp3`],
      ["wave-start", `${base}audio/wave-start.mp3`],
      ["wave-call", `${base}audio/wave-call.mp3`],
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
    const trim = key === "victory" ? 0.2 : key === "star" ? 0.78 : key === "new-enemy" ? 0.88 : 1;
    gain.gain.value = Math.min(1, volumeScale * trim);
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

  playShoot(kind: TowerKind, _towerId?: number) {
    if (kind === "flame") return;
    const map: Record<Exclude<TowerKind, "flame">, [string, number, number, number]> = {
      pulse: ["shoot-pulse", 0.35, 60, 0.7],
      chain: ["shoot-chain", 0.35, 90, 0.9],
      cryo: ["shoot-cryo", 0.45, 150, 1.1],
      mortar: ["shoot-mortar", 0.55, 200, 1.4],
      hive: ["shoot-pulse", 0.28, 80, 0.7],
    };
    const [key, vol, cd, maxDur] = map[kind];
    this.play(key, "towers", vol, cd, maxDur);
  }

  // --- Continuous flamethrower sound (per-tower, looping sample) ---------
  //
  // Driven by flame-start / flame-stop sim events so the sound tracks
  // actual targeting, not damage ticks. Each firing tower owns one looping
  // voice of the shoot-flame sample with a fade in/out on its master gain.

  private static readonly MAX_FLAME_VOICES = 4;
  private activeFlames = new Map<number, FlameVoice>();
  private flameNoiseBuffer: AudioBuffer | null = null;

  private ensureFlameNoiseBuffer() {
    if (!this.ctx || this.flameNoiseBuffer) return this.flameNoiseBuffer;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate;
    const buf = this.ctx.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.flameNoiseBuffer = buf;
    return buf;
  }

  startFlame(towerId: number) {
    const towersGain = this.busGains.towers;
    if (!this.ctx || !towersGain || this.muted) return;
    if (this.activeFlames.has(towerId)) return;
    if (this.activeFlames.size >= AudioManager.MAX_FLAME_VOICES) return;

    const sample = this.samples.get("shoot-flame");
    if (!sample?.loaded || !sample.buffer) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.08);
    master.connect(towersGain);

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(2600, now);
    tone.Q.value = 0.75;
    tone.connect(master);

    const sampleGain = ctx.createGain();
    sampleGain.gain.value = 0.58;
    sampleGain.connect(tone);

    const sampleSrc = ctx.createBufferSource();
    sampleSrc.buffer = sample.buffer;
    sampleSrc.loop = true;
    sampleSrc.playbackRate.value = 0.94 + Math.random() * 0.12;
    sampleSrc.connect(sampleGain);
    sampleSrc.start(now, Math.random() * sample.buffer.duration);

    const noiseBuf = this.ensureFlameNoiseBuffer();
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const noiseHp = ctx.createBiquadFilter();
    noiseHp.type = "highpass";
    noiseHp.frequency.value = 150;

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = "lowpass";
    noiseLp.frequency.value = 2200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12;
    noise.connect(noiseHp).connect(noiseLp).connect(noiseGain).connect(master);
    noise.start(now, Math.random());

    this.activeFlames.set(towerId, { sample: sampleSrc, noise, master });
  }

  stopFlame(towerId: number) {
    const flame = this.activeFlames.get(towerId);
    if (!flame || !this.ctx) return;
    this.activeFlames.delete(towerId);

    const now = this.ctx.currentTime;
    const fade = 0.18;

    flame.master.gain.cancelScheduledValues(now);
    flame.master.gain.setValueAtTime(flame.master.gain.value, now);
    flame.master.gain.linearRampToValueAtTime(0, now + fade);

    const stopAt = now + fade + 0.01;
    try {
      flame.sample.stop(stopAt);
    } catch {
      /* ok */
    }
    try {
      flame.noise.stop(stopAt);
    } catch {
      /* ok */
    }
    const m = flame.master;
    setTimeout(
      () => {
        try {
          m.disconnect();
        } catch {
          /* ok */
        }
      },
      (fade + 0.05) * 1000,
    );
  }

  syncFlames(activeTowerIds: Iterable<number>) {
    const active = new Set(activeTowerIds);
    for (const id of [...this.activeFlames.keys()]) {
      if (!active.has(id)) this.stopFlame(id);
    }
    for (const id of active) {
      if (!this.activeFlames.has(id)) this.startFlame(id);
    }
  }

  stopAllFlames() {
    if (!this.ctx) {
      this.activeFlames.clear();
      return;
    }
    for (const id of [...this.activeFlames.keys()]) {
      this.stopFlame(id);
    }
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
      tab: ["ui-click", 0.4, 40, 0.4],
      open: ["ui-click", 0.4, 80, 0.4],
      close: ["ui-click", 0.4, 80, 0.4],
      error: ["ui-error", 0.5, 120, 0.6],
      select: ["ui-click", 0.42, 60, 0.4],
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

  private clearMusicRefresh(playback: MusicPlayback) {
    if (playback.refreshTimer !== null) {
      window.clearTimeout(playback.refreshTimer);
      playback.refreshTimer = null;
    }
  }

  private stopMusicPlayback(playback: MusicPlayback, fadeSec: number) {
    if (!this.ctx) return;
    this.clearMusicRefresh(playback);
    const now = this.ctx.currentTime;
    playback.gain.gain.cancelScheduledValues(now);
    playback.gain.gain.setValueAtTime(playback.gain.gain.value, now);
    playback.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
    for (const src of playback.sources) {
      try {
        src.stop(now + fadeSec + 0.05);
      } catch {
        /* ok */
      }
    }
    window.setTimeout(() => playback.sources.clear(), (fadeSec + 0.1) * 1000);
  }

  private scheduleMusicRefresh(playback: MusicPlayback, buffer: AudioBuffer) {
    if (!this.ctx || this.music !== playback) return;
    this.clearMusicRefresh(playback);
    const overlap = Math.min(MUSIC_LOOP_OVERLAP_SEC, Math.max(0.04, buffer.duration * 0.01));
    const segment = Math.max(1, buffer.duration - overlap);
    const nextDelayMs = Math.max(5000, Math.min(15000, segment * 500));
    playback.refreshTimer = window.setTimeout(() => {
      if (this.music !== playback) return;
      this.refillMusicSchedule(playback, buffer);
    }, nextDelayMs);
  }

  private startMusicSegment(playback: MusicPlayback, buffer: AudioBuffer, startAt: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const overlap = Math.min(MUSIC_LOOP_OVERLAP_SEC, Math.max(0.04, buffer.duration * 0.01));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const srcGain = ctx.createGain();
    const fadeIn = !playback.firstSegment;
    const fadeOutStart = startAt + Math.max(0.1, buffer.duration - overlap);
    srcGain.gain.setValueAtTime(fadeIn ? 0 : 1, startAt);
    if (fadeIn) srcGain.gain.linearRampToValueAtTime(1, startAt + overlap);
    srcGain.gain.setValueAtTime(1, fadeOutStart);
    srcGain.gain.linearRampToValueAtTime(0, startAt + buffer.duration);
    src.connect(srcGain).connect(playback.gain);
    playback.sources.add(src);
    src.onended = () => playback.sources.delete(src);
    src.start(startAt);
    src.stop(startAt + buffer.duration + 0.02);
    playback.firstSegment = false;
    playback.nextStartAt = startAt + buffer.duration - overlap;
  }

  private refillMusicSchedule(playback: MusicPlayback, buffer: AudioBuffer) {
    if (!this.ctx || this.music !== playback) return;
    const scheduleAheadSec = Math.max(buffer.duration * 2, 45);
    while (playback.nextStartAt < this.ctx.currentTime + scheduleAheadSec) {
      this.startMusicSegment(playback, buffer, playback.nextStartAt);
    }
    this.scheduleMusicRefresh(playback, buffer);
  }

  async crossfadeTo(key: MusicTrack, fadeSec = 1.5) {
    if (!this.ctx || !this.musicGain) return;
    if (this.currentMusicKey === key && this.music) return;
    this.currentMusicKey = key;

    // Fade out the current track immediately, before awaiting the new
    // track's load. Biome MP3s are 5-13MB and can take seconds on first
    // fetch — if we waited, the lobby track would keep playing well into
    // the level. Setting this.music to null also frees the slot for the
    // new track without re-fading the same source twice.
    if (this.music) this.stopMusicPlayback(this.music, fadeSec);
    this.music = null;

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

    const playback: MusicPlayback = {
      gain: newGain,
      nextStartAt: now,
      firstSegment: true,
      refreshTimer: null,
      sources: new Set(),
    };
    this.music = playback;
    this.refillMusicSchedule(playback, sample.buffer);
  }

  stopMusic() {
    this.currentMusicKey = null;
    if (!this.ctx) {
      this.music = null;
      return;
    }
    if (this.music) {
      this.stopMusicPlayback(this.music, 0.6);
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
    this.stopAllFlames();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.output) this.output.gain.value = v ? 0 : 1;
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

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.masterVolume;
  }

  getMasterVolume() {
    return this.masterVolume;
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
