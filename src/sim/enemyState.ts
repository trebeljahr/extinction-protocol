import type { Enemy } from "./types";

export const isEnemyTargetable = (e: Enemy): boolean => e.alive && e.leak === undefined;
