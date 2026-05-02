import { audio, type SfxBus } from "./AudioManager";

const STORAGE_KEY_V2 = "extinction-protocol:audio:v2";
// v1 stored a single "sfx" bus; on first run with v2 present, every
// per-bus volume is seeded from v1.sfx so existing users keep their level.
const STORAGE_KEY_V1 = "extinction-protocol:audio:v1";

export type AudioPrefs = {
  music: number;
  ui: number;
  towers: number;
  enemies: number;
  notifications: number;
  muted: boolean;
};

export const SFX_BUSES: readonly SfxBus[] = ["ui", "towers", "enemies", "notifications"];

const DEFAULTS: AudioPrefs = {
  music: 0.25,
  ui: 0.6,
  towers: 0.6,
  enemies: 0.6,
  notifications: 0.6,
  muted: false,
};

const clamp01 = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;

const parseV2 = (raw: string): AudioPrefs | null => {
  try {
    const obj = JSON.parse(raw) as Partial<Record<keyof AudioPrefs, unknown>>;
    const next: AudioPrefs = { ...DEFAULTS };
    for (const k of ["music", "ui", "towers", "enemies", "notifications"] as const) {
      const c = clamp01(obj[k]);
      if (c !== null) next[k] = c;
    }
    if (typeof obj.muted === "boolean") next.muted = obj.muted;
    return next;
  } catch {
    return null;
  }
};

const migrateFromV1 = (raw: string): AudioPrefs | null => {
  try {
    const old = JSON.parse(raw) as { sfx?: unknown; music?: unknown; muted?: unknown };
    const sfx = clamp01(old.sfx);
    const music = clamp01(old.music);
    const next: AudioPrefs = {
      music: music ?? DEFAULTS.music,
      ui: sfx ?? DEFAULTS.ui,
      towers: sfx ?? DEFAULTS.towers,
      enemies: sfx ?? DEFAULTS.enemies,
      notifications: sfx ?? DEFAULTS.notifications,
      muted: typeof old.muted === "boolean" ? old.muted : DEFAULTS.muted,
    };
    return next;
  } catch {
    return null;
  }
};

export const loadAudioPrefs = (): AudioPrefs => {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = parseV2(v2);
      if (parsed) return parsed;
    }
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const migrated = migrateFromV1(v1);
      if (migrated) {
        saveAudioPrefs(migrated);
        try {
          localStorage.removeItem(STORAGE_KEY_V1);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
};

export const saveAudioPrefs = (p: AudioPrefs) => {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(p));
  } catch {
    /* ignore */
  }
};

export const applyAudioPrefs = (p: AudioPrefs) => {
  audio.setMusicVolume(p.music);
  audio.setBusVolume("ui", p.ui);
  audio.setBusVolume("towers", p.towers);
  audio.setBusVolume("enemies", p.enemies);
  audio.setBusVolume("notifications", p.notifications);
  audio.setMuted(p.muted);
};

export const readAudioPrefs = (): AudioPrefs => ({
  music: audio.getMusicVolume(),
  ui: audio.getBusVolume("ui"),
  towers: audio.getBusVolume("towers"),
  enemies: audio.getBusVolume("enemies"),
  notifications: audio.getBusVolume("notifications"),
  muted: audio.isMuted(),
});
