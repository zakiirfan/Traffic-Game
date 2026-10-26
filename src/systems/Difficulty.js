import { CONFIG } from '../data/config.js';

// Pengali kecepatan: naik stepMultiplier tiap stepSeconds, dibatasi maxMultiplier.
export function speedMultiplier(elapsedSeconds, cfg = CONFIG) {
  const steps = Math.floor(Math.max(0, elapsedSeconds) / cfg.speed.stepSeconds);
  return Math.min(cfg.speed.maxMultiplier, Math.pow(cfg.speed.stepMultiplier, steps));
}

// Kecepatan jelajah pemain (px/s) pada detik tertentu.
export function cruiseSpeed(elapsedSeconds, helmet, cfg = CONFIG) {
  const base = cfg.player.baseSpeed * (helmet ? 1 : 1 + cfg.player.noHelmetSpeedBonus);
  return base * speedMultiplier(elapsedSeconds, cfg);
}

export function getPhase(elapsedSeconds, cfg = CONFIG) {
  const phases = cfg.difficulty.phases;
  return phases.find((p) => elapsedSeconds < p.until) ?? phases[phases.length - 1];
}
